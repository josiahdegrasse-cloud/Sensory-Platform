/* global process, fetch, console */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const readEnv = path => Object.fromEntries(fs.readFileSync(path, 'utf8').split(/\r?\n/)
  .filter(line => line && !line.startsWith('#') && line.includes('='))
  .map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, '')]; }));
const env = readEnv('.env');
const email = process.env.DEMO_ADMIN_EMAIL;
const password = process.env.DEMO_ADMIN_PASSWORD;
if (!email || !password) {
  throw new Error('Dedicated demo-admin verification credentials are unavailable in the process environment.');
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({ email, password });
if (sessionError) throw sessionError;
const token = sessionData.session.access_token;
const apiBase = process.env.NFI_RAG_URL || 'https://nfi-research-api.vercel.app';
const expectedDocuments = Number(process.env.NFI_EXPECTED_DOCUMENTS || 386);
const maximumLatencyMs = Number(process.env.NFI_MAX_LATENCY_MS || 10_000);
const headers = { Authorization: `Bearer ${token}`, Origin: 'https://sensory-platform.vercel.app' };
const [healthResponse, statusResponse, libraryResponse] = await Promise.all([
  fetch(`${apiBase}/health/ready`),
  fetch(`${apiBase}/api/status`, { headers }),
  fetch(`${apiBase}/api/library/documents`, { headers }),
]);
const health = await healthResponse.json();
const serviceStatus = await statusResponse.json();
const library = await libraryResponse.json();
const { data: decision, error: decisionError } = await supabase
  .from('decision_records')
  .select('id,project_id,sample_id,sample_name,decision,issf_score,evidence_bundle_id,formulation_version_id')
  .eq('decision', 'TWEAK')
  .not('project_id', 'is', null)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
if (decisionError) throw decisionError;

const request = {
  productContext: {
    projectId: decision.project_id,
    productId: decision.sample_id,
    decisionId: decision.id,
    evidenceBundleId: decision.evidence_bundle_id,
    formulationVersionId: decision.formulation_version_id,
    productName: decision.sample_name,
    foodType: 'plant-based cheese',
    productCategory: 'plant-based cheese',
    decision: 'TWEAK',
    issfScore: decision.issf_score,
    dimensionScores: { texture: 69, acceptance: 73, categoryFit: 77 },
    sensoryPanelN: 14,
    defects: ['Texture is the weakest measured dimension'],
    openGates: ['Confirm the texture mechanism before reformulation'],
    currentDecisionReason: 'The product is close to GO, with texture as the measured blocker.',
    intendedReportSection: 'tweak_workplan',
    validationNeeds: ['Run a focused control-plus-variant texture screen'],
    claimsQuestions: [],
  },
  options: { maxCards: 8, minimumRelevance: 0.18 },
};
const started = Date.now();
const response = await fetch(`${apiBase}/api/evidence-assist`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, Origin: 'https://sensory-platform.vercel.app', 'Content-Type': 'application/json' },
  body: JSON.stringify(request),
});
const payload = await response.json();
const literature = (payload.cards ?? []).filter(card => card.sourceType === 'literature' || card.sourceType === 'method');
const unsafe = literature.filter(card => card.claimPermission === 'product_specific' || card.sourcePath == null || !card.contentFingerprint);
const checks = {
  ready: health.status === 'ready',
  corpusDocuments: serviceStatus.document_count,
  corpusChunks: serviceStatus.chunk_count,
  governedDocuments: library.documents?.length,
  approvedDocuments: library.documents?.filter(document => document.reviewStatus === 'approved' && document.licenseStatus === 'cleared').length,
  status: response.status,
  latencyMs: Date.now() - started,
  schemaVersion: payload.schemaVersion,
  canonicalProjectVerified: payload.cards?.some(card => card.sourceType === 'project_evidence'),
  acceptedCards: payload.metadata?.acceptedCount,
  literatureCards: literature.length,
  rejectedSources: payload.rejectedSources?.length ?? 0,
  unsafeCards: unsafe.length,
  qcWarnings: payload.qcWarnings ?? [],
  firstLiteratureTitle: literature[0]?.sourceTitle ?? null,
};
console.log(JSON.stringify(checks, null, 2));
if (!checks.ready || checks.corpusDocuments < expectedDocuments || checks.governedDocuments < expectedDocuments || checks.approvedDocuments < expectedDocuments || checks.latencyMs > maximumLatencyMs || response.status !== 200 || payload.schemaVersion !== 'evidence-assist.v1' || !checks.canonicalProjectVerified || literature.length === 0 || unsafe.length > 0) process.exit(1);
