import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

// ════════════════════════════════════════════════════════════════════════════
// generate-report-narrative — AI prose for a commercialization report,
// constrained to the deterministic evidence bundle. The model may only cite
// evidence ids supplied per section; the client-side evaluator rejects any
// section that hallucinates a citation. Deterministic narrative remains the
// fallback when this function or OPENAI_API_KEY is unavailable.
// ════════════════════════════════════════════════════════════════════════════

interface SectionPlan {
  key: string;
  title: string;
  guidance: string;
  evidenceIds: string[];
  evidenceBacked: boolean;
  claimStatements?: string[];
}

interface NarrativeBody {
  plan?: { headline?: string; candidateDecision?: string; confidence?: string; sections?: SectionPlan[] };
  evidence?: { id: string; title: string; description: string }[];
  revisionIssues?: string[];
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);

  const authHeader = req.headers.get('authorization');
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401, headers);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const reportModel = Deno.env.get('OPENAI_REPORT_MODEL') ?? 'gpt-4o';
  if (!openAiKey) return json({ error: 'OPENAI_API_KEY is not configured for this Supabase project.' }, 500, headers);

  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  const authClient = createClient(supabaseUrl, anonKey);
  const { data: { user: callerUser }, error: authError } = await authClient.auth.getUser(callerToken);
  if (authError || !callerUser) return json({ error: 'Forbidden' }, 403, headers);

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { authorization: authHeader } } });
  const { data: profile, error: profileError } = await callerClient
    .from('profiles')
    .select('role, status')
    .eq('id', callerUser.id)
    .single();
  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') {
    return json({ error: 'Admin access required' }, 403, headers);
  }

  let body: NarrativeBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, headers);
  }

  const sections = (body.plan?.sections ?? []).filter(s => s && typeof s.key === 'string');
  if (sections.length === 0) return json({ error: 'plan.sections is required' }, 400, headers);
  const evidence = body.evidence ?? [];
  const validEvidenceIds = new Set(evidence.map(e => e.id));

  const evidenceCatalog = evidence
    .map(e => `- ${e.id}: ${e.title} — ${e.description}`)
    .join('\n');

  const sectionSpec = sections.map(s => ({
    key: s.key,
    title: s.title,
    guidance: s.guidance,
    allowedEvidenceIds: s.evidenceBacked ? s.evidenceIds : [],
    evidenceBacked: s.evidenceBacked,
    claimStatements: s.claimStatements ?? [],
  }));

  const system = [
    'You are a sensory-science commercialization analyst writing a client-ready report.',
    'Rules you MUST follow exactly:',
    '1. Use ONLY the evidence ids supplied for each section. Never invent ids or facts.',
    '2. Every sentence that makes a claim must cite at least one evidence id inline in the form [evidence:<id>].',
    '3. For sections marked evidenceBacked=false (e.g. packaging), do not fabricate data; write only from the provided guidance, with no [evidence:] citations.',
    '4. If a section has no allowed evidence ids and is evidenceBacked=true, return an empty string for it.',
    '5. Be concise and factual. No marketing hyperbole that the evidence does not support.',
    // Anti-boilerplate and grounding rules — these target the specific failure
    // modes that made earlier drafts read as generic, hedged, or unsupported.
    '6. NEVER use hedged or conditional filler such as "depending on the food type", "various factors", "in general", "may or may not", or "could potentially". Write specifically about THIS product using the supplied evidence and descriptors.',
    '7. Do NOT state a demographic, target consumer, price point, or market-size claim unless the evidence supports it. If it is not in the evidence, write "Not yet determined — requires segmented panel data" instead of guessing a number or range.',
    '8. When concept descriptors or response counts indicate no/low data (e.g. n=0), say so plainly; do not imply consumer validation that did not happen.',
    '9. Prefer the exact panelist/sensory descriptor words supplied over invented marketing adjectives.',
    body.revisionIssues && body.revisionIssues.length > 0
      ? `Revision required — fix these issues from the previous draft:\n${body.revisionIssues.map(i => `- ${i}`).join('\n')}`
      : '',
    'Return a JSON object: {"sections": { "<key>": "<markdown text>", ... }}.',
  ].filter(Boolean).join('\n');

  const user = JSON.stringify({
    headline: body.plan?.headline ?? '',
    candidateDecision: body.plan?.candidateDecision ?? '',
    confidence: body.plan?.confidence ?? '',
    sections: sectionSpec,
    evidenceCatalog,
  });

  let aiSections: Record<string, string> = {};
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: reportModel,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return json({ error: `OpenAI request failed (${res.status})`, detail }, 502, headers);
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    aiSections = (parsed && typeof parsed.sections === 'object') ? parsed.sections : {};
  } catch (err) {
    return json({ error: `Narrative generation failed: ${err instanceof Error ? err.message : String(err)}` }, 502, headers);
  }

  // Server-side citation guard: strip any [evidence:<id>] that isn't in the bundle.
  const citationRe = /\[evidence:([^\]]+)\]/g;
  const cleaned: Record<string, string> = {};
  for (const section of sections) {
    const raw = typeof aiSections[section.key] === 'string' ? aiSections[section.key] : '';
    cleaned[section.key] = raw.replace(citationRe, (match, id) =>
      validEvidenceIds.has(String(id).trim()) ? match : '');
  }

  return json({ sections: cleaned, model: reportModel }, 200, headers);
});
