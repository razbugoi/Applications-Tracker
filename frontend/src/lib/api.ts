import { fetchAuthSession } from 'aws-amplify/auth';
import { isAmplifyConfigured } from './amplifyClient';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

async function authHeader(): Promise<Record<string, string>> {
  if (!isAmplifyConfigured) {
    return {};
  }
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    if (token) {
      return { Authorization: token };
    }
  } catch (error) {
    console.warn('Failed to fetch auth session', error);
  }
  return {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  const auth = await authHeader();
  Object.entries(auth).forEach(([key, value]) => headers.set(key, value));

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'API request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export interface ApplicationDto {
  applicationId: string;
  prjCodeName: string;
  ppReference: string;
  lpaReference?: string;
  description: string;
  council: string;
  submissionDate: string;
  validationDate?: string;
  determinationDate?: string;
  eotDate?: string;
  status: 'Submitted' | 'Invalidated' | 'Live' | 'Determined';
  outcome?: string;
  issuesCount?: number;
  caseOfficer?: string;
}

export interface ApplicationAggregateDto {
  application: ApplicationDto & { notes?: string };
  issues: IssueDto[];
  timeline: TimelineEventDto[];
}

export interface IssueDto {
  issueId: string;
  title: string;
  category: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  dueDate?: string;
  description: string;
  assignedTo?: string;
  dateRaised: string;
  resolutionNotes?: string;
  dateResolved?: string;
}

export interface TimelineEventDto {
  eventId: string;
  event: string;
  stage: string;
  timestamp: string;
  details?: string;
}

export async function listApplications(status: string) {
  return request<{ items: ApplicationDto[]; nextToken?: string }>(`/applications?status=${encodeURIComponent(status)}`);
}

export async function createApplication(payload: Record<string, unknown>) {
  return request<ApplicationDto>('/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchApplication(applicationId: string) {
  return request<ApplicationAggregateDto>(`/applications/${applicationId}`);
}

export async function createIssue(applicationId: string, payload: Record<string, unknown>) {
  return request(`/applications/${applicationId}/issues`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateIssue(applicationId: string, issueId: string, payload: Record<string, unknown>) {
  return request(`/applications/${applicationId}/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function updateApplication(applicationId: string, payload: Record<string, unknown>) {
  return request(`/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
