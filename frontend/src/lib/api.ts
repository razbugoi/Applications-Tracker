import type {
  ApplicationAggregateDto,
  ApplicationDto,
  ApplicationStatus,
  ExtensionDto,
  IssueDto,
  IssueStatus,
  TimelineEventDto,
} from '@/types/application';

const API_BASE_PATH = '/api';

const SWR_KEY_PREFIX = {
  applications: `${API_BASE_PATH}/applications`,
  issues: `${API_BASE_PATH}/issues`,
} as const;

export const SWR_KEYS = {
  dashboardOverview: 'dashboard-overview' as const,
  applicationsByStatus: (status: ApplicationStatus) => [SWR_KEY_PREFIX.applications, 'status', status] as const,
  applicationAggregate: (applicationId: string) => [SWR_KEY_PREFIX.applications, 'aggregate', applicationId] as const,
  issues: (status: IssueStatus | 'All') => [SWR_KEY_PREFIX.issues, status ?? 'All'] as const,
  calendarApplications: () => [SWR_KEY_PREFIX.applications, 'calendar'] as const,
  outcomeSummary: () => [SWR_KEY_PREFIX.applications, 'determined'] as const,
} as const;

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_PATH}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'API request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export type { ApplicationDto, ApplicationAggregateDto, IssueDto, TimelineEventDto, ExtensionDto };

export async function listApplications(status: ApplicationStatus) {
  const response = await request<{ items: ApplicationDto[]; nextToken?: string }>(
    `/applications?status=${encodeURIComponent(status)}`
  );
  return { ...response, items: sortApplicationsByProjectCode(response.items) };
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
  return request<IssueDto>(`/applications/${applicationId}/issues`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateIssue(applicationId: string, issueId: string, payload: Record<string, unknown>) {
  return request<void>(`/applications/${applicationId}/issues/${issueId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteIssue(applicationId: string, issueId: string) {
  return request<void>(`/applications/${applicationId}/issues/${issueId}`, {
    method: 'DELETE',
  });
}

export async function updateApplication(applicationId: string, payload: Record<string, unknown>) {
  return request<void>(`/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function listIssues(status?: IssueStatus) {
  const search = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<{ items: IssueDto[] }>(`/issues${search}`);
}

export async function createExtension(applicationId: string, payload: Record<string, unknown>) {
  return request<ExtensionDto>(`/applications/${applicationId}/extensions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateExtension(
  applicationId: string,
  extensionId: string,
  payload: Record<string, unknown>
) {
  return request<ExtensionDto>(`/applications/${applicationId}/extensions/${extensionId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

function sortApplicationsByProjectCode(applications: ApplicationDto[]) {
  return [...applications].sort((left, right) =>
    (left.prjCodeName ?? '').localeCompare(right.prjCodeName ?? '', undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
}
