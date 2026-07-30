/* global console, process */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail, parseArgs, readJson, root } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.candidate) fail('Usage: --candidate <candidate.json>');
const path = resolve(root, String(args.candidate));
if (!existsSync(path)) fail(`Candidate not found: ${args.candidate}`);
const candidate = JSON.parse(readFileSync(path, 'utf8'));
const config = readJson('agent-system/config.json');
for (const key of ['id','rule','rootCause','confidence','scope','tags','evidenceRuns']) if (!(key in candidate)) fail(`Candidate lacks ${key}`);
if (candidate.confidence < config.truthThreshold) fail('Candidate confidence is below threshold.', 1);
const sensitive = candidate.tags.some((tag) => config.sensitiveTags.includes(tag));
const requiredRuns = sensitive ? config.sensitiveEvidenceRuns : config.minimumEvidenceRuns;
if (new Set(candidate.evidenceRuns).size < requiredRuns) fail(`Candidate needs ${requiredRuns} distinct evidence runs.`, 1);
const verdicts = candidate.evidenceRuns.map((runPath) => {
  const evidencePath = resolve(root, runPath);
  if (!existsSync(evidencePath)) fail(`Evidence verdict not found: ${runPath}`, 1);
  const verdict = JSON.parse(readFileSync(evidencePath, 'utf8'));
  if (verdict.verdict !== 'PASS' || verdict.score?.truthScore < config.truthThreshold || verdict.score?.coverage !== 1) fail(`Evidence is not a complete PASS: ${runPath}`, 1);
  return verdict;
});
if (new Set(verdicts.map(({ runId }) => runId)).size < requiredRuns) fail(`Candidate needs ${requiredRuns} distinct passing run IDs.`, 1);
if ((candidate.scope === 'global' || sensitive) && !args['human-approved']) fail('Human approval is required for global or sensitive promotion.', 1);
const forbidden = /(password|secret|token|jwt|signed url|panelist|raw response)/i;
if (forbidden.test(JSON.stringify(candidate))) fail('Candidate contains potentially sensitive material.', 1);

const line = `- ${new Date().toISOString().slice(0,10)} [${candidate.id}] ${candidate.rule} (confidence ${candidate.confidence}; evidence ${verdicts.map(({runId})=>runId).join(', ')})\n`;
const statePath = resolve(root, 'STATE.md');
const state = readFileSync(statePath, 'utf8');
const marker = '## Last session';
if (!state.includes(marker)) fail('STATE.md lacks the Last session marker.');
writeFileSync(statePath, state.replace(marker, `${line}\n${marker}`));
appendFileSync(resolve(root, 'agent-system/state/promoted.jsonl'), `${JSON.stringify({...candidate,promotedAt:new Date().toISOString()})}\n`);
console.log(JSON.stringify({ promoted:true, state:'STATE.md', memoryNamespace:'sensory-platform/verified-patterns', sanitizedPayload:{id:candidate.id,rule:candidate.rule,scope:candidate.scope,confidence:candidate.confidence,evidenceRuns:candidate.evidenceRuns} }, null, 2));
