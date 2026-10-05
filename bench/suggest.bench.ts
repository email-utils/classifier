import { test } from 'vitest';
import { classifyEntry, root } from './built';
import { corpusParsed, corpusStrings, parsed } from './corpus';

// classifier#10 targets 200 ns for a known domain and 25 µs for a miss, on a
// parsed address; a string adds validator-syntax's parse. `classify` has no
// target of its own: it's the four lookups on one parse. The targets are
// absolute, on Apple Silicon, and nothing checks them: the benches run
// locally, with `npm run bench`, for the docs' numbers (email-utils/meta#118).

const { suggestCorrection } = root;
const { classify } = classifyEntry;

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
