import { NextResponse, type NextRequest } from 'next/server';
import { ApiAuthError, requireAuthenticatedTeamMember } from '@/server/auth/guards';
import { createExtensionOfTime } from '@/server/services/applicationService';
import { toExtensionDto } from '@/server/serializers/applicationSerializers';
import { extensionSchema, normaliseExtensionValue } from './validation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { applicationId: string } }) {
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
    const extension = await createExtensionOfTime(auth.context, params.applicationId, {
      requestedDate: normaliseExtensionValue(payload.requestedDate),
      agreedDate: payload.agreedDate,
      notes: normaliseExtensionValue(payload.notes),
    });
    return NextResponse.json(toExtensionDto(extension), { status: 201 });
  } catch (error) {
    console.error('Failed to create extension of time', error);
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
