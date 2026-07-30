/* global console, process */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fail, parseArgs, root } from './lib.mjs';
import { inspectPng, isCurrentCapture, isInsideRun } from './visual-contract.mjs';

const args = parseArgs(process.argv.slice(2));
for (const key of ['run-id','route','desktop','mobile']) if (!args[key]) fail(`Missing --${key}`);
const preflightPath = resolve(root, `agent-system/runs/${args['run-id']}/manifest.json`);
const preflight = existsSync(preflightPath) ? JSON.parse(readFileSync(preflightPath, 'utf8')) : null;
if (preflight?.verdict !== 'READY') fail('Visual capture requires a READY preflight run.', 1);
function inspect(path, role) {
  if (!isInsideRun(String(path), String(args['run-id']))) fail(`${role} artifact must be inside the current run directory.`);
  try { return { role, path:String(path), ...inspectPng(String(path)) }; }
  catch (error) { fail(`${role} PNG failed decoding: ${error.message}`); }
}
const capturedAt = Date.now();
const images = [inspect(args.desktop,'desktop'),inspect(args.mobile,'mobile')];
if (images.some(({mtime})=>!isCurrentCapture(mtime,capturedAt,Date.parse(preflight.createdAt)))) fail('Screenshots must be captured after preflight and within ten minutes of manifest creation.', 1);
const manifest = { schemaVersion:1, captureId:randomUUID(), runId:String(args['run-id']), route:String(args.route), capturedAt:new Date(capturedAt).toISOString(), images:images.map((image)=>({ role:image.role, path:image.path, width:image.width, height:image.height, sha256:image.sha256 })) };
const output = resolve(root, String(args.output || `agent-system/runs/${args['run-id']}/visual-manifest.json`));
writeFileSync(output, `${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify({ output, captureId:manifest.captureId }, null, 2));
