export type ApplicationStatus = 'Submitted' | 'Invalidated' | 'Live' | 'Determined';
export type ApplicationOutcome = 'Approved' | 'Refused' | 'Withdrawn' | 'Pending' | 'NotApplicable';

export interface Application {
  applicationId: string;
  teamId: string;
  createdBy?: string | null;
  prjCodeName: string;
  ppReference: string;
  lpaReference?: string | null;
  description: string;
  council: string;
  submissionDate: string;
  validationDate?: string | null;
  caseOfficer?: string | null;
  caseOfficerEmail?: string | null;
  determinationDate?: string | null;
  eotDate?: string | null;
  status: ApplicationStatus;
  outcome?: ApplicationOutcome | null;
  planningPortalUrl?: string | null;
  notes?: string | null;
  issuesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  issueId: string;
  applicationId: string;
  ppReference: string;
  lpaReference?: string | null;
  prjCodeName?: string | null;
  title: string;
  category: string;
  description: string;
  raisedBy?: string | null;
  dateRaised: string;
  assignedTo?: string | null;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  dueDate?: string | null;
  resolutionNotes?: string | null;
  dateResolved?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  eventId: string;
  applicationId: string;
  timestamp: string;
  stage: ApplicationStatus;
  event: string;
  details?: string | null;
  durationDays?: number | null;
}

export interface ExtensionOfTime {
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

export interface ApplicationAggregate {
  application: Application;
  issues: Issue[];
  timeline: TimelineEvent[];
  extensions: ExtensionOfTime[];
}
