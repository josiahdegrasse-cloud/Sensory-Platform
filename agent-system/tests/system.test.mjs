import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { loadEvals, matchesProtected, readJson, root } from '../scripts/lib.mjs';
import { calculateWeightedScore } from '../scripts/scoring.mjs';
import { inspectPng, isCurrentCapture } from '../scripts/visual-contract.mjs';

test('configuration is bounded and strict', () => {
  const config = readJson('agent-system/config.json');
  assert.ok(config.maxIterations <= 3);
  assert.ok(config.truthThreshold >= 0.95);
  assert.equal(matchesProtected('src/app/lib/db/database.types.ts', config.protectedPaths), true);
  assert.equal(matchesProtected('src/app/components/card.tsx', config.protectedPaths), false);
});

test('evals are unique and reference the expected governance case', () => {
  const evals = loadEvals();
  assert.equal(new Set(evals.map(({ id }) => id)).size, evals.length);
  assert.ok(evals.find(({ id }) => id === 'decision-governance')?.hardGateIds.includes('go-gate-static'));
});

test('system integrity checker passes', () => {
  const output = execFileSync('node', ['agent-system/scripts/system-check.mjs'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /PASS/);
});

test('promotion fails closed for weak evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sensory-agent-test-'));
  const candidate = join(directory, 'candidate.json');
  writeFileSync(candidate, JSON.stringify({ id:'weak', rule:'Use evidence.', rootCause:'Test', confidence:0.8, scope:'project', tags:[], evidenceRuns:['one'] }));
  const result = spawnSync('node', ['agent-system/scripts/promote.mjs', '--candidate', candidate], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /below threshold/);
});

test('required system files are present', () => {
  for (const path of ['STATE.md','agent-system/README.md','agent-system/skills/sensory-compounding-loop/SKILL.md']) {
    assert.equal(existsSync(resolve(root, path)), true, path);
  }
});

test('protected preflight cannot be acknowledged around', () => {
  const result = spawnSync('node', ['agent-system/scripts/start.mjs','--objective','test protection','--scope','AGENTS.md','--ack-dirty-overlap'], { cwd:root, encoding:'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /"verdict": "BLOCKED"/);
});

test('visual evidence without run-bound manifests is incomplete', () => {
  const result = spawnSync('node', ['agent-system/scripts/visual-evidence.mjs'], { cwd:root, encoding:'utf8' });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /capture manifest is missing/);
});

test('report UI eval composes report, GO, browser, and visual gates', () => {
  const item = loadEvals().find(({id})=>id==='report-ui-safety');
  for (const id of ['report-tests','decision-tests','go-gate-static','e2e','visual-evidence']) assert.ok(item.hardGateIds.includes(id));
});

test('dirty non-protected scope stays blocked even with legacy ack flag', () => {
  const path = resolve(root, 'agent-system/tests/.dirty-overlap.tmp');
  writeFileSync(path, 'user work');
  try {
    const result = spawnSync('node', ['agent-system/scripts/start.mjs','--objective','dirty overlap','--scope','agent-system','--ack-dirty-overlap'], { cwd:root, encoding:'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Scope overlaps pre-existing user changes/);
  } finally { rmSync(path, { force:true }); }
});

test('PNG contract rejects a forged header and capture freshness is bounded', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sensory-png-test-'));
  const path = join(directory, 'forged.png');
  writeFileSync(path, Buffer.from('89504e470d0a1a0a0000000d494844520000040000000258', 'hex'));
  assert.throws(() => inspectPng(path));
  assert.equal(isCurrentCapture(2_000, 3_000, 1_000), true);
  assert.equal(isCurrentCapture(500, 3_000, 1_000), false);
  assert.equal(isCurrentCapture(1_000, 700_001, 1_000), false);
});

test('weighted scoring is gate-category based', () => {
  const result = calculateWeightedScore(
    [{id:'correct',status:'pass'},{id:'governance',status:'fail'},{id:'visual',status:'skip'}],
    {correct:'correctness',governance:'governance',visual:'visual'},
    {correctness:0.35,governance:0.25,visual:0.1}
  );
  assert.equal(result.truthScore, 0.5);
  assert.equal(result.coverage, (0.35 + 0.25) / 0.7);
});
