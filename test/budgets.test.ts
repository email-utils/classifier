// classifier#11's deterministic budgets (email-utils/meta#19): time that
// doesn't depend on the runner's speed, or only loosely. An address past the
// length caps is turned away in constant time, time grows linearly with the
// input up to the caps, and no generated input takes long.
// test/budgets.worker.ts does the timing, in a thread v8 coverage doesn't
// instrument; this checks what it measured.
import { Worker } from 'node:worker_threads';
import { parseAddress } from '@email-utils/validator-syntax';
import { describe, expect, it } from 'vitest';
import { lenientTld, partsOf } from '../src/address';
import type { Report } from './budgets.worker';

// The adversarial inputs' seed, in every failure message, so a run can be
// repeated.
const seed = Date.now();

const report = await new Promise<Report>((resolve, reject) => {
  const worker = new Worker(new URL('budgets.worker.ts', import.meta.url), {
    workerData: seed,
  });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the worker posts one Report
  worker.once('message', (message) => resolve(message as Report));
  worker.once('error', reject);
  worker.once('exit', (code) => {
    reject(new Error(`The timing worker exited with code ${code}`));
  });
});

/** ns or µs, for failure messages. */
function time(ns: number): string {
  return ns < 1000 ? `${ns.toFixed(0)} ns` : `${(ns / 1000).toFixed(1)} µs`;
}

describe('an address past the length caps', () => {
  // `partsOf` turns a string over 254 characters away before the parser
  // sees it, which is only right if the parser would: hold it to that on
  // both sides of the cap.
  it('is one the parser rejects', () => {
    const longest = `${'a'.repeat(64)}@${'a.'.repeat(93)}com`;
    expect(longest).toHaveLength(254);
    expect(parseAddress(longest, { preset: 'practical' }).ok).toBe(true);
    expect(partsOf(longest)).toBeDefined();
    for (const email of [
      `${'a'.repeat(64)}@${'a.'.repeat(93)}comm`,
      `${'a'.repeat(245)}@gmail.com`,
      `ada@${'a.'.repeat(124)}con`,
      '@'.repeat(255),
    ]) {
      expect(email).toHaveLength(255);
      expect(parseAddress(email, { preset: 'practical' }).ok).toBe(false);
      expect(parseAddress(email, lenientTld).ok).toBe(false);
      expect(partsOf(email)).toBeUndefined();
      expect(partsOf(email, lenientTld)).toBeUndefined();
    }
  });

  it.each(report.oversized)(
    'is unknown to $lookup, with $shape',
    ({ unknown }) => {
      expect(unknown).toBe(true);
    },
  );

  // classifier#11 budget: ≤ 1 µs at any size, up to 4 MiB.
  it.each(report.oversized)(
    'is turned away by $lookup in ≤ 1 µs, with $shape',
    ({ times }) => {
      for (const { size, ns } of times) {
        expect(ns, `${size} characters: ${time(ns)}`).toBeLessThanOrEqual(1000);
      }
    },
  );
});

// classifier#11 budget: time(2n) / time(n) ≤ 2.5, up to the caps.
describe('time grows linearly', () => {
  it.each(report.linear)('for $lookup, with $shape', ({ times }) => {
    for (let i = 1; i < times.length; i++) {
      const [before, after] = [times[i - 1]!, times[i]!];
      expect(
        after.ns / before.ns,
        `${before.size} → ${after.size} characters: ${time(before.ns)} → ${time(after.ns)}`,
      ).toBeLessThanOrEqual(2.5);
    }
  });
});

// classifier#11 budget: ≤ 50 µs for each input, under any options.
describe('adversarial input', () => {
  it.each(report.adversarial)(
    'takes $lookup ≤ 50 µs each',
    ({ ns, input, options }) => {
      const shown = `${JSON.stringify(input).slice(0, 200)} under ${JSON.stringify(options)}`;
      expect(
        ns,
        `${time(ns)} with seed ${seed} for ${shown}`,
      ).toBeLessThanOrEqual(50_000);
    },
  );
});
