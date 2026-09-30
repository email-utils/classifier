// Times the classifier for test/budgets.test.ts, in a worker thread that
// Node runs directly. v8 coverage, which the CI test leg always collects,
// counts every block the code runs and makes it about 10× slower. It's
// enabled per thread, so a worker isn't instrumented, and the budgets
// measure the code as it ships under `npm test` and `npm run test:coverage`
// alike.
//
// Each time is the average over a batch of calls, best of several batches,
// so a shared runner or a GC pause doesn't count against the budget.
import { registerHooks } from 'node:module';
import { parentPort, workerData } from 'node:worker_threads';
import type { ParsedAddress } from '@email-utils/validator-syntax';
import type { Arbitrary } from 'fast-check';
import type { Classifier, ClassifyOptions } from '../src/classify';

// src imports its own files without extensions, as the bundler resolves
// them; Node needs the `.ts`. The hook has to be registered before src is
// imported, so everything else is imported dynamically below.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]s$/.test(specifier)) {
      for (const suffix of ['.ts', '/index.ts']) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // Not this one; try the next.
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const fc = await import('fast-check');
const { getProvider, isRoleAccount, suggestCorrection } =
  await import('../src/index.ts');
const { classify, createClassifier } = await import('../src/classify/index.ts');
const { isDisposable } = await import('../src/disposable/index.ts');
const { targets, tldTypos } = await import('../src/suggest.ts');

type Input = string | ParsedAddress;

/** What the worker measured, in nanoseconds per call. */
export interface Report {
  /** Each lookup on each oversized shape: whether it knew nothing of it at every size, and its times. */
  oversized: {
    lookup: string;
    shape: string;
    unknown: boolean;
    times: { size: number; ns: number }[];
  }[];
  /** Each lookup on each worst-case shape: its times as the input doubles. */
  linear: {
    lookup: string;
    shape: string;
    times: { size: number; ns: number }[];
  }[];
  /** Each lookup: its slowest adversarial input, with the options it ran under. */
  adversarial: {
    lookup: string;
    ns: number;
    input: Input;
    options: ClassifyOptions | undefined;
  }[];
}

function parsed(local: string, domain: string): ParsedAddress {
  return { local, domain, comments: [] };
}

type Lookup = (email: Input) => unknown;

/** Every lookup, and `classify` with and without options bound. */
function lookups(classifier: Classifier): [string, Lookup][] {
  return [
    ['getProvider', getProvider],
    ['isRoleAccount', isRoleAccount],
    ['isDisposable', isDisposable],
    ['suggestCorrection', suggestCorrection],
    ['classify', (email) => classify(email)],
    ['createClassifier(…).classify', (email) => classifier.classify(email)],
  ];
}

/** How many calls of `run` take at least `ms` milliseconds. */
function calibrate(run: () => unknown, ms: number): number {
  for (let calls = 1; ; calls *= 2) {
    const start = performance.now();
    for (let i = 0; i < calls; i++) {
      run();
    }
    if (performance.now() - start >= ms) {
      return calls;
    }
  }
}

/**
 * Nanoseconds per call of each of `runs`, the best of `batches` batches of
 * about `ms` milliseconds. The runs take turns, so a slow patch on the
 * runner lands on all of them rather than on one.
 */
function nsPerCall(runs: (() => unknown)[], batches = 7, ms = 0.5): number[] {
  const calls = runs.map((run) => calibrate(run, ms));
  const best = runs.map(() => Infinity);
  for (let batch = 0; batch < batches; batch++) {
    runs.forEach((run, r) => {
      const count = calls[r]!;
      const start = performance.now();
      for (let i = 0; i < count; i++) {
        run();
      }
      best[r] = Math.min(best[r]!, ((performance.now() - start) * 1e6) / count);
    });
  }
  return best;
}

/** A hostname `n` long of many labels, which the parser accepts. */
function labels(n: number): string {
  return `${'a.'.repeat(Math.floor((n - 3) / 2))}com`.padStart(n, 'a');
}

// A hostname `n` long, and one a single edit from it: the edit distance
// between them fills its band all the way down, which is its worst case.
function target(n: number): string {
  return `${'bbbbbbb.'.repeat(Math.floor((n - 4) / 8))}com`.padStart(n, 'b');
}

function nearEdit(n: number): string {
  return `${target(n).slice(0, n - 5)}v${target(n).slice(n - 4)}`;
}

// Matching as widely as the options allow, toward a domain `n` long.
function custom(n: number): [string, Lookup][] {
  const classifier = createClassifier({
    domains: [target(n)],
    maxEdits: 2,
    maxKeyDistance: Infinity,
  });
  return [
    ['suggestCorrection', (email) => classifier.suggestCorrection(email)],
    ['classify', (email) => classifier.classify(email)],
  ];
}

// Past RFC 5321's 254 characters, which the parser caps an address at:
// from just over it to 4 MiB. Each shape is exactly `n` long.
const oversizedShapes: Record<string, (n: number) => string> = {
  'a long local part': (n) => `${'a'.repeat(n - 10)}@gmail.com`,
  'a long domain': (n) => `ada@${'a'.repeat(n - 8)}.com`,
  'many labels': (n) => `ada@${labels(n - 4)}`,
  'a TLD typo': (n) => `ada@${labels(n - 4).slice(0, -3)}con`,
  'no @': (n) => 'a'.repeat(n),
  'all @': (n) => '@'.repeat(n),
};
const oversizes = [255, 1024, 65_536, 1 << 20, 4 << 20];

// Worst cases, doubling. Strings go through the parser, so they stop at its
// caps: 64 characters in the local part and 254 in all. A parsed address
// has no cap, so those run on to 4096.
const linear: readonly [
  string,
  (n: number) => Input,
  readonly number[],
  ((n: number) => [string, Lookup][])?,
][] = [
  ['a long local part', (n) => `${'a'.repeat(n)}@gmial.com`, [8, 16, 32, 64]],
  ['many labels', (n) => `a@${labels(n)}`, [16, 32, 64, 128, 252]],
  [
    'a near miss of a long custom domain',
    (n) => `a@${nearEdit(n)}`,
    [16, 32, 64, 128, 252],
    custom,
  ],
  [
    'a parsed long local part',
    (n) => parsed(`${'A'.repeat(n - 6)}+admin`, 'example.com'),
    [64, 128, 256, 512, 1024, 2048, 4096],
  ],
  [
    'a parsed domain of many labels',
    (n) => parsed('ada', labels(n)),
    [64, 128, 256, 512, 1024, 2048, 4096],
  ],
  [
    'a parsed domain of many internationalized labels',
    (n) => parsed('ada', `${'ü.'.repeat(Math.floor((n - 3) / 2))}com`),
    [64, 128, 256, 512, 1024, 2048, 4096],
  ],
  [
    'a parsed near miss of a long custom domain',
    (n) => parsed('ada', nearEdit(n)),
    [64, 128, 256, 512, 1024, 2048, 4096],
    custom,
  ],
];

const slip = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789.-@ü'.split(''),
);
// A common domain with up to three random slips, or a TLD typo.
const typoDomain = fc
  .tuple(
    fc.constantFrom(...targets),
    fc.array(fc.tuple(fc.nat(), slip, fc.boolean()), { maxLength: 3 }),
    fc.option(fc.constantFrom(...Object.keys(tldTypos)), { nil: undefined }),
  )
  .map(([domain, slips, tld]) => {
    let typo = domain;
    for (const [at, char, insert] of slips) {
      const i = at % typo.length;
      typo = typo.slice(0, i) + char + typo.slice(insert ? i : i + 1);
    }
    return tld === undefined
      ? typo
      : `${typo.slice(0, typo.lastIndexOf('.') + 1)}${tld}`;
  });
// Shapes that reach deep: up to the caps and past them, many labels, and
// U-labels.
const longDomain = fc
  .tuple(
    fc.integer({ min: 1, max: 126 }),
    fc.constantFrom('a', 'ü', 'mailinator', 'gmial', 'x-y'),
    fc.constantFrom('com', 'con', 'mailinator.com', 'fastmail.com'),
  )
  .map(([count, label, end]) => `${`${label}.`.repeat(count)}${end}`);
const localPart = fc.oneof(
  fc.constantFrom('ada', 'postmaster', 'Admin+alerts', 'no-reply'),
  fc.integer({ min: 1, max: 70 }).map((n) => 'a'.repeat(n)),
  fc.stringMatching(/^[a-zA-Z0-9._+-]{1,64}$/),
);
const text = fc.oneof(
  fc.string({ unit: 'binary', maxLength: 300 }),
  fc.string({
    unit: fc.constantFrom(...Array.from('a.-@+ü "\\()[]')),
    maxLength: 300,
  }),
);
const domainPart = fc.oneof(typoDomain, longDomain, fc.domain(), text);
// Strings from just past the cap to 1 MiB.
const huge = fc
  .tuple(
    fc.integer({ min: 255, max: 1 << 20 }),
    fc.constantFrom('a', 'a.', '@', 'ü', 'a@'),
  )
  .map(([n, unit]) => unit.repeat(Math.ceil(n / unit.length)));
const anyInput: Arbitrary<Input> = fc.oneof(
  fc
    .tuple(localPart, domainPart)
    .map(([local, domain]) => `${local}@${domain}`),
  text,
  huge,
  fc
    .tuple(localPart, domainPart)
    .map(([local, domain]) => parsed(local, domain)),
  fc.tuple(text, text).map(([local, domain]) => parsed(local, domain)),
);
// Custom domains up to the caps and past them, near the typos above, and
// the widest matching the options allow.
const anyOptions: Arbitrary<ClassifyOptions> = fc.record(
  {
    domains: fc.array(fc.oneof(typoDomain, longDomain), { maxLength: 8 }),
    ignore: fc.array(typoDomain, { maxLength: 4 }),
    keyboard: fc.constantFrom('qwerty', 'qwertz', 'azerty'),
    maxEdits: fc.constantFrom<0 | 1 | 2>(0, 1, 2),
    maxKeyDistance: fc.constantFrom(1, 2, Infinity),
  },
  { requiredKeys: [] },
);

// `undefined`, `false`, or a classification of nothing but those.
function knowsNothing(result: unknown): boolean {
  return typeof result === 'object' && result !== null
    ? Object.values(result).every(knowsNothing)
    : result === undefined || result === false;
}

function oversized(): Report['oversized'] {
  const classifier = createClassifier({ domains: ['example.com'] });
  return Object.entries(oversizedShapes).flatMap(([shape, build]) => {
    const emails = oversizes.map(build);
    return lookups(classifier).map(([lookup, run]) => {
      const results = emails.map((email) => run(email));
      const times = nsPerCall(
        emails.map((email) => () => run(email)),
        5,
      );
      return {
        lookup,
        shape,
        unknown: results.every(knowsNothing),
        times: oversizes.map((size, i) => ({ size, ns: times[i]! })),
      };
    });
  });
}

function isLinear(times: number[]): boolean {
  return times.every((ns, i) => i === 0 || ns / times[i - 1]! <= 2.5);
}

function linearity(): Report['linear'] {
  return linear.flatMap(
    ([shape, build, sizes, bound = () => lookups(createClassifier())]) =>
      bound(sizes[0]!).map(([lookup], index) => {
        // A lookup per size, since a custom domain's options depend on it.
        const runs = sizes.map((n) => {
          const run = bound(n)[index]![1];
          const email = build(n);
          return () => run(email);
        });
        // A series with a step over 2.5 is measured again, twice at most,
        // keeping each size's best: a slow patch on the runner can't hold
        // up a linear lookup three times running, and a quadratic one is
        // over every time.
        let times = nsPerCall(runs, 9, 1);
        for (let retry = 0; retry < 2 && !isLinear(times); retry++) {
          const again = nsPerCall(runs, 9, 1);
          times = times.map((ns, i) => Math.min(ns, again[i]!));
        }
        return {
          lookup,
          shape,
          times: sizes.map((size, i) => ({ size, ns: times[i]! })),
        };
      }),
  );
}

function adversarial(): Report['adversarial'] {
  const samples = fc.sample(
    fc.tuple(anyInput, fc.option(anyOptions, { nil: undefined })),
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- test/budgets.test.ts passes the seed
    { numRuns: 300, seed: workerData as number },
  );
  // Warm up, so the first inputs aren't timed before the JIT compiles.
  for (const [input, options] of samples) {
    for (const [, run] of lookups(createClassifier(options))) {
      run(input);
    }
  }
  const names = lookups(createClassifier()).map(([lookup]) => lookup);
  return names.map((lookup, index) => {
    const timed = samples.map(([input, options]) => {
      const run = lookups(createClassifier(options))[index]![1];
      return {
        lookup,
        ns: nsPerCall([() => run(input)], 3, 0.02)[0]!,
        input,
        options,
        run,
      };
    });
    // The slowest ten again, over more batches: an input that's slow only
    // because the runner was busy then gets a fair time.
    // oxlint-disable-next-line unicorn/no-array-sort -- timed is a fresh array
    const slowest = timed.sort((a, b) => b.ns - a.ns).slice(0, 10);
    for (const entry of slowest) {
      entry.ns = Math.min(
        entry.ns,
        nsPerCall([() => entry.run(entry.input)], 20, 0.02)[0]!,
      );
    }
    const { run: _, ...worst } = slowest.reduce((a, b) =>
      b.ns > a.ns ? b : a,
    );
    return worst;
  });
}

const report: Report = {
  oversized: oversized(),
  linear: linearity(),
  adversarial: adversarial(),
};

// oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker_threads port, not a window: it takes no origin
parentPort?.postMessage(report);
