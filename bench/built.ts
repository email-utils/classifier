import { createRequire } from 'node:module';
import type * as Classify from '../src/classify';
import type * as Disposable from '../src/disposable';
import type * as Root from '../src/index';

// The benches measure the built package, loaded as CommonJS through Node's
// own `require`. Importing src/ would run it through Vitest's module runner,
// whose export getters more than double a 30 ns lookup (Vitest warns about
// it), and would put the targets out of reach of the code users run.
// `npm run bench` builds first; run `npm run build` before a bare
// `vitest bench`, or it measures whatever dist/ holds.
const require = createRequire(import.meta.url);

export const root: typeof Root = require('../dist/index.cjs');
export const disposable: typeof Disposable = require('../dist/disposable.cjs');
export const classifyEntry: typeof Classify = require('../dist/classify.cjs');
