import { NextResponse, type NextRequest } from 'next/server';
import { ApiAuthError, requireAuthenticatedTeamMember } from '@/server/auth/guards';
import { listIssues } from '@/server/services/applicationService';
import { toIssueDto } from '@/server/serializers/applicationSerializers';

export const dynamic = 'force-dynamic';

const issueStatuses = new Set(['Open', 'In Progress', 'Resolved', 'Closed']);

export async function GET(request: NextRequest) {
  const auth = await authenticate();
  if ('response' in auth) {
    return auth.response;
  }

  const statusParam = request.nextUrl.searchParams.get('status');
  const status = statusParam && issueStatuses.has(statusParam) ? statusParam : undefined;
  try {
    const issues = await listIssues(auth.context, status as any);
    return NextResponse.json({ items: issues.map(toIssueDto) });
  } catch (error) {
    console.error('Failed to list issues', error);
    return NextResponse.json({ error: 'Unable to list issues' }, { status: 500 });
  }
}

async function authenticate(): Promise<
  | { context: Awaited<ReturnType<typeof requireAuthenticatedTeamMember>> }
  | { response: NextResponse }
> {
  try {
    const context = await requireAuthenticatedTeamMember();
    return { context };
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return { response: NextResponse.json({ error: error.message }, { status: error.status }) };
    }
    console.error('Unhandled authentication failure', error);
    return { response: NextResponse.json({ error: 'Unable to verify authentication' }, { status: 500 }) };
  }
}
