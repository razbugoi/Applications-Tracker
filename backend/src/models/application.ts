export type ApplicationStatus = 'Submitted' | 'Invalidated' | 'Live' | 'Determined';
export type ApplicationOutcome = 'Approved' | 'Refused' | 'Withdrawn' | 'Pending' | 'NotApplicable';

export interface Application {
  applicationId: string;
  prjCodeName: string;
  ppReference: string;
  lpaReference?: string;
  description: string;
  council: string;
  submissionDate: string;
  validationDate?: string;
  caseOfficer?: string;
  determinationDate?: string;
  eotDate?: string;
  status: ApplicationStatus;
  outcome?: ApplicationOutcome;
  notes?: string;
  issuesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  issueId: string;
  applicationId: string;
  ppReference: string;
  lpaReference?: string;
  title: string;
  category: string;
  description: string;
  raisedBy?: string;
  dateRaised: string;
  assignedTo?: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  dueDate?: string;
  resolutionNotes?: string;
  dateResolved?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEvent {
  eventId: string;
  applicationId: string;
  timestamp: string;
  stage: ApplicationStatus;
  event: string;
  details?: string;
  durationDays?: number;
}

export interface ApplicationAggregate {
  application: Application;
  issues: Issue[];
  timeline: TimelineEvent[];
}
