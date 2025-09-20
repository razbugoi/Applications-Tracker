import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Application, ApplicationAggregate, ApplicationStatus, Issue, TimelineEvent } from '../models/application.js';

const tableName = process.env.TABLE_NAME as string;
if (!tableName) {
  throw new Error('TABLE_NAME environment variable must be set');
}

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

type PaginationKey = Record<string, string> | undefined;

export class DynamoRepository {
  private buildApplicationItem(application: Application) {
    return {
      PK: `APP#${application.applicationId}`,
      SK: `APP#${application.applicationId}`,
      GSI1PK: `STATUS#${application.status}`,
      GSI1SK: `SUBMITTED#${application.submissionDate}#APP#${application.applicationId}`,
      GSI2PK: `PP#${application.ppReference}`,
      GSI2SK: `APP#${application.applicationId}`,
      entityType: 'Application',
      ...application,
    };
  }

  private buildIssueItem(issue: Issue) {
    return {
      PK: `APP#${issue.applicationId}`,
      SK: `ISSUE#${issue.issueId}`,
      GSI1PK: `STATUS#Issue#${issue.status}`,
      GSI1SK: `DUE#${issue.dueDate ?? '9999-12-31'}#ISSUE#${issue.issueId}`,
      GSI2PK: `PP#${issue.ppReference}`,
      GSI2SK: `ISSUE#${issue.issueId}`,
      entityType: 'Issue',
      ...issue,
    };
  }

  private buildTimelineItem(event: TimelineEvent) {
    return {
      PK: `APP#${event.applicationId}`,
      SK: `EVENT#${event.timestamp}`,
      entityType: 'TimelineEvent',
      ...event,
    };
  }

  async createApplication(application: Application): Promise<Application> {
    const item = this.buildApplicationItem(application);
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
    return application;
  }

  async putTimelineEvent(event: TimelineEvent): Promise<void> {
    const item = this.buildTimelineItem(event);
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );
  }

  async listApplicationsByStatus(status: ApplicationStatus, limit = 25, next?: PaginationKey) {
    const response = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `STATUS#${status}`,
        },
        ScanIndexForward: false,
        Limit: limit,
        ExclusiveStartKey: next,
      })
    );
    return {
      items: (response.Items ?? []).filter((item) => item.entityType === 'Application') as Application[],
      next: response.LastEvaluatedKey,
    };
  }

  async getApplicationAggregate(applicationId: string): Promise<ApplicationAggregate | null> {
    const response = await docClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `APP#${applicationId}`,
        },
      })
    );
    const items = response.Items ?? [];
    if (items.length === 0) {
      return null;
    }
    const application = items.find((item) => item.entityType === 'Application') as Application | undefined;
    if (!application) {
      return null;
    }
    const issues = items.filter((item) => item.entityType === 'Issue') as Issue[];
    const timeline = items
      .filter((item) => item.entityType === 'TimelineEvent')
      .map((event) => ({ ...event })) as TimelineEvent[];
    timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return { application, issues, timeline };
  }

  async updateApplication(applicationId: string, attributes: Partial<Application>, current?: Application) {
    const now = new Date().toISOString();
    let snapshot = current;
    if (!snapshot) {
      const aggregate = await this.getApplicationAggregate(applicationId);
      if (!aggregate) {
        throw new Error('Application not found');
      }
      snapshot = aggregate.application;
    }

    const nextStatus = attributes.status ?? snapshot.status;
    const nextSubmissionDate = attributes.submissionDate ?? snapshot.submissionDate;
    const nextPpReference = attributes.ppReference ?? snapshot.ppReference;

    const updateExpressions: string[] = [
      'updatedAt = :updatedAt',
      'GSI1PK = :gsi1pk',
      'GSI1SK = :gsi1sk',
      'GSI2PK = :gsi2pk',
      'GSI2SK = :gsi2sk',
    ];

    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': now,
      ':gsi1pk': `STATUS#${nextStatus}`,
      ':gsi1sk': `SUBMITTED#${nextSubmissionDate}#APP#${applicationId}`,
      ':gsi2pk': `PP#${nextPpReference}`,
      ':gsi2sk': `APP#${applicationId}`,
    };

    const expressionAttributeNames: Record<string, string> = {};

    Object.entries(attributes).forEach(([key, value], index) => {
      if (value === undefined) {
        return;
      }
      const attributeNamePlaceholder = `#attr${index}`;
      const attributeValuePlaceholder = `:val${index}`;
      expressionAttributeNames[attributeNamePlaceholder] = key;
      expressionAttributeValues[attributeValuePlaceholder] = value;
      updateExpressions.push(`${attributeNamePlaceholder} = ${attributeValuePlaceholder}`);
    });

    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: `APP#${applicationId}`,
          SK: `APP#${applicationId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  async createIssue(issue: Issue) {
    const item = this.buildIssueItem(issue);
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      })
    );
    await this.incrementIssuesCount(issue.applicationId, 1);
  }

  async updateIssue(issue: Issue) {
    const now = new Date().toISOString();
    const updateExpressions = ['updatedAt = :updatedAt'];
    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': now,
    };
    const expressionAttributeNames: Record<string, string> = {};

    const mutableFields: (keyof Issue)[] = [
      'title',
      'category',
      'description',
      'raisedBy',
      'dateRaised',
      'assignedTo',
      'status',
      'dueDate',
      'resolutionNotes',
      'dateResolved',
    ];

    mutableFields.forEach((field, idx) => {
      const value = issue[field];
      if (value === undefined) {
        return;
      }
      const nameKey = `#f${idx}`;
      const valueKey = `:v${idx}`;
      expressionAttributeNames[nameKey] = field;
      expressionAttributeValues[valueKey] = value;
      updateExpressions.push(`${nameKey} = ${valueKey}`);
    });

    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: `APP#${issue.applicationId}`,
          SK: `ISSUE#${issue.issueId}`,
        },
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  async getIssue(applicationId: string, issueId: string): Promise<Issue | null> {
    const response = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          PK: `APP#${applicationId}`,
          SK: `ISSUE#${issueId}`,
        },
      })
    );
    return (response.Item as Issue | undefined) ?? null;
  }

  async incrementIssuesCount(applicationId: string, delta: number) {
    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: `APP#${applicationId}`,
          SK: `APP#${applicationId}`,
        },
        UpdateExpression: 'SET issuesCount = if_not_exists(issuesCount, :zero) + :delta',
        ExpressionAttributeValues: {
          ':delta': delta,
          ':zero': 0,
        },
      })
    );
  }
}
