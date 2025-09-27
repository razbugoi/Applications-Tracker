export type ApplicationStatus = 'Submitted' | 'Invalidated' | 'Live' | 'Determined';
export type ApplicationOutcome = 'Approved' | 'Refused' | 'Withdrawn' | 'Pending' | 'NotApplicable';
export type IssueStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';
export type IssueCategory = 'Validation' | 'Technical' | 'Design' | 'Documentation' | 'Policy' | 'Other';

export interface ApplicationDto {
  applicationId: string;
  prjCodeName: string;
  ppReference: string;
  lpaReference?: string | null;
  description: string;
  council: string;
  submissionDate: string;
  validationDate?: string | null;
  determinationDate?: string | null;
  eotDate?: string | null;
  status: ApplicationStatus;
  outcome?: ApplicationOutcome | null;
  issuesCount?: number;
  caseOfficer?: string | null;
  caseOfficerEmail?: string | null;
  planningPortalUrl?: string | null;
}

export interface TimelineEventDto {
  eventId: string;
  event: string;
  stage: ApplicationStatus;
  timestamp: string;
  details?: string | null;
  durationDays?: number | null;
}

export interface IssueDto {
  issueId: string;
  applicationId: string;
  prjCodeName?: string | null;
  ppReference: string;
  lpaReference?: string | null;
  title: string;
  category: IssueCategory;
  status: IssueStatus;
  dueDate?: string | null;
  description: string;
  assignedTo?: string | null;
  dateRaised: string;
  resolutionNotes?: string | null;
  dateResolved?: string | null;
  raisedBy?: string | null;
}

export interface ExtensionDto {
  extensionId: string;
  applicationId: string;
  ppReference: string;
  prjCodeName?: string | null;
  requestedDate?: string | null;
  agreedDate: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationAggregateDto {
  application: ApplicationDto & { notes?: string | null };
  issues: IssueDto[];
  timeline: TimelineEventDto[];
  extensions: ExtensionDto[];
}
