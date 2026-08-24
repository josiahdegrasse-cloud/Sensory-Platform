import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { isPublicDemoWorkspace, PUBLIC_DEMO_EXTERNAL_ACTION_ERROR } from '../_shared/demo-guard.ts'

interface NotifyBody {
  panelistIds?: string[];
  surveyNames?: string[];
  signInUrl?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const callerToken = authHeader.replace(/^Bearer\s+/i, '');

  // A plain client (no global authorization header) avoids sending both a
  // lowercase "authorization" header and the capitalized "Authorization"
  // header that getUser(jwt) sets internally — the gateway rejects requests
  // with both present, returning an HTML error page instead of JSON.
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user: callerUser }, error: callerUserError } = await authClient.auth.getUser(callerToken);
  if (callerUserError || !callerUser) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  });

  const { data: callerProfile, error: callerProfileError } = await callerClient
    .from('profiles')
    .select('role, status, org_id')
    .eq('id', callerUser.id)
    .single();

  if (callerProfileError || callerProfile?.role !== 'admin' || callerProfile?.status !== 'active' || !callerProfile.org_id) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
  if (await isPublicDemoWorkspace(callerClient, callerProfile.org_id)) {
    return new Response(JSON.stringify({ error: PUBLIC_DEMO_EXTERNAL_ACTION_ERROR }), {
      status: 403,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  // Emails are a courtesy notification, not a guarantee — if the project
  // hasn't configured an email provider yet, skip quietly rather than
  // failing the survey/assignment mutation that triggered this call.
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  if (!resendApiKey || !fromEmail) {
    return new Response(JSON.stringify({ sent: 0, skipped: 'Email notifications are not configured for this project.' }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as NotifyBody;
    const panelistIds = Array.from(new Set(
      (body.panelistIds ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)
    ));
    const surveyNames = (body.surveyNames ?? [])
      .filter((name): name is string => typeof name === 'string' && name.length > 0);

    let signInUrl: string | null = null;
    if (typeof body.signInUrl === 'string') {
      try {
        const parsed = new URL(body.signInUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') signInUrl = parsed.toString();
      } catch {
        // ignore malformed URL — link is omitted below
      }
    }

    if (panelistIds.length === 0 || surveyNames.length === 0 || !signInUrl) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // Multi-tenant: only notify panelists within the caller's organization,
    // even if a stale or cross-tenant id slips into the request body.
    const orgId = (callerProfile as { org_id?: string | null }).org_id ?? null;
    let recipientsQuery = createClient(supabaseUrl, serviceRoleKey)
      .from('profiles')
      .select('id, name, email')
      .in('id', panelistIds)
      .eq('role', 'panelist')
      .eq('status', 'active');
    if (orgId) recipientsQuery = recipientsQuery.eq('org_id', orgId);

    const { data: recipients, error: recipientsError } = await recipientsQuery;
    if (recipientsError) throw recipientsError;

    const surveyCount = surveyNames.length;
    const subject = surveyCount === 1
      ? `New survey ready: ${surveyNames[0]}`
      : `${surveyCount} new surveys ready for you`;
    const surveyListHtml = surveyNames.map(name => `<li>${escapeHtml(name)}</li>`).join('');
    const safeSignInUrl = escapeHtml(signInUrl);

    let sent = 0;
    for (const recipient of recipients ?? []) {
      const email = (recipient as { email?: string | null }).email;
      if (!email) continue;
      const name = (recipient as { name?: string | null }).name || 'there';

      const html = `
        <p>Hi ${escapeHtml(name)},</p>
        <p>You have ${surveyCount} new survey${surveyCount === 1 ? '' : 's'} ready to complete:</p>
        <ul>${surveyListHtml}</ul>
        <p><a href="${safeSignInUrl}">Sign in to get started</a></p>
      `.trim();

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: fromEmail, to: email, subject, html }),
      });
      if (res.ok) sent++;
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
