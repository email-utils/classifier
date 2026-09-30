// Import cost and retained heap for each built entry (classifier#11), both
// as ESM and as CommonJS. Every sample is a fresh `node --expose-gc` process
// that loads one entry from dist/, then makes a first call, and reports how
// long each took and how much heap each left behind after gc(). The check
// takes the median of several processes and fails when it's over the
// entry's budget. The first call counts because lookup tables are built on
// first use: that's where #9's "first use ≤ 5 ms" and most of the heap a
// caller keeps come from.
//
//   node scripts/import-cost.ts
//
// Run it after `npm run build`; `npm run check:package` does, after
// size-limit.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Each is the median over the processes. */
interface Budget {
  /** Import time, in milliseconds. */
  importMs: number;
  /** Import and first call, in milliseconds. */
  firstUseMs: number;
  /** Heap retained after the import, in KB. */
  importKb: number;
  /** Heap retained after the first call, in KB. */
  firstUseKb: number;
}

interface Entry {
  budget: Budget;
  /** A first call on the imported module `m`, given `parsed`, an address. */
  firstUse?: string;
}

// Budgets are about three times the time and 1.5 times the heap measured
// locally (the classifier#11 PR has the numbers), since import time on a
// shared CI runner is noisy: they catch a new eager table or dependency, not
// a few percent.
const entries: Record<string, Entry> = {
  '.': {
    budget: { importMs: 6, firstUseMs: 12, importKb: 650, firstUseKb: 750 },
    // Builds the provider index and the default suggester.
    firstUse: 'm.suggestCorrection(parsed)',
  },
  './providers': {
    budget: { importMs: 5, firstUseMs: 6, importKb: 550, firstUseKb: 600 },
    firstUse: 'm.getProvider(parsed)',
  },
  './sources': {
    budget: { importMs: 1.5, firstUseMs: 1.5, importKb: 250, firstUseKb: 250 },
  },
  './disposable': {
    budget: { importMs: 6, firstUseMs: 10, importKb: 900, firstUseKb: 1800 },
    // Builds the blocklist's set.
    firstUse: 'm.isDisposable(parsed)',
  },
  './classify': {
    budget: { importMs: 8, firstUseMs: 16, importKb: 1100, firstUseKb: 2100 },
    firstUse: 'm.classify(parsed)',
  },
};

const PROCESSES = 7;

const root = new URL('../', import.meta.url);
const manifest: {
  exports: Record<string, string | Record<string, string>>;
} = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));

// The child loads the entry and makes the first call, reading the heap
// before and after each once gc() stops freeing anything: a single gc()
// sometimes leaves a few hundred KB it frees on the next tick. A data:
// import first sets up the ESM loader, so its cost isn't counted against
// the entry.
function childSource(
  file: string,
  format: 'import' | 'require',
  firstUse = '',
): string {
  const load =
    format === 'import'
      ? `await import(${JSON.stringify(pathToFileURL(file).href)})`
      : `require(${JSON.stringify(file)})`;
  return `
import { createRequire } from 'node:module';
const require = createRequire(${JSON.stringify(pathToFileURL(file).href)});
await import('data:text/javascript,export {}');
async function heap() {
  let last = Infinity;
  for (let i = 0; i < 10; i++) {
    globalThis.gc();
    await new Promise((resolve) => setImmediate(resolve));
    const used = process.memoryUsage().heapUsed;
    if (used >= last) {
      break;
    }
    last = used;
  }
  return last;
}
// A parsed address, so the first call counts the classifier's own tables
// and not validator-syntax's first parse.
const parsed = { local: 'ada', domain: 'gmial.com', comments: [] };
const before = await heap();
let start = performance.now();
const m = ${load};
const importMs = performance.now() - start;
const importKb = ((await heap()) - before) / 1024;
start = performance.now();
${firstUse};
const firstUseMs = importMs + performance.now() - start;
const firstUseKb = ((await heap()) - before) / 1024;
process.stdout.write(
  JSON.stringify({ importMs, firstUseMs, importKb, firstUseKb }),
);
`;
}

function sample(
  file: string,
  format: 'import' | 'require',
  firstUse?: string,
): Budget {
  const child = spawnSync(
    process.execPath,
    [
      '--expose-gc',
      '--input-type=module',
      '--eval',
      childSource(file, format, firstUse),
    ],
    { cwd: fileURLToPath(root), encoding: 'utf8' },
  );
  if (child.status !== 0) {
    throw new Error(`${file}: exited ${child.status}\n${child.stderr}`);
  }
  const measured: Budget = JSON.parse(child.stdout);
  return measured;
}

function median(values: number[]): number {
  // Sorted in place on a copy: ES2022 has no `toSorted`.
  const sorted = [...values];
  sorted.sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

const rows: string[] = [];
let failed = false;
for (const [name, target] of Object.entries(manifest.exports)) {
  if (name === './package.json' || typeof target === 'string') {
    continue;
  }
  const entry = entries[name];
  if (entry === undefined) {
    throw new Error(`No import-cost budget for ${name}`);
  }
  for (const format of ['import', 'require'] as const) {
    const path = target[format];
    if (path === undefined) {
      continue;
    }
    const file = fileURLToPath(new URL(path, root));
    const samples = Array.from({ length: PROCESSES }, () =>
      sample(file, format, entry.firstUse),
    );
    const of = (key: keyof Budget): number =>
      median(samples.map((s) => s[key]));
    const measured: Budget = {
      importMs: of('importMs'),
      firstUseMs: of('firstUseMs'),
      importKb: of('importKb'),
      firstUseKb: of('firstUseKb'),
    };
    const over = (
      ['importMs', 'firstUseMs', 'importKb', 'firstUseKb'] as const
    ).filter((key) => measured[key] > entry.budget[key]);
    failed ||= over.length > 0;
    const { budget } = entry;
    rows.push(
      [
        `${name} (${format})`.padEnd(26),
        `${measured.importMs.toFixed(2)} / ${budget.importMs} ms`.padEnd(16),
        `${measured.firstUseMs.toFixed(2)} / ${budget.firstUseMs} ms`.padEnd(
          16,
        ),
        `${Math.round(measured.importKb)} / ${budget.importKb} KB`.padEnd(16),
        `${Math.round(measured.firstUseKb)} / ${budget.firstUseKb} KB`.padEnd(
          16,
        ),
        over.length > 0 ? `over: ${over.join(', ')}` : 'ok',
      ].join(' '),
    );
  }
}

process.stdout.write(
  [
    `Import cost, median of ${PROCESSES} processes (measured / budget):`,
    `${'entry'.padEnd(26)} ${'import'.padEnd(16)} ${'first use'.padEnd(16)} ${'heap, import'.padEnd(16)} ${'heap, first use'.padEnd(16)}`,
    ...rows,
    '',
  ].join('\n'),
);
if (failed) {
  process.stderr.write('Import cost is over budget.\n');
  process.exitCode = 1;
}
