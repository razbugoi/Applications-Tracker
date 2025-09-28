import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiAuthError, requireAuthenticatedTeamMember } from '@/server/auth/guards';
import { createIssue } from '@/server/services/applicationService';
import { toIssueDto } from '@/server/serializers/applicationSerializers';

export const dynamic = 'force-dynamic';

const issueSchema = z.object({
  ppReference: z.string().min(1),
  lpaReference: z.string().optional().nullable(),
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  raisedBy: z.string().optional().nullable(),
  dateRaised: z.string().min(1),
  assignedTo: z.string().optional().nullable(),
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']).optional(),
  dueDate: z.string().optional().nullable(),
});

function normalise(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function POST(request: NextRequest, { params }: { params: { applicationId: string } }) {
  const auth = await authenticate();
  if ('response' in auth) {
    return auth.response;
  }

  const json = await request.json().catch(() => null);
  const parseResult = issueSchema.safeParse(json ?? {});
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }

  const payload = parseResult.data;

  try {
    const issue = await createIssue(auth.context, {
      applicationId: params.applicationId,
      ppReference: payload.ppReference,
      lpaReference: normalise(payload.lpaReference),
      title: payload.title,
      category: payload.category,
      description: payload.description,
      raisedBy: normalise(payload.raisedBy),
      dateRaised: payload.dateRaised,
      assignedTo: normalise(payload.assignedTo),
      status: payload.status,
      dueDate: normalise(payload.dueDate),
    });
    return NextResponse.json(toIssueDto(issue), { status: 201 });
  } catch (error) {
    console.error('Failed to create issue', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
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
