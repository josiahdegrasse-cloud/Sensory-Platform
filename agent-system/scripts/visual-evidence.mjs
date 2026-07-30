/* global console, process */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './lib.mjs';
import { inspectPng, isCurrentCapture, isInsideRun } from './visual-contract.mjs';

function incomplete(message) {
  console.error(`Visual evidence INCOMPLETE: ${message}`);
  process.exit(3);
}

function readJson(path, label) {
  if (!path || !existsSync(resolve(root, path))) incomplete(`${label} is missing.`);
  try { return JSON.parse(readFileSync(resolve(root, path), 'utf8')); }
  catch { incomplete(`${label} is not valid JSON.`); }
}

const manifestPath = process.env.AGENT_VISUAL_MANIFEST;
const reviewPath = process.env.AGENT_VISUAL_REVIEW;
const manifest = readJson(manifestPath, 'capture manifest');
const review = readJson(reviewPath, 'independent review');
if (manifest.schemaVersion !== 1 || !manifest.captureId || !manifest.runId || !manifest.route || !manifest.capturedAt) incomplete('capture manifest lacks required provenance.');
const preflight = readJson(`agent-system/runs/${manifest.runId}/manifest.json`, 'preflight manifest');
if (preflight.verdict !== 'READY') incomplete('capture is not tied to a READY preflight run.');
const capturedAt = Date.parse(manifest.capturedAt);
if (!Number.isFinite(capturedAt) || capturedAt < Date.parse(preflight.createdAt) || Date.now() - capturedAt > 86_400_000) incomplete('capture timestamp is stale or predates preflight.');

const desktopEntry = manifest.images?.find(({ role }) => role === 'desktop');
const mobileEntry = manifest.images?.find(({ role }) => role === 'mobile');
if (!desktopEntry || !mobileEntry) incomplete('manifest needs desktop and mobile images.');
if (![desktopEntry,mobileEntry].every(({path})=>isInsideRun(path, manifest.runId))) incomplete('images must live inside the current preflight run directory.');
let desktop;
let mobile;
try { desktop = inspectPng(desktopEntry.path); mobile = inspectPng(mobileEntry.path); }
catch (error) { incomplete(`PNG decode failed: ${error.message}`); }
if (desktop.width < 1024 || desktop.height < 600) incomplete('desktop dimensions are below 1024x600.');
if (mobile.width < 320 || mobile.width > 600 || mobile.height < 600) incomplete('mobile dimensions must be 320-600px wide and at least 600px tall.');
for (const [entry, actual] of [[desktopEntry,desktop],[mobileEntry,mobile]]) {
  if (entry.sha256 !== actual.sha256 || entry.width !== actual.width || entry.height !== actual.height || !isCurrentCapture(actual.mtime, capturedAt, Date.parse(preflight.createdAt))) incomplete(`manifest does not match a fresh current-run image: ${entry.path}`);
}
if (review.schemaVersion !== 1 || review.captureId !== manifest.captureId || review.verdict !== 'PASS' || !/^codex-verifier[-:]/.test(review.reviewerAgentId || '')) incomplete('independent Codex visual review PASS is missing.');
const reviewedAt = Date.parse(review.reviewedAt);
if (!Number.isFinite(reviewedAt) || reviewedAt < capturedAt || JSON.stringify(review.artifactHashes) !== JSON.stringify(manifest.images.map(({sha256})=>sha256))) incomplete('review provenance does not match the capture.');
if (!Array.isArray(review.checks) || review.checks.length < 3 || review.checks.some(({status})=>status !== 'pass')) incomplete('visual review needs at least three passing rubric checks.');
console.log(`Visual evidence PASS: ${manifest.route}; ${desktop.width}x${desktop.height} and ${mobile.width}x${mobile.height}; independently reviewed.`);
