import type {
  ApplicationAggregateDto,
  ApplicationDto,
  ExtensionDto,
  IssueDto,
  TimelineEventDto,
} from '@/types/application';
import type { Application, ApplicationAggregate, ExtensionOfTime, Issue, TimelineEvent } from '../models/application';

export function toApplicationDto(application: Application): ApplicationDto {
  return {
    applicationId: application.applicationId,
    prjCodeName: application.prjCodeName,
    ppReference: application.ppReference,
    lpaReference: application.lpaReference ?? undefined,
    description: application.description,
    council: application.council,
    submissionDate: application.submissionDate,
    validationDate: application.validationDate ?? undefined,
    determinationDate: application.determinationDate ?? undefined,
    eotDate: application.eotDate ?? undefined,
    status: application.status,
    outcome: application.outcome ?? undefined,
    issuesCount: application.issuesCount ?? 0,
    caseOfficer: application.caseOfficer ?? undefined,
    caseOfficerEmail: application.caseOfficerEmail ?? undefined,
    planningPortalUrl: application.planningPortalUrl ?? undefined,
  };
}

export function toIssueDto(issue: Issue): IssueDto {
  return {
    issueId: issue.issueId,
    applicationId: issue.applicationId,
    prjCodeName: issue.prjCodeName ?? undefined,
    ppReference: issue.ppReference,
    lpaReference: issue.lpaReference ?? undefined,
    title: issue.title,
    category: issue.category as IssueDto['category'],
    status: issue.status,
    dueDate: issue.dueDate ?? undefined,
    description: issue.description,
    assignedTo: issue.assignedTo ?? undefined,
    dateRaised: issue.dateRaised,
    resolutionNotes: issue.resolutionNotes ?? undefined,
    dateResolved: issue.dateResolved ?? undefined,
    raisedBy: issue.raisedBy ?? undefined,
  };
}

export function toTimelineDto(event: TimelineEvent): TimelineEventDto {
  return {
    eventId: event.eventId,
    event: event.event,
    stage: event.stage,
    timestamp: event.timestamp,
    details: event.details ?? undefined,
    durationDays: event.durationDays ?? undefined,
  };
}

export function toExtensionDto(extension: ExtensionOfTime): ExtensionDto {
  return {
    extensionId: extension.extensionId,
    applicationId: extension.applicationId,
    ppReference: extension.ppReference,
    prjCodeName: extension.prjCodeName ?? undefined,
    requestedDate: extension.requestedDate ?? undefined,
    agreedDate: extension.agreedDate,
    notes: extension.notes ?? undefined,
    createdAt: extension.createdAt,
    updatedAt: extension.updatedAt,
  };
}

export function toApplicationAggregateDto(aggregate: ApplicationAggregate): ApplicationAggregateDto {
  return {
    application: {
      ...toApplicationDto(aggregate.application),
      notes: aggregate.application.notes ?? undefined,
    },
    issues: aggregate.issues.map(toIssueDto),
    timeline: aggregate.timeline.map(toTimelineDto),
    extensions: aggregate.extensions.map(toExtensionDto),
  };
}
