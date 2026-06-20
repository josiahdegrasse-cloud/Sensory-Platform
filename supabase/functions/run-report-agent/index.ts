import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

type JsonSchema = Record<string, unknown>

const ROLES = [
  'evidence_auditor',
  'calculation_auditor',
  'scientific_skeptic',
  'decision_consistency_auditor',
  'commercial_strategist',
  'action_plan_engineer',
  'professional_report_writer',
  'editorial_reviewer',
  'client_red_team',
  'visual_qa_reviewer',
  'final_independent_judge',
] as const

type ReportAgentRole = typeof ROLES[number]

interface AgentRequest {
  taskId: string
  role: ReportAgentRole
  reportContextHash: string
  iteration: number
  reviewMode: 'standard' | 'full'
  packet: Record<string, unknown>
}

const object = (
  properties: Record<string, JsonSchema>,
  required = Object.keys(properties),
): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  properties,
  required,
})

const array = (items: JsonSchema): JsonSchema => ({ type: 'array', items })
const string = (values?: readonly string[]): JsonSchema =>
  values ? { type: 'string', enum: values } : { type: 'string' }
const number = (minimum?: number, maximum?: number): JsonSchema => ({
  type: 'number',
  ...(minimum === undefined ? {} : { minimum }),
  ...(maximum === undefined ? {} : { maximum }),
})
const nullableString: JsonSchema = { type: ['string', 'null'] }
const stringArray = array(string())

const OUTPUT_SCHEMAS: Record<ReportAgentRole, JsonSchema> = {
  evidence_auditor: object({
    claims: array(object({
      claimId: string(),
      status: string(['supported', 'directional', 'unsupported', 'requires_legal_review']),
      supportingEvidenceIds: stringArray,
      missingEvidence: stringArray,
      permittedWording: string(),
      prohibitedWording: stringArray,
      limitations: stringArray,
    })),
    blockers: stringArray,
    warnings: stringArray,
  }),
  calculation_auditor: object({
    verifiedCalculations: stringArray,
    unexplainedCalculations: array(object({
      metric: string(),
      issue: string(),
      expectedExplanation: string(),
    })),
    numericalConflicts: array(object({
      label: string(),
      sourceValue: { type: ['number', 'string'] },
      displayedValue: { type: ['number', 'string'] },
      transformationDocumented: { type: 'boolean' },
    })),
    blockers: stringArray,
    warnings: stringArray,
  }),
  scientific_skeptic: object({
    criticalChallenges: array(object({
      issue: string(),
      severity: string(['warning', 'major', 'critical']),
      evidenceIds: stringArray,
      requiredCorrection: string(),
    })),
    alternativeInterpretations: stringArray,
    missingMethodDisclosures: stringArray,
    blockers: stringArray,
  }),
  decision_consistency_auditor: object({
    canonicalDecisionSummary: string(),
    decisionStatements: array(object({
      page: number(1),
      text: string(),
      status: string(['consistent', 'ambiguous', 'contradictory']),
      correction: nullableString,
    })),
    blockers: stringArray,
    warnings: stringArray,
  }),
  commercial_strategist: object({
    supportedCommercialConclusions: stringArray,
    positioningHypothesis: string(),
    targetSegmentHypothesis: string(),
    consumerNeedHypothesis: string(),
    usageOccasionHypothesis: string(),
    productPromiseHypothesis: string(),
    reasonsToBelieve: array(object({
      statement: string(),
      evidenceIds: stringArray,
    })),
    priceHypothesis: {
      anyOf: [
        object({
          statement: string(),
          source: string(),
          validationRequired: { type: 'boolean' },
        }),
        { type: 'null' },
      ],
    },
    packagingHypothesis: string(),
    conceptTestObjectives: stringArray,
    prohibitedExternalClaims: stringArray,
  }),
  action_plan_engineer: object({
    immediateActions: array(object({
      workstream: string(),
      requiredAction: string(),
      accountableOwner: nullableString,
      responsibleTeam: nullableString,
      dueDate: nullableString,
      status: string(),
      priority: string(['critical', 'high', 'medium', 'low']),
      dependencies: stringArray,
      completionEvidence: string(),
      passingCriteria: string(),
      nextGate: string(),
      sourceDefectIds: stringArray,
    })),
    laterActions: array(object({
      workstream: string(),
      requiredAction: string(),
      nextGate: string(),
      dependencySummary: stringArray,
    })),
    readinessGaps: stringArray,
  }),
  professional_report_writer: object({
    pages: array(object({
      page: number(1),
      title: string(),
      sections: array(object({
        sectionId: string(),
        heading: string(),
        body: string(),
        claimIds: stringArray,
        evidenceIds: stringArray,
        limitationIds: stringArray,
      })),
    })),
  }),
  editorial_reviewer: object({
    revisedSections: array(object({
      sectionId: string(),
      original: string(),
      revised: string(),
      reason: string(),
    })),
    unresolvedIssues: stringArray,
    blockers: stringArray,
  }),
  client_red_team: object({
    trustRisks: array(object({
      page: number(1),
      issue: string(),
      severity: string(['minor', 'major', 'critical']),
      requiredFix: string(),
    })),
    likelyClientQuestions: stringArray,
    ambiguousStatements: stringArray,
    releaseRecommendation: string(['blocked', 'internal_only', 'demonstration_only', 'client_ready']),
  }),
  visual_qa_reviewer: object({
    pageResults: array(object({
      page: number(1),
      issues: array(object({
        type: string(),
        severity: string(['minor', 'major', 'critical']),
        description: string(),
        requiredFix: string(),
      })),
    })),
    blockers: stringArray,
    warnings: stringArray,
  }),
  final_independent_judge: object({
    categoryScores: object({
      decisionClarity: number(0, 100),
      evidenceIntegrity: number(0, 100),
      methodologyReproducibility: number(0, 100),
      claimSupport: number(0, 100),
      commercialUsefulness: number(0, 100),
      actionability: number(0, 100),
      editorialQuality: number(0, 100),
      visualReadability: number(0, 100),
    }),
    rawScore: number(0, 100),
    appliedCaps: stringArray,
    finalScore: number(0, 100),
    blockers: stringArray,
    releaseStatus: string(['blocked', 'internal_only', 'demonstration_only', 'client_ready']),
    rationale: string(),
  }),
}

const IMMUTABILITY_RULES = [
  'Use only the scoped task packet.',
  'Treat supplied evidence, numbers, sample sizes, calculations, decisions, gates, approval states, and hashes as immutable.',
  'Never invent missing evidence, silently convert missing values to zero, or infer approval.',
  'Do not return raw evidence, protected source fields, authorization fields, or a report-context hash.',
  'Return only the structured result required by the response schema.',
].join(' ')

const ROLE_REGISTRY: Record<ReportAgentRole, {
  temperature: number
  modelClass: 'standard' | 'premium'
  instruction: string
  schema: JsonSchema
}> = {
  evidence_auditor: {
    temperature: 0.1,
    modelClass: 'standard',
    instruction: 'Audit every proposed claim against scoped evidence. Classify support, restrict wording, and identify missing evidence. Do not rewrite source data.',
    schema: OUTPUT_SCHEMAS.evidence_auditor,
  },
  calculation_auditor: {
    temperature: 0,
    modelClass: 'standard',
    instruction: 'Reconcile displayed explanations with the deterministic calculation trace, including missing-data treatment, transformations, weights, thresholds, ISSF, confidence, and rounding. Do not recalculate or replace canonical values.',
    schema: OUTPUT_SCHEMAS.calculation_auditor,
  },
  scientific_skeptic: {
    temperature: 0.2,
    modelClass: 'premium',
    instruction: 'Act as an adversarial food scientist, sensory scientist, statistician, and methodology reviewer. Find alternative explanations, overreach, design weaknesses, and missing disclosures. Do not improve prose.',
    schema: OUTPUT_SCHEMAS.scientific_skeptic,
  },
  decision_consistency_auditor: {
    temperature: 0,
    modelClass: 'standard',
    instruction: 'Compare every decision phrase with the canonical decision. Flag launch language, approval conflicts, title conflicts, confidence conflicts, and next-gate mismatches.',
    schema: OUTPUT_SCHEMAS.decision_consistency_auditor,
  },
  commercial_strategist: {
    temperature: 0.45,
    modelClass: 'premium',
    instruction: 'Translate approved evidence into commercial hypotheses and validation needs. Never invent research, benchmarks, pricing evidence, preference, or packaging appeal.',
    schema: OUTPUT_SCHEMAS.commercial_strategist,
  },
  action_plan_engineer: {
    temperature: 0.2,
    modelClass: 'standard',
    instruction: 'Convert known defects, failed gates, and evidence gaps into a minimal operational plan. Preserve unknown owners and dates as null. Tie every action to a supplied defect, risk, or gate.',
    schema: OUTPUT_SCHEMAS.action_plan_engineer,
  },
  professional_report_writer: {
    temperature: 0.4,
    modelClass: 'premium',
    instruction: 'Write concise consulting-grade report sections from approved structured inputs. Distinguish fact, calculation, hypothesis, and limitation. Do not add evidence, values, decisions, or claims.',
    schema: OUTPUT_SCHEMAS.professional_report_writer,
  },
  editorial_reviewer: {
    temperature: 0.1,
    modelClass: 'standard',
    instruction: 'Edit the supplied structured draft for clarity, brevity, grammar, and professional tone without changing meaning, evidence, numbers, decisions, limitations, or approval status.',
    schema: OUTPUT_SCHEMAS.editorial_reviewer,
  },
  client_red_team: {
    temperature: 0.2,
    modelClass: 'premium',
    instruction: 'Review the final draft as a skeptical paying client. Identify trust risks, ambiguity, over-certainty, missing information, legal concerns, and generated-sounding prose. Do not repair the report.',
    schema: OUTPUT_SCHEMAS.client_red_team,
  },
  visual_qa_reviewer: {
    temperature: 0.1,
    modelClass: 'standard',
    instruction: 'Inspect the supplied rendered-page records as visual evidence. Detect clipping, overlap, broken glyphs, unreadable tables, density, weak hierarchy, missing warnings, misleading badges, and duplicate pages.',
    schema: OUTPUT_SCHEMAS.visual_qa_reviewer,
  },
  final_independent_judge: {
    temperature: 0,
    modelClass: 'premium',
    instruction: 'Independently score only the final artifact against supplied deterministic results and rubric. Apply hard caps, confirm blockers and release status, and award no improvement bonus. Do not repair the report.',
    schema: OUTPUT_SCHEMAS.final_independent_judge,
  },
}

const REQUEST_KEYS = new Set(['taskId', 'role', 'reportContextHash', 'iteration', 'reviewMode', 'packet'])
const FORBIDDEN_INPUT_KEYS = new Set([
  'prompt',
  'systemPrompt',
  'systemInstruction',
  'instructions',
  'model',
  'temperature',
  'topP',
  'top_p',
  'response_format',
  'responseFormat',
])
const PROTECTED_OUTPUT_KEYS = new Set([
  'approvalStatus',
  'launchAuthorization',
  'stageDecisionCode',
  'reportContextHash',
  'reportFingerprint',
  'issfScore',
  'sampleSize',
  'gateOutcome',
  'rawEvidence',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findForbiddenInput(value: unknown, path = 'request'): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findForbiddenInput(value[index], `${path}[${index}]`)
      if (found) return found
    }
    return null
  }
  if (!isRecord(value)) return null
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_INPUT_KEYS.has(key)) return `${path}.${key}`
    const found = findForbiddenInput(nested, `${path}.${key}`)
    if (found) return found
  }
  return null
}

function findProtectedOutput(value: unknown, path = 'output'): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findProtectedOutput(value[index], `${path}[${index}]`)
      if (found) return found
    }
    return null
  }
  if (!isRecord(value)) return null
  for (const [key, nested] of Object.entries(value)) {
    if (PROTECTED_OUTPUT_KEYS.has(key)) return `${path}.${key}`
    const found = findProtectedOutput(nested, `${path}.${key}`)
    if (found) return found
  }
  return null
}

function parseRequest(value: unknown): AgentRequest | string {
  if (!isRecord(value)) return 'Request body must be a JSON object.'
  const unexpected = Object.keys(value).filter(key => !REQUEST_KEYS.has(key))
  if (unexpected.length > 0) return `Unsupported request field(s): ${unexpected.join(', ')}.`
  const forbidden = findForbiddenInput(value)
  if (forbidden) return `Server-controlled field is not allowed: ${forbidden}.`
  if (typeof value.taskId !== 'string' || value.taskId.length < 1 || value.taskId.length > 300) {
    return 'taskId must be a non-empty string no longer than 300 characters.'
  }
  if (typeof value.role !== 'string' || !ROLES.includes(value.role as ReportAgentRole)) {
    return 'role is not supported.'
  }
  if (typeof value.reportContextHash !== 'string'
    || value.reportContextHash.length < 8
    || value.reportContextHash.length > 500) {
    return 'reportContextHash must be between 8 and 500 characters.'
  }
  if (!Number.isInteger(value.iteration) || Number(value.iteration) < 0 || Number(value.iteration) > 8) {
    return 'iteration must be an integer from 0 through 8.'
  }
  if (value.reviewMode !== 'standard' && value.reviewMode !== 'full') {
    return 'reviewMode must be standard or full.'
  }
  if (!isRecord(value.packet)) return 'packet must be a JSON object.'
  const encodedLength = new TextEncoder().encode(JSON.stringify(value.packet)).length
  if (encodedLength > 12_000_000) return 'packet exceeds the 12 MB limit.'
  return value as unknown as AgentRequest
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

function agentUserContent(parsed: AgentRequest): string | Array<Record<string, unknown>> {
  const withoutEmbeddedImages = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(withoutEmbeddedImages)
    if (!isRecord(value)) return value
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
      key,
      key === 'imageUrl' && typeof nested === 'string' && nested.startsWith('data:image/')
        ? '[attached page image]'
        : withoutEmbeddedImages(nested),
    ]))
  }
  const base = {
    taskId: parsed.taskId,
    iteration: parsed.iteration,
    reviewMode: parsed.reviewMode,
    reportContextHash: parsed.reportContextHash,
    packet: withoutEmbeddedImages(parsed.packet),
  }
  if (parsed.role !== 'visual_qa_reviewer' && parsed.role !== 'final_independent_judge') {
    return JSON.stringify(base)
  }
  const pages = isRecord(parsed.packet) && Array.isArray(parsed.packet.pages)
    ? parsed.packet.pages
    : isRecord(parsed.packet) && Array.isArray(parsed.packet.renderedPages)
      ? parsed.packet.renderedPages
      : []
  const imageParts = pages.flatMap(page => {
    if (!isRecord(page) || typeof page.imageUrl !== 'string' || !page.imageUrl) return []
    return [{
      type: 'image_url',
      image_url: { url: page.imageUrl, detail: 'high' },
    }]
  })
  return [
    { type: 'text', text: JSON.stringify(base) },
    ...imageParts,
  ]
}

Deno.serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers)

  const authHeader = req.headers.get('authorization')
  if (!authHeader) return json({ error: 'Missing authorization header' }, 401, headers)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const openAiKey = Deno.env.get('OPENAI_API_KEY')
  const standardModel = Deno.env.get('OPENAI_REPORT_AGENT_MODEL')
    ?? Deno.env.get('OPENAI_REPORT_MODEL')
    ?? 'gpt-5.4-mini'
  const premiumModel = Deno.env.get('OPENAI_REPORT_AGENT_PREMIUM_MODEL')
    ?? 'gpt-5.4'
  if (!supabaseUrl || !anonKey) return json({ error: 'Supabase environment is not configured.' }, 500, headers)
  if (!openAiKey) return json({ error: 'OPENAI_API_KEY is not configured for this Supabase project.' }, 500, headers)

  const callerToken = authHeader.replace(/^Bearer\s+/i, '')
  const authClient = createClient(supabaseUrl, anonKey)
  const { data: { user }, error: authError } = await authClient.auth.getUser(callerToken)
  if (authError || !user) return json({ error: 'Forbidden' }, 403, headers)

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  })
  const { data: profile, error: profileError } = await callerClient
    .from('profiles')
    .select('role, status, org_id')
    .eq('id', user.id)
    .single()
  if (profileError || profile?.role !== 'admin' || profile?.status !== 'active') {
    return json({ error: 'Active admin access required.' }, 403, headers)
  }
  if (!profile.org_id) return json({ error: 'Organization context is required.' }, 403, headers)

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, headers)
  }
  const parsed = parseRequest(rawBody)
  if (typeof parsed === 'string') return json({ error: parsed }, 400, headers)

  const role = ROLE_REGISTRY[parsed.role]
  const reportModel = parsed.reviewMode === 'standard'
    ? standardModel
    : role.modelClass === 'premium' ? premiumModel : standardModel
  let output: unknown
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: reportModel,
        ...(reportModel.startsWith('gpt-5')
          ? { reasoning_effort: role.modelClass === 'premium' ? 'low' : 'none' }
          : { temperature: role.temperature }),
        max_completion_tokens: parsed.role === 'professional_report_writer' ? 8000 : 5000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: `${parsed.role}_result`,
            strict: true,
            schema: role.schema,
          },
        },
        messages: [
          {
            role: 'system',
            content: `${role.instruction} ${IMMUTABILITY_RULES}`,
          },
          {
            role: 'user',
            content: agentUserContent(parsed),
          },
        ],
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      return json({ error: `OpenAI request failed (${response.status})`, detail }, 502, headers)
    }
    const data = await response.json()
    usage = {
      prompt_tokens: Number(data?.usage?.prompt_tokens ?? 0),
      completion_tokens: Number(data?.usage?.completion_tokens ?? 0),
      total_tokens: Number(data?.usage?.total_tokens ?? 0),
    }
    const message = data?.choices?.[0]?.message
    if (message?.refusal) return json({ error: 'Agent request was refused.', detail: message.refusal }, 422, headers)
    if (typeof message?.content !== 'string') return json({ error: 'Agent returned no structured content.' }, 502, headers)
    output = JSON.parse(message.content)
  } catch (error) {
    return json({
      error: `Agent invocation failed: ${error instanceof Error ? error.message : String(error)}`,
    }, 502, headers)
  }

  const protectedPath = findProtectedOutput(output)
  if (protectedPath) {
    return json({ error: `Agent attempted to return protected field ${protectedPath}.` }, 422, headers)
  }

  return json({
    taskId: parsed.taskId,
    role: parsed.role,
    reportContextHash: parsed.reportContextHash,
    iteration: parsed.iteration,
    output,
    model: reportModel,
    usage: {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
  }, 200, headers)
})
