import type { ScopedMutator } from 'swr/_internal';
import type { IssueDto, IssueStatus } from '@/types/application';
import { APPLICATION_STATUSES, ISSUE_STATUSES } from './applicationConstants';
import { SWR_KEYS } from './api';

const ISSUE_FILTERS: ReadonlyArray<'All' | IssueStatus> = ['All', ...ISSUE_STATUSES];

export async function refreshApplicationCaches(
  globalMutate: ScopedMutator,
  applicationId: string,
  options?: { includeIssues?: boolean }
) {
  const statusMutations = APPLICATION_STATUSES.map((status) => globalMutate(SWR_KEYS.applicationsByStatus(status)));
  const aggregate = globalMutate(SWR_KEYS.applicationAggregate(applicationId));
  const shouldIncludeIssues = options?.includeIssues ?? true;
  const issueMutations = shouldIncludeIssues
    ? ISSUE_FILTERS.map((filter) => globalMutate(SWR_KEYS.issues(filter)))
    : [];
  await Promise.all([...statusMutations, aggregate, ...issueMutations]);
}

export async function mergeIssueIntoCaches(globalMutate: ScopedMutator, issue: IssueDto) {
  const filters = ISSUE_FILTERS.filter((filter) => filter === 'All' || issue.status === filter);
  await Promise.all(
    filters.map((filter) =>
      globalMutate(
        SWR_KEYS.issues(filter),
        (current?: { items: IssueDto[] }) => {
          const existing = current?.items ?? [];
          const nextItems = [issue, ...existing.filter((item) => item.issueId !== issue.issueId)];
          return { items: nextItems };
        },
        {
          revalidate: true,
          populateCache: (result, _current) => {
            if (!result || !Array.isArray(result.items)) {
              return { items: [issue] };
            }
            const alreadyPresent = result.items.some((item) => item.issueId === issue.issueId);
            if (alreadyPresent) {
              return result;
            }
            if (filter === 'All' || issue.status === filter) {
              return { items: [issue, ...result.items] };
            }
            return result;
          },
        }
      )
    )
  );
}
