/* global console, process */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEvals, readJson, root } from './lib.mjs';

const errors = [];
const required = ['AGENTS.md','STATE.md','agent-system/config.json','agent-system/contracts/lesson.schema.json','agent-system/contracts/verdict.schema.json','agent-system/evals/rubric.json','agent-system/evals/cases.jsonl','agent-system/workflows/compounding-loop.json','agent-system/skills/sensory-compounding-loop/SKILL.md'];
for (const path of required) if (!existsSync(resolve(root, path))) errors.push(`Missing ${path}`);

const state = readFileSync(resolve(root, 'STATE.md'), 'utf8');
for (const section of ['Verified facts','General rules','Open failures','Lessons learned','Last session']) {
  if (!state.includes(`## ${section}`)) errors.push(`STATE.md lacks ${section}`);
}

const skill = readFileSync(resolve(root, 'agent-system/skills/sensory-compounding-loop/SKILL.md'), 'utf8');
if (!skill.startsWith('---\n')) errors.push('Skill frontmatter must be first.');
if (/\bTODO\b/.test(skill)) errors.push('Skill contains TODO placeholders.');
for (const ref of ['references/policy.md','references/tool-map.md']) {
  if (!existsSync(resolve(root, 'agent-system/skills/sensory-compounding-loop', ref))) errors.push(`Missing skill reference ${ref}`);
}

const config = readJson('agent-system/config.json');
if (config.maxIterations > 3) errors.push('maxIterations must not exceed 3.');
if (config.truthThreshold < 0.95) errors.push('truthThreshold must be at least 0.95.');

const evals = loadEvals();
const ids = evals.map((item) => item.id);
if (new Set(ids).size !== ids.length) errors.push('Eval IDs must be unique.');
for (const item of evals) {
  for (const key of ['id','version','description','taskClass','scopeGlobs','requiredCheckIds','hardGateIds','tags']) {
    if (!(key in item)) errors.push(`Eval ${item.id || '<unknown>'} lacks ${key}.`);
  }
}

const workflow = readJson('agent-system/workflows/compounding-loop.json');
if (!Array.isArray(workflow.steps) || workflow.steps.length < 4) errors.push('Workflow needs at least four steps.');
if (workflow.steps?.some((step) => !step.agent)) errors.push('Every workflow step needs an agent.');
const verifierSource = readFileSync(resolve(root, 'agent-system/scripts/verify.mjs'), 'utf8');
if (/\*\.test\.ts/.test(verifierSource)) errors.push('Verifier commands must enumerate test files; shell globs are not expanded.');
for (const variable of ['E2E_ADMIN_EMAIL','E2E_ADMIN_PASSWORD']) if (!verifierSource.includes(variable)) errors.push(`Verifier lacks ${variable} credential check.`);
const reportUi = evals.find(({id})=>id==='report-ui-safety');
for (const gate of ['report-tests','decision-tests','go-gate-static','e2e','visual-evidence']) if (!reportUi?.hardGateIds.includes(gate)) errors.push(`report-ui-safety lacks ${gate}.`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`System integrity PASS (${required.length} required files, ${evals.length} evals).`);
