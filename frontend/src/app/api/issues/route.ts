import { NextResponse, type NextRequest } from 'next/server';
import { listIssues } from '@/server/services/applicationService';
import { toIssueDto } from '@/server/serializers/applicationSerializers';

const issueStatuses = new Set(['Open', 'In Progress', 'Resolved', 'Closed']);

export async function GET(request: NextRequest) {
  const statusParam = request.nextUrl.searchParams.get('status');
  const status = statusParam && issueStatuses.has(statusParam) ? statusParam : undefined;
  try {
    const issues = await listIssues(status as any);
    return NextResponse.json({ items: issues.map(toIssueDto) });
  } catch (error) {
    console.error('Failed to list issues', error);
    return NextResponse.json({ error: 'Unable to list issues' }, { status: 500 });
  }
}
