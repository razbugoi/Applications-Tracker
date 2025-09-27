import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createExtensionOfTime } from '@/server/services/applicationService';
import { toExtensionDto } from '@/server/serializers/applicationSerializers';

const extensionSchema = z.object({
  requestedDate: z.string().optional().nullable(),
  agreedDate: z.string().min(1),
  notes: z.string().optional().nullable(),
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
  const parseResult = extensionSchema.safeParse(json ?? {});
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }

  const payload = parseResult.data;

  try {
    const extension = await createExtensionOfTime(params.applicationId, {
      requestedDate: normalise(payload.requestedDate),
      agreedDate: payload.agreedDate,
      notes: normalise(payload.notes),
    });
    return NextResponse.json(toExtensionDto(extension), { status: 201 });
  } catch (error) {
    console.error('Failed to create extension of time', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
