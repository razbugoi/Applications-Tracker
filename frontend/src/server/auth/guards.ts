import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import type { User } from '@supabase/supabase-js';

export class ApiAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface AuthenticatedRequestContext {
  userId: User['id'];
  teamId: string;
}

export async function requireAuthenticatedTeamMember(): Promise<AuthenticatedRequestContext> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new ApiAuthError(500, 'Unable to verify authentication');
  }

  const user = data?.user;
  if (!user) {
    throw new ApiAuthError(401, 'Authentication required');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    throw new ApiAuthError(500, 'Unable to verify team membership');
  }

  if (!profile?.team_id) {
    throw new ApiAuthError(403, 'Your account is not assigned to a team');
  }

  return { userId: user.id, teamId: profile.team_id };
}
