import { test } from 'vitest';
import { classifyEntry, root } from './built';
import { corpusParsed, corpusStrings, parsed } from './corpus';

// classifier#10 targets a known domain and a miss on a parsed address, in
// `task.meta.bench` (bench/meta.ts); a string adds validator-syntax's parse.
// `classify` has no target of its own: it's the four lookups on one parse.
// The targets are absolute, so no PR gate checks them: the nightly job does
// (email-utils/meta#21), allowing 3× for a CI runner's speed.

const { suggestCorrection } = root;
const { classify } = classifyEntry;

const known = parsed('ada', 'gmail.com');
const typo = parsed('ada', 'gmial.com');
const miss = parsed('ada', 'example-company.co.uk');
const tldTypo = parsed('ada', 'gmial.con');

test('suggestCorrection', async ({ bench, task }) => {
  task.meta.bench = {
    'known domain': { p50: 200, source: 'classifier#10' },
    miss: { p50: 25_000, source: 'classifier#10' },
  };
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
  await bench('corpus, strings', () => {
    for (const email of corpusStrings) {
      suggestCorrection(email);
    }
  }).run();
  await bench('corpus, parsed', () => {
    for (const email of corpusParsed) {
      suggestCorrection(email);
    }
  }).run();
});

test('classify', async ({ bench }) => {
  await bench('known domain', () => {
    classify(known);
  }).run();
  await bench('miss', () => {
    classify(miss);
  }).run();
  await bench('corpus, strings', () => {
    for (const email of corpusStrings) {
      classify(email);
    }
  }).run();
  await bench('corpus, parsed', () => {
    for (const email of corpusParsed) {
      classify(email);
    }
  }).run();
});
