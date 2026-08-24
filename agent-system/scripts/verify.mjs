/* global console, process */
import { mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { dirtyFiles, fail, git, loadEvals, parseArgs, readJson, root } from './lib.mjs';
import { calculateWeightedScore } from './scoring.mjs';

const commands = {
  'system-integrity': ['node', ['agent-system/scripts/system-check.mjs']],
  'agent-tests': ['node', ['--test', 'agent-system/tests/system.test.mjs']],
  typecheck: ['pnpm', ['run', 'typecheck']],
  lint: ['pnpm', ['run', 'lint']],
  unit: ['pnpm', ['test']],
  'migration-drift': ['pnpm', ['run', 'test:migration-drift']],
  build: ['pnpm', ['run', 'build']],
  'demo-boundaries': ['pnpm', ['run', 'test:demo-boundaries']],
  'report-tests': ['pnpm', ['exec','vitest','run','src/app/lib/report-quality.test.ts','src/app/lib/report-evaluator.test.ts','src/app/lib/report-evidence.test.ts','src/app/lib/report-qc/report-qc.test.ts','src/app/lib/report-qc/report-qc-render.test.ts','src/app/lib/report-qc/report-qc-v7-regression.test.ts','src/app/utils/commercialization-report-artifact.test.ts','src/app/utils/commercialization-report-export.test.ts','src/app/utils/pdf/sections.test.ts']],
  'decision-tests': ['pnpm', ['exec','vitest','run','src/app/utils/go-stop-tweak-engine.test.ts','src/app/utils/go-stop-tweak-engine.pins.test.ts','src/app/lib/decision-governance.test.ts','src/app/lib/workflow/workflow-evaluator.test.ts','src/app/lib/workflow-readiness.test.ts']],
  'go-gate-static': ['node', ['agent-system/scripts/go-gate-static.mjs']],
  e2e: ['pnpm', ['run', 'test:e2e']],
  'visual-evidence': ['node', ['agent-system/scripts/visual-evidence.mjs']]
};

const categories = {
  'system-integrity':'governance','agent-tests':'correctness',typecheck:'correctness',lint:'delivery',unit:'correctness','migration-drift':'governance',build:'delivery','demo-boundaries':'governance','report-tests':'evidenceIntegrity','decision-tests':'governance','go-gate-static':'governance',e2e:'visual','visual-evidence':'visual'
};

const args = parseArgs(process.argv.slice(2));
const profile = String(args.profile || 'focused');
const config = readJson('agent-system/config.json');
if (!config.profiles[profile]) fail(`Unknown profile: ${profile}`);
const requestedEvalIds = String(args.eval || '').split(',').map((value)=>value.trim()).filter(Boolean);
const allEvals = loadEvals();
const evalItems = requestedEvalIds.map((id) => allEvals.find((item) => item.id === id));
if (evalItems.some((item) => !item)) fail(`Unknown eval: ${requestedEvalIds[evalItems.findIndex((item)=>!item)]}`);
const checkIds = [...new Set([...config.profiles[profile], ...evalItems.flatMap((item) => item.requiredCheckIds)])];
for (const id of checkIds) if (!commands[id]) fail(`Eval references unknown check ID: ${id}`);

const runId = `verify-${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const startedAt = new Date().toISOString();
const results = [];

function runCheck(id) {
  if (id === 'e2e' && (!process.env.DEMO_ADMIN_EMAIL || !process.env.DEMO_ADMIN_PASSWORD) && evalItems.some((item)=>item.tags.includes('visual'))) {
    return Promise.resolve({ id, command: 'pnpm run test:e2e', status: 'skip', required: true, hardGate: true, exitCode: null, durationMs: 0, stdoutTail: '', stderrTail: '', reason: 'Authenticated/visual evidence credentials are unavailable.' });
  }
  const [command, commandArgs] = commands[id];
  const started = Date.now();
  return new Promise((done) => {
    const child = spawn(command, commandArgs, { cwd: root, env: {...process.env, AGENT_VISUAL_MANIFEST:String(args['visual-manifest'] || ''), AGENT_VISUAL_REVIEW:String(args['visual-review'] || '')}, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { stderr += data; });
    child.on('error', (error) => done({ id, command: [command,...commandArgs].join(' '), status: 'error', required: true, hardGate: evalItems.some((item)=>item.hardGateIds.includes(id)) || config.profiles[profile].includes(id), exitCode: null, durationMs: Date.now()-started, stdoutTail: stdout.slice(-4000), stderrTail: error.message, reason: 'Command could not start.' }));
    child.on('close', (code) => done({ id, command: [command,...commandArgs].join(' '), status: code === 0 ? 'pass' : code === 3 ? 'skip' : 'fail', required: true, hardGate: evalItems.some((item)=>item.hardGateIds.includes(id)) || config.profiles[profile].includes(id), exitCode: code, durationMs: Date.now()-started, stdoutTail: stdout.slice(-4000), stderrTail: stderr.slice(-4000), reason: code === 0 ? '' : code === 3 ? 'Required evidence is incomplete.' : 'Allowlisted check failed.' }));
  });
}

for (const id of checkIds) results.push(await runCheck(id));
const failedHard = results.some((item) => item.hardGate && ['fail','error'].includes(item.status));
const skippedRequired = results.some((item) => item.required && item.status === 'skip');
const rubric = readJson('agent-system/evals/rubric.json');
const { coverage, truthScore } = calculateWeightedScore(results, categories, rubric.weights);
const verdict = failedHard ? 'FAIL' : skippedRequired ? 'INCOMPLETE' : truthScore >= config.truthThreshold && coverage === 1 ? 'PASS' : 'FAIL';
const report = { schemaVersion:1, runId, profile, evalIds:requestedEvalIds, startedAt, completedAt:new Date().toISOString(), gitHead:git(['rev-parse','HEAD']), dirtyFiles:dirtyFiles(), checks:results, score:{truthScore,coverage}, verdict, blockers:results.filter((item)=>item.status!=='pass').map((item)=>`${item.id}: ${item.reason}`), warnings:[], artifacts:[args['visual-manifest'],args['visual-review']].filter(Boolean) };
const output = resolve(root, String(args.output || `agent-system/runs/${runId}/verdict.json`));
mkdirSync(resolve(output, '..'), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ verdict, truthScore, coverage, output, checks:results.map(({id,status})=>({id,status})) }, null, 2));
process.exit(verdict === 'PASS' ? 0 : verdict === 'INCOMPLETE' ? 3 : 1);
