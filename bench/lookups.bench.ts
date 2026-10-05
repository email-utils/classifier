import { test } from 'vitest';
import { disposable, root } from './built';
import { corpusParsed, corpusStrings, parsed } from './corpus';

// Each test gives its benches' targets in `task.meta.bench` (bench/meta.ts).
// They're for a parsed address; a string adds validator-syntax's parse,
// about 130–250 ns, which has no target here (classifier#26). They're
// absolute, so no PR gate checks them: the nightly job does
// (email-utils/meta#21), allowing 3× for a CI runner's speed.

const { getProvider, isRoleAccount } = root;
const { isDisposable } = disposable;

test('getProvider', async ({ bench, task }) => {
  // classifier#8's, restated on a parsed address in classifier#26.
  const target = { p50: 50, source: 'classifier#26' };
  task.meta.bench = {
    'known domain': target,
    subdomain: target,
    miss: target,
  };
  const known = parsed('ada', 'gmail.com');
  // A one-label subdomain on a provider with subdomain addressing takes a
  // second lookup.
  const subdomain = parsed('news', 'ada.fastmail.com');
  const miss = parsed('ada', 'example-company.co.uk');
  await bench('known domain', () => {
    getProvider(known);
  }).run();
  await bench('subdomain', () => {
    getProvider(subdomain);
  }).run();
  await bench('miss', () => {
    getProvider(miss);
  }).run();
  await bench('known domain, string', () => {
    getProvider('ada@gmail.com');
  }).run();
  await bench('corpus, strings', () => {
    for (const email of corpusStrings) {
      getProvider(email);
    }
  }).run();
  await bench('corpus, parsed', () => {
    for (const email of corpusParsed) {
      getProvider(email);
    }
  }).run();
});

test('isRoleAccount', async ({ bench, task }) => {
  // classifier#8's, restated on a parsed address in classifier#26.
  const target = { p50: 100, source: 'classifier#26' };
  task.meta.bench = {
    role: target,
    'role with a tag': target,
    person: target,
  };
  const role = parsed('postmaster', 'example.com');
  const tagged = parsed('Admin+alerts', 'example.com');
  const person = parsed('ada.lovelace', 'example.com');
  await bench('role', () => {
    isRoleAccount(role);
  }).run();
  await bench('role with a tag', () => {
    isRoleAccount(tagged);
  }).run();
  await bench('person', () => {
    isRoleAccount(person);
  }).run();
  await bench('role, string', () => {
    isRoleAccount('postmaster@example.com');
  }).run();
  await bench('corpus, strings', () => {
    for (const email of corpusStrings) {
      isRoleAccount(email);
    }
  }).run();
  await bench('corpus, parsed', () => {
    for (const email of corpusParsed) {
      isRoleAccount(email);
    }
  }).run();
});

test('isDisposable', async ({ bench, task }) => {
  // With the parent-domain walk. An internationalized domain has no target:
  // it goes through the URL parser to A-labels first.
  const target = { p50: 200, source: 'classifier#9' };
  task.meta.bench = {
    'listed domain': target,
    subdomain: target,
    miss: target,
  };
  const listed = parsed('ada', 'mailinator.com');
  const subdomain = parsed('ada', 'a.b.mailinator.com');
  const miss = parsed('ada', 'mail.example-company.co.uk');
  const idn = parsed('ada', 'bücher.example');
  // Warm the set up, so its one-off build isn't in the first sample.
  isDisposable(listed);
  await bench('listed domain', () => {
    isDisposable(listed);
  }).run();
  await bench('subdomain', () => {
    isDisposable(subdomain);
  }).run();
  await bench('miss', () => {
    isDisposable(miss);
  }).run();
  await bench('internationalized domain', () => {
    isDisposable(idn);
  }).run();
  await bench('listed domain, string', () => {
    isDisposable('ada@mailinator.com');
  }).run();
  await bench('corpus, strings', () => {
    for (const email of corpusStrings) {
      isDisposable(email);
    }
  }).run();
  await bench('corpus, parsed', () => {
    for (const email of corpusParsed) {
      isDisposable(email);
    }
  }).run();
});
