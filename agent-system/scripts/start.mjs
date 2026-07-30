/* global console, process */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { dirtyFiles, fail, git, matchesProtected, parseArgs, readJson, root } from './lib.mjs';

const args = parseArgs(process.argv.slice(2));
if (!args.objective) fail('Usage: --objective <text> [--scope path[,path]]');

const config = readJson('agent-system/config.json');
const scope = String(args.scope || '').split(',').map((value) => value.trim()).filter(Boolean);
const dirty = dirtyFiles();
const protectedScope = scope.filter((path) => matchesProtected(path, config.protectedPaths));
const dirtyOverlap = scope.filter((path) => dirty.some((dirtyPath) => dirtyPath === path || dirtyPath.startsWith(`${path}/`) || path.startsWith(`${dirtyPath}/`)));
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
const runDir = resolve(root, 'agent-system/runs', runId);
mkdirSync(runDir, { recursive: true });

const baselineHashes = Object.fromEntries(dirty.filter((dirtyPath) => scope.some((path) => dirtyPath === path || dirtyPath.startsWith(`${path}/`) || path.startsWith(`${dirtyPath}/`))).map((path) => {
  const absolute = resolve(root, path);
  return [path, !existsSync(absolute) ? 'DELETED' : statSync(absolute).isFile() ? createHash('sha256').update(readFileSync(absolute)).digest('hex') : 'DIRECTORY'];
}));
const verdict = protectedScope.length || dirtyOverlap.length ? 'BLOCKED' : 'READY';
const manifest = {
  schemaVersion: 1,
  runId,
  createdAt: new Date().toISOString(),
  objective: String(args.objective),
  scope,
  gitHead: git(['rev-parse', 'HEAD']),
  dirtyFiles: dirty,
  protectedScope,
  dirtyOverlap,
  baselineHashes,
  verdict,
  blockers: [
    ...(protectedScope.length ? ['Protected scope requires an explicit human checkpoint.'] : []),
    ...(dirtyOverlap.length ? ['Scope overlaps pre-existing user changes. Use a clean, isolated checkout or obtain a deliberate user-provided patch baseline; this runner will not acknowledge around it.'] : [])
  ]
};
writeFileSync(resolve(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
process.exit(verdict === 'READY' ? 0 : 1);
