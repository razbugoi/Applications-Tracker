import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  type DynamoDBClientConfig,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
  Application,
  ApplicationAggregate,
  ApplicationStatus,
  Issue,
  TimelineEvent,
  ExtensionOfTime,
} from '../models/application.js';

const tableName = process.env.TABLE_NAME as string;
if (!tableName) {
  throw new Error('TABLE_NAME environment variable must be set');
}

const clientConfig: DynamoDBClientConfig = {};

const localEndpoint = process.env.AWS_ENDPOINT_URL_DYNAMODB ?? process.env.DYNAMODB_ENDPOINT;
if (localEndpoint) {
  clientConfig.endpoint = localEndpoint;
  clientConfig.region = process.env.AWS_REGION ?? 'us-east-1';
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }
}

const client = new DynamoDBClient(clientConfig);
const docClient = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });

type PaginationKey = Record<string, string> | undefined;
let tableEnsured = false;

export class DynamoRepository {
  private async ensureTableExists() {
    if (tableEnsured) {
      return;
    }
    if (!localEndpoint) {
      tableEnsured = true;
      return;
    }
    try {
      await client.send(new DescribeTableCommand({ TableName: tableName }));
      tableEnsured = true;
      return;
    } catch (error) {
      if (!(error instanceof ResourceNotFoundException)) {
        console.error('Failed to describe table', error);
        throw error;
      }
    }

    await client.send(
      new CreateTableCommand({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
          { AttributeName: 'GSI1PK', AttributeType: 'S' },
          { AttributeName: 'GSI1SK', AttributeType: 'S' },
          { AttributeName: 'GSI2PK', AttributeType: 'S' },
          { AttributeName: 'GSI2SK', AttributeType: 'S' },
        ],
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' },
          { AttributeName: 'SK', KeyType: 'RANGE' },
        ],
        GlobalSecondaryIndexes: [
          {
            IndexName: 'GSI1',
            KeySchema: [
              { AttributeName: 'GSI1PK', KeyType: 'HASH' },
              { AttributeName: 'GSI1SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
          {
            IndexName: 'GSI2',
            KeySchema: [
              { AttributeName: 'GSI2PK', KeyType: 'HASH' },
              { AttributeName: 'GSI2SK', KeyType: 'RANGE' },
            ],
            Projection: { ProjectionType: 'ALL' },
          },
        ],
      })
    );
    tableEnsured = true;
  }

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

  private buildExtensionItem(extension: ExtensionOfTime) {
    return {
      PK: `APP#${extension.applicationId}`,
      SK: `EOT#${extension.extensionId}`,
      GSI1PK: 'STATUS#Extension',
      GSI1SK: `AGREED#${extension.agreedDate}#EOT#${extension.extensionId}`,
      GSI2PK: `PP#${extension.ppReference}`,
      GSI2SK: `EOT#${extension.extensionId}`,
      entityType: 'ExtensionOfTime',
      ...extension,
    };
  }

  async createApplication(application: Application): Promise<Application> {
    await this.ensureTableExists();
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
    await this.ensureTableExists();
    const item = this.buildTimelineItem(event);
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );
  }

  async listIssues(status?: Issue['status']) {
    await this.ensureTableExists();
    const statusOrder: Issue['status'][] = ['Open', 'In Progress', 'Resolved', 'Closed'];
    const statusesToQuery = status ? [status] : statusOrder;
    const results: Issue[] = [];

    for (const current of statusesToQuery) {
      const response = await docClient.send(
        new QueryCommand({
          TableName: tableName,
          IndexName: 'GSI1',
          KeyConditionExpression: 'GSI1PK = :pk',
          ExpressionAttributeValues: {
            ':pk': `STATUS#Issue#${current}`,
          },
          ScanIndexForward: true,
        })
      );
      const items = (response.Items ?? []).filter((item) => item.entityType === 'Issue') as Issue[];
      results.push(...items);
    }

    results.sort((a, b) => {
      const orderDelta = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      if (orderDelta !== 0) {
        return orderDelta;
      }
      const dueA = a.dueDate ?? '9999-12-31';
      const dueB = b.dueDate ?? '9999-12-31';
      const dueCompare = dueA.localeCompare(dueB);
      if (dueCompare !== 0) {
        return dueCompare;
      }
      const nameA = a.prjCodeName ?? '';
      const nameB = b.prjCodeName ?? '';
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    return results;
  }

  async listApplicationsByStatus(status: ApplicationStatus, limit = 25, next?: PaginationKey) {
    await this.ensureTableExists();
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
    const applications = (response.Items ?? [])
      .filter((item) => item.entityType === 'Application')
      .sort((left, right) => {
        const a = typeof left.prjCodeName === 'string' ? left.prjCodeName : '';
        const b = typeof right.prjCodeName === 'string' ? right.prjCodeName : '';
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      }) as Application[];

    return {
      items: applications,
      next: response.LastEvaluatedKey,
    };
  }

  async getApplicationAggregate(applicationId: string): Promise<ApplicationAggregate | null> {
    await this.ensureTableExists();
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
    const extensions = items
      .filter((item) => item.entityType === 'ExtensionOfTime')
      .map((extension) => ({ ...extension })) as ExtensionOfTime[];
    extensions.sort((a, b) => a.agreedDate.localeCompare(b.agreedDate));
    return { application, issues, timeline, extensions };
  }

  async updateApplication(applicationId: string, attributes: Partial<Application>, current?: Application) {
    await this.ensureTableExists();
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

    const setExpressions: string[] = [
      'updatedAt = :updatedAt',
      'GSI1PK = :gsi1pk',
      'GSI1SK = :gsi1sk',
      'GSI2PK = :gsi2pk',
      'GSI2SK = :gsi2sk',
    ];

    const removeExpressions: string[] = [];

    const expressionAttributeValues: Record<string, unknown> = {
      ':updatedAt': now,
      ':gsi1pk': `STATUS#${nextStatus}`,
      ':gsi1sk': `SUBMITTED#${nextSubmissionDate}#APP#${applicationId}`,
      ':gsi2pk': `PP#${nextPpReference}`,
      ':gsi2sk': `APP#${applicationId}`,
    };

    const expressionAttributeNames: Record<string, string> = {};

    let dynamicIndex = 0;
    Object.entries(attributes).forEach(([key, value]) => {
      if (value === undefined) {
        return;
      }
      const attributeNamePlaceholder = `#attr${dynamicIndex}`;
      expressionAttributeNames[attributeNamePlaceholder] = key;
      if (value === null) {
        removeExpressions.push(attributeNamePlaceholder);
      } else {
        const attributeValuePlaceholder = `:val${dynamicIndex}`;
        expressionAttributeValues[attributeValuePlaceholder] = value;
        setExpressions.push(`${attributeNamePlaceholder} = ${attributeValuePlaceholder}`);
      }
      dynamicIndex += 1;
    });

    let updateExpression = `SET ${setExpressions.join(', ')}`;
    if (removeExpressions.length > 0) {
      updateExpression += ` REMOVE ${removeExpressions.join(', ')}`;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          PK: `APP#${applicationId}`,
          SK: `APP#${applicationId}`,
        },
        ConditionExpression: 'attribute_exists(PK)',
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
        ExpressionAttributeValues: expressionAttributeValues,
      })
    );
  }

  async createIssue(issue: Issue) {
    await this.ensureTableExists();
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

  async createExtension(extension: ExtensionOfTime) {
    await this.ensureTableExists();
    const item = this.buildExtensionItem(extension);
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
      })
    );
  }

  async updateIssue(issue: Issue) {
    await this.ensureTableExists();
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
    await this.ensureTableExists();
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
    await this.ensureTableExists();
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
