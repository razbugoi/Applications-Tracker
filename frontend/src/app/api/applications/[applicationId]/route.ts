import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiAuthError, requireAuthenticatedTeamMember } from '@/server/auth/guards';
import { deleteApplication, getApplication, patchApplication } from '@/server/services/applicationService';
import type { ApplicationOutcome, ApplicationStatus } from '@/server/models/application';
import { toApplicationAggregateDto } from '@/server/serializers/applicationSerializers';

export const dynamic = 'force-dynamic';

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
  const auth = await authenticate();
  if ('response' in auth) {
    return auth.response;
  }

  try {
    const aggregate = await getApplication(auth.context, params.applicationId);
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
  const auth = await authenticate();
  if ('response' in auth) {
    return auth.response;
  }

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
    await patchApplication(auth.context, params.applicationId, {
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

export async function DELETE(_request: NextRequest, { params }: { params: { applicationId: string } }) {
  const auth = await authenticate();
  if ('response' in auth) {
    return auth.response;
  }

  try {
    await deleteApplication(auth.context, params.applicationId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if ((error as Error).message === 'Application not found') {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    console.error('Failed to delete application', error);
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
