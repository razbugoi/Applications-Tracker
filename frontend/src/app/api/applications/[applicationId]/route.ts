import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getApplication, patchApplication } from '@/server/services/applicationService';
import type { ApplicationOutcome, ApplicationStatus } from '@/server/models/application';
import { toApplicationAggregateDto } from '@/server/serializers/applicationSerializers';

const statusValues = ['Submitted', 'Invalidated', 'Live', 'Determined'] as const;
const outcomeValues = ['Approved', 'Refused', 'Withdrawn', 'Pending', 'NotApplicable'] as const;

const updateSchema = z
  .object({
    status: z.enum(statusValues).optional(),
    validationDate: z.string().optional().nullable(),
    determinationDate: z.string().optional().nullable(),
    eotDate: z.string().optional().nullable(),
    caseOfficer: z.string().optional().nullable(),
    caseOfficerEmail: z.string().email().optional().nullable(),
    outcome: z.enum(outcomeValues).optional(),
    notes: z.string().optional().nullable(),
    council: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    lpaReference: z.string().optional().nullable(),
    planningPortalUrl: z.string().url().optional().nullable(),
  })
  .strict();

function normalise(value: string | null | undefined) {
  if (value == null) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function GET(_request: NextRequest, { params }: { params: { applicationId: string } }) {
  try {
    const aggregate = await getApplication(params.applicationId);
    if (!aggregate) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    return NextResponse.json(toApplicationAggregateDto(aggregate));
  } catch (error) {
    console.error('Failed to fetch application', error);
    return NextResponse.json({ error: 'Unable to fetch application' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { applicationId: string } }) {
  const json = await request.json().catch(() => null);
  if (!json) {
    return NextResponse.json({ error: 'Payload required' }, { status: 400 });
  }
  const parseResult = updateSchema.safeParse(json);
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }

  const payload = parseResult.data;

  try {
    await patchApplication(params.applicationId, {
      status: payload.status,
      validationDate: normalise(payload.validationDate ?? undefined),
      determinationDate: normalise(payload.determinationDate ?? undefined),
      eotDate: normalise(payload.eotDate ?? undefined),
      caseOfficer: normalise(payload.caseOfficer ?? undefined),
      caseOfficerEmail: normalise(payload.caseOfficerEmail ?? undefined),
      outcome: payload.outcome,
      notes: normalise(payload.notes ?? undefined),
      council: normalise(payload.council ?? undefined),
      description: normalise(payload.description ?? undefined),
      lpaReference: normalise(payload.lpaReference ?? undefined),
      planningPortalUrl: normalise(payload.planningPortalUrl ?? undefined),
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Failed to update application', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
