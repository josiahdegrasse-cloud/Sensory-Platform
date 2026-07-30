/* global console, process */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './lib.mjs';

const concept = readFileSync(resolve(root, 'src/app/components/concept-testing.tsx'), 'utf8');
const unsafe = concept.includes('startFromScratch') && /without (?:a )?decision/i.test(concept);
if (unsafe) {
  console.error('GO gate audit FAIL: Concept UI advertises a start-without-decision path. Stop and report before schema/design changes.');
  process.exit(1);
}
console.log('GO gate static audit PASS.');
