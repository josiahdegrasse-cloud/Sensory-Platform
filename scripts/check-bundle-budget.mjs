import { log } from 'node:console';
import { readFileSync, statSync } from 'node:fs';
import { URL } from 'node:url';
import { gzipSync } from 'node:zlib';

const DIST_DIR = new URL('../dist/', import.meta.url);
const INITIAL_JS_GZIP_BUDGET_KIB = 330;
const INITIAL_CSS_GZIP_BUDGET_KIB = 30;

function assetNamesFromIndex() {
  const html = readFileSync(new URL('index.html', DIST_DIR), 'utf8');
  return [...new Set(
    [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.(?:js|css))"/g)]
      .map(match => match[1]),
  )];
}

function sizeSummary(names, extension) {
  const matching = names.filter(name => name.endsWith(extension));
  const gzipBytes = matching.reduce((total, name) => (
    total + gzipSync(readFileSync(new URL(`assets/${name}`, DIST_DIR))).byteLength
  ), 0);
  const rawBytes = matching.reduce((total, name) => (
    total + statSync(new URL(`assets/${name}`, DIST_DIR)).size
  ), 0);
  return {
    names: matching,
    gzipKiB: gzipBytes / 1024,
    rawKiB: rawBytes / 1024,
  };
}

function assertBudget(label, summary, budgetKiB) {
  const formatted = `${summary.gzipKiB.toFixed(1)} KiB gzip / ${summary.rawKiB.toFixed(1)} KiB raw`;
  log(`${label}: ${formatted} (budget ${budgetKiB} KiB gzip)`);
  if (summary.gzipKiB > budgetKiB) {
    throw new Error(`${label} exceeds its compressed bundle budget.`);
  }
}

const initialAssets = assetNamesFromIndex();
const initialJs = sizeSummary(initialAssets, '.js');
const initialCss = sizeSummary(initialAssets, '.css');

if (initialJs.names.some(name => name.startsWith('vendor-charts-'))) {
  throw new Error('Recharts leaked into the initial bundle. Charts must remain route-loaded.');
}

assertBudget('Initial JavaScript', initialJs, INITIAL_JS_GZIP_BUDGET_KIB);
assertBudget('Initial CSS', initialCss, INITIAL_CSS_GZIP_BUDGET_KIB);
