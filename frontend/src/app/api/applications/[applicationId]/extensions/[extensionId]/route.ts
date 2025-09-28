import { NextResponse, type NextRequest } from 'next/server';
import { extensionSchema, normaliseExtensionValue } from '../validation';
import { ApiAuthError, requireAuthenticatedTeamMember } from '@/server/auth/guards';
import { updateExtensionOfTime } from '@/server/services/applicationService';
import { toExtensionDto } from '@/server/serializers/applicationSerializers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { applicationId: string; extensionId: string } }
) {
  const auth = await authenticate();
  if ('response' in auth) {
    return auth.response;
  }

  const json = await request.json().catch(() => null);
  const parseResult = extensionSchema.safeParse(json ?? {});
  if (!parseResult.success) {
    return NextResponse.json({ error: parseResult.error.issues }, { status: 400 });
  }

  const payload = parseResult.data;

  try {
    const extension = await updateExtensionOfTime(auth.context, params.applicationId, params.extensionId, {
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
