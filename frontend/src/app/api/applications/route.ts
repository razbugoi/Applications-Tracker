import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createApplication, listApplications } from '@/server/services/applicationService';
import type { ApplicationStatus } from '@/server/models/application';
import { toApplicationDto } from '@/server/serializers/applicationSerializers';

const statusValues = ['Submitted', 'Invalidated', 'Live', 'Determined'] as const;
const statusSet = new Set<ApplicationStatus>(statusValues);

const createApplicationSchema = z.object({
  prjCodeName: z.string().min(1),
  ppReference: z.string().min(1),
  lpaReference: z.string().optional().nullable(),
  description: z.string().min(1),
  council: z.string().min(1),
  submissionDate: z.string().min(1),
  validationDate: z.string().optional().nullable(),
  caseOfficer: z.string().optional().nullable(),
  caseOfficerEmail: z.string().email().optional().nullable(),
  determinationDate: z.string().optional().nullable(),
  eotDate: z.string().optional().nullable(),
  planningPortalUrl: z.string().url().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function normaliseValue<T extends string | null | undefined>(value: T): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.toString().trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status');
  if (!status || !statusSet.has(status as ApplicationStatus)) {
    return NextResponse.json({ error: 'Query parameter "status" is required' }, { status: 400 });
  }

  try {
    const result = await listApplications(status as ApplicationStatus);
    const items = result.items.map(toApplicationDto);
    return NextResponse.json({ items, nextToken: result.next });
  } catch (error) {
    console.error('Failed to list applications', error);
    return NextResponse.json({ error: 'Unable to list applications' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const json = await request.json().catch(() => null);
  const parseResult = createApplicationSchema.safeParse(json ?? {});
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }
  const payload = parseResult.data;

  try {
    const application = await createApplication({
      prjCodeName: payload.prjCodeName,
      ppReference: payload.ppReference,
      lpaReference: normaliseValue(payload.lpaReference),
      description: payload.description,
      council: payload.council,
      submissionDate: payload.submissionDate,
      validationDate: normaliseValue(payload.validationDate),
      caseOfficer: normaliseValue(payload.caseOfficer),
      caseOfficerEmail: normaliseValue(payload.caseOfficerEmail),
      determinationDate: normaliseValue(payload.determinationDate),
      eotDate: normaliseValue(payload.eotDate),
      planningPortalUrl: normaliseValue(payload.planningPortalUrl),
      notes: normaliseValue(payload.notes),
    });
    return NextResponse.json(toApplicationDto(application), { status: 201 });
  } catch (error) {
    console.error('Failed to create application', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
