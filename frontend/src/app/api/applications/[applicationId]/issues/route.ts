import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createIssue } from '@/server/services/applicationService';
import { toIssueDto } from '@/server/serializers/applicationSerializers';

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
  const json = await request.json().catch(() => null);
  const parseResult = issueSchema.safeParse(json ?? {});
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }

  const payload = parseResult.data;

  try {
    const issue = await createIssue({
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
