export const APPLICATION_STATUSES = ['Submitted', 'Invalidated', 'Live', 'Determined'] as const;

export const ISSUE_CATEGORIES = ['Validation', 'Technical', 'Design', 'Documentation', 'Other'] as const;

export const ISSUE_STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed'] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
