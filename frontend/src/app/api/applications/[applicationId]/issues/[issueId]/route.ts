import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { updateIssue } from '@/server/services/applicationService';

const updateIssueSchema = z
  .object({
    title: z.string().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    raisedBy: z.string().optional().nullable(),
    assignedTo: z.string().optional().nullable(),
    status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']).optional(),
    dueDate: z.string().optional().nullable(),
    resolutionNotes: z.string().optional().nullable(),
    dateResolved: z.string().optional().nullable(),
    dateRaised: z.string().optional(),
  })
  .strict();

function normalise(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function PATCH(request: NextRequest, { params }: { params: { applicationId: string; issueId: string } }) {
  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: 'Payload required' }, { status: 400 });
  }
  const parseResult = updateIssueSchema.safeParse(json);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }
  const payload = parseResult.data;

  try {
    await updateIssue({
      applicationId: params.applicationId,
      issueId: params.issueId,
      updates: {
        ...payload,
        raisedBy: normalise(payload.raisedBy ?? undefined),
        assignedTo: normalise(payload.assignedTo ?? undefined),
        dueDate: normalise(payload.dueDate ?? undefined),
        resolutionNotes: normalise(payload.resolutionNotes ?? undefined),
        dateResolved: normalise(payload.dateResolved ?? undefined),
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to update issue', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
