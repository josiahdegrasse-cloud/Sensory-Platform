/* global console, process */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../..');

export function readJson(path) {
  return JSON.parse(readFileSync(resolve(root, path), 'utf8'));
}

export function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const name = key.slice(2);
    const next = argv[i + 1];
    result[name] = next && !next.startsWith('--') ? argv[++i] : true;
  }
  return result;
}

export function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

export function dirtyFiles() {
  return git(['status', '--porcelain=v1', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((line) => line.slice(3))
    .map((path) => path.includes(' -> ') ? path.split(' -> ').at(-1) : path);
}

export function matchesProtected(path, protectedPaths) {
  return protectedPaths.some((item) => path === item || path.startsWith(item));
}

export function loadEvals() {
  const raw = readFileSync(resolve(root, 'agent-system/evals/cases.jsonl'), 'utf8');
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

export function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}
