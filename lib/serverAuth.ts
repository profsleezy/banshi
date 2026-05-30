import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type ServerAuthContext = {
  user: any
  authClient: SupabaseClient
  db: SupabaseClient
}

export type ServerAuthResult =
  | { ok: true; context: ServerAuthContext; status?: undefined; error?: undefined }
  | { ok: false; status: number; error: string }

export function getBearerToken(req: Request) {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

export async function getServerAuthContext(req: Request, adminClient?: SupabaseClient | null): Promise<ServerAuthResult> {
  const token = getBearerToken(req)
  if (!token) return { ok: false, status: 401, error: 'Missing authorization token' }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, error: 'Supabase env vars missing' }
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await authClient.auth.getUser(token)
  const user = data?.user
  if (error || !user) return { ok: false, status: 401, error: 'Unauthorized' }

  return { ok: true, context: { user, authClient, db: adminClient ?? authClient } }
}
