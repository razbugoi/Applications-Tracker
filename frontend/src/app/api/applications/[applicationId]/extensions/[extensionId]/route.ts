import { NextResponse, type NextRequest } from 'next/server';
import { extensionSchema, normaliseExtensionValue } from '../validation';
import { updateExtensionOfTime } from '@/server/services/applicationService';
import { toExtensionDto } from '@/server/serializers/applicationSerializers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { applicationId: string; extensionId: string } }
) {
  const json = await request.json().catch(() => null);
  const parseResult = extensionSchema.safeParse(json ?? {});
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }

  const payload = parseResult.data;

  try {
    const extension = await updateExtensionOfTime(params.applicationId, params.extensionId, {
      requestedDate: normaliseExtensionValue(payload.requestedDate),
      agreedDate: payload.agreedDate,
      notes: normaliseExtensionValue(payload.notes),
    });
    return NextResponse.json(toExtensionDto(extension));
  } catch (error) {
    console.error('Failed to update extension of time', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
