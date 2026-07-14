import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface InvitePanelistBody {
  email?: string
  redirectTo?: string
}

function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, headers)

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return jsonResponse({ error: 'Missing authorization header' }, 401, headers)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const callerToken = authHeader.replace(/^Bearer\s+/i, '')
  const authClient = createClient(supabaseUrl, anonKey)
  const { data: { user: callerUser }, error: callerError } = await authClient.auth.getUser(callerToken)
  if (callerError || !callerUser) return jsonResponse({ error: 'Forbidden' }, 403, headers)

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  })
  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('role, status, org_id')
    .eq('id', callerUser.id)
    .single()

  if (profileError || callerProfile?.role !== 'admin' || callerProfile?.status !== 'active' || !callerProfile.org_id) {
    return jsonResponse({ error: 'Only active administrators can invite panelists' }, 403, headers)
  }

  let body: InvitePanelistBody
  try {
    body = await req.json() as InvitePanelistBody
  } catch {
    return jsonResponse({ error: 'Invalid request body' }, 400, headers)
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ error: 'Enter a valid email address' }, 400, headers)
  }

  let redirectTo: string
  try {
    const parsed = new URL(body.redirectTo ?? '')
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol')
    if (origin && parsed.origin !== origin) throw new Error('Origin mismatch')
    parsed.pathname = '/panelist/profile'
    parsed.search = ''
    parsed.hash = ''
    redirectTo = parsed.toString()
  } catch {
    return jsonResponse({ error: 'A valid panelist profile URL is required' }, 400, headers)
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: existingProfile } = await adminClient
    .from('profiles')
    .select('id, profile_completed_at')
    .eq('org_id', callerProfile.org_id)
    .eq('email', email)
    .maybeSingle()

  if (existingProfile) {
    return jsonResponse({
      error: existingProfile.profile_completed_at
        ? 'This email already has a panelist account.'
        : 'An invitation has already been created for this email.',
    }, 409, headers)
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      org_id: callerProfile.org_id,
      invited_by: callerUser.id,
      account_type: 'panelist',
    },
  })

  if (error) {
    const message = /already|registered|exists/i.test(error.message)
      ? 'This email already has an account. Ask the panelist to sign in or reset their password.'
      : error.message
    return jsonResponse({ error: message }, 400, headers)
  }

  return jsonResponse({ invited: true, userId: data.user?.id ?? null, email }, 200, headers)
})
