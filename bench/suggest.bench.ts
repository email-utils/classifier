import type { ParsedAddress } from '@email-utils/validator-syntax';
import { test } from 'vitest';
import { suggestCorrection } from '../src';
import { classify } from '../src/classify';

// classifier#10 targets 200 ns for a known domain and 25 µs for a miss.
// Parsed addresses leave out validator-syntax's parse; the gates arrive with
// the performance work (classifier#11).
function parsed(local: string, domain: string): ParsedAddress {
  return { local, domain, comments: [] };
}

const known = parsed('ada', 'gmail.com');
const typo = parsed('ada', 'gmial.com');
const miss = parsed('ada', 'example-company.co.uk');
const tldTypo = parsed('ada', 'gmial.con');

test('suggestCorrection', async ({ bench }) => {
  await bench('known domain', () => {
    suggestCorrection(known);
  }).run();
  await bench('typo', () => {
    suggestCorrection(typo);
  }).run();
  await bench('miss', () => {
    suggestCorrection(miss);
  }).run();
  await bench('TLD typo', () => {
    suggestCorrection(tldTypo);
  }).run();
  await bench('known domain, string', () => {
    suggestCorrection('ada@gmail.com');
  }).run();
  await bench('miss, string', () => {
    suggestCorrection('ada@example-company.co.uk');
  }).run();
});

test('classify', async ({ bench }) => {
  await bench('known domain', () => {
    classify(known);
  }).run();
  await bench('miss', () => {
    classify(miss);
  }).run();
});
