import type { ParsedAddress } from '@email-utils/validator-syntax';
import { lenientTld, partsOf } from './address';
import { providers } from './providers/data';
import { type Keyboard, keyDistances } from './keyboard';
import { getProvider } from './providers/lookup';

// The domains a typo is corrected toward: the registry's widely used
// domains, most used first, since a tie goes to the earlier one. Most of
// Fastmail's hundred-odd alias domains are left out; as targets they'd turn
// `gmail.co.uk` into `fmail.co.uk`. So are names of three letters or fewer,
// like `me.com` and `gmx.de`, which are too close to other real domains to
// guess at (see `isTarget`). test/suggest.test.ts holds each one to the
// registry.
/** @internal */
export const targets: readonly string[] = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'live.com',
  'googlemail.com',
  'ymail.com',
  'rocketmail.com',
  'protonmail.com',
  'proton.me',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'hotmail.it',
  'hotmail.es',
  'hotmail.ca',
  'hotmail.com.br',
  'hotmail.com.au',
  'hotmail.co.jp',
  'live.co.uk',
  'live.fr',
  'live.de',
  'live.it',
  'live.nl',
  'live.ca',
  'live.com.au',
  'outlook.fr',
  'outlook.de',
  'outlook.es',
  'outlook.it',
  'outlook.jp',
  'outlook.com.br',
  'yahoo.co.uk',
  'yahoo.fr',
  'yahoo.de',
  'yahoo.es',
  'yahoo.it',
  'yahoo.ca',
  'yahoo.in',
  'yahoo.com.br',
  'yahoo.com.au',
  'aol.co.uk',
  'mail.ru',
  'inbox.ru',
  'list.ru',
  'yandex.ru',
  'yandex.com',
  'zoho.com',
  'zohomail.com',
  'fastmail.com',
  'fastmail.fm',
  'tutanota.com',
  'tuta.com',
];

// Widely used domains outside the registry that sit one edit from a target
// and would otherwise be "corrected" to it. The `ignore` option replaces
// them.
/** @internal */
export const defaultIgnore: readonly string[] = ['mail.com', 'email.com'];

// Top-level domains that aren't in the IANA set, and the one each is a slip
// for. test/suggest.test.ts holds every key to not being a real TLD.
/** @internal */
export const tldTypos: Readonly<Record<string, string>> = {
  con: 'com',
  cmo: 'com',
  ocm: 'com',
  vom: 'com',
  xom: 'com',
  cpm: 'com',
  cim: 'com',
  ckm: 'com',
  clm: 'com',
  cmm: 'com',
  comm: 'com',
  coom: 'com',
  ccom: 'com',
  comn: 'com',
  nte: 'net',
  ner: 'net',
  nwt: 'net',
  nett: 'net',
  ogr: 'org',
  orh: 'org',
  prg: 'org',
  ort: 'org',
  orgg: 'org',
};

const nonAscii = /\P{ASCII}/u;

// Names of three letters or fewer are left alone: `me.com` is one edit
// from dozens of real domains. So is a dotless domain, which only the
// `domains` option can bring, since a dotless domain is never corrected.
function isTarget(domain: string): boolean {
  return domain.indexOf('.') >= 4;
}

/** @internal */
export type Suggester = (email: string | ParsedAddress) => string | undefined;

/** How a suggester matches, all lowercase and checked. @internal */
export interface SuggestSettings {
  /** Corrected toward, ahead of the defaults, and never away from. */
  domains: readonly string[];
  /** Never corrected, and never corrected toward. */
  ignore: readonly string[];
  keyboard: Keyboard;
  maxEdits: number;
  maxKeyDistance: number;
}

const defaults: SuggestSettings = {
  domains: [],
  ignore: defaultIgnore,
  keyboard: 'qwerty',
  maxEdits: 1,
  maxKeyDistance: 1,
};

/** What a suggester measures with. */
interface Matcher {
  known: ReadonlySet<string>;
  all: readonly string[];
  keys: Uint8Array;
  maxEdits: number;
  maxKeyDistance: number;
}

let defaultSuggester: Suggester | undefined;

/** A suggester with `settings` applied over the defaults. @internal */
export function createSuggester(
  settings: Partial<SuggestSettings> = {},
): Suggester {
  const { domains, ignore, keyboard, maxEdits, maxKeyDistance } = {
    ...defaults,
    ...settings,
  };
  const ignored = new Set(ignore);
  const matcher: Matcher = {
    known: new Set([
      ...providers.flatMap((provider) => provider.domains),
      ...ignore,
      ...domains,
    ]),
    all: [...domains, ...targets].filter(
      (domain) => isTarget(domain) && !ignored.has(domain),
    ),
    keys: keyDistances(keyboard),
    maxEdits,
    maxKeyDistance,
  };
  return (email) => suggest(email, matcher);
}

/**
 * The address with its domain corrected, when the domain looks like a slip
 * for a common mailbox domain: `ada@gmial.com` gives `ada@gmail.com`, and
 * `ada@example.con` gives `ada@example.com`. `undefined` when the domain is
 * one the registry knows, or isn't close enough to one to guess.
 *
 * @remarks
 * The domain is compared without case, and the suggestion has it in
 * lowercase; the local part is kept as written. A domain one edit from a
 * common one is taken for it, where swapping two neighboring letters counts
 * as one edit, and so does a letter typed for one on a neighboring QWERTY
 * key; one typed for a letter farther away counts as two. Names of three
 * letters or fewer, like `me.com`, are never guessed at. A TLD that isn't in the IANA set but is a common slip
 * for `.com`, `.net`, or `.org` is fixed on any domain. Unlike the other
 * lookups, a string with an unknown TLD is still read, since those are what
 * the TLD fix is for.
 *
 * @example
 * ```ts
 * suggestCorrection('ada@gmial.com'); // 'ada@gmail.com'
 * suggestCorrection('ada@hotmial.con'); // 'ada@hotmail.com'
 * suggestCorrection('ada@gmail.com'); // undefined
 * ```
 *
 * @throws TypeError when `email` is neither a string nor a parsed address.
 */
export function suggestCorrection(
  email: string | ParsedAddress,
): string | undefined {
  defaultSuggester ??= createSuggester();
  return defaultSuggester(email);
}

function suggest(
  email: string | ParsedAddress,
  matcher: Matcher,
): string | undefined {
  const { known } = matcher;
  const parts = partsOf(email, lenientTld);
  if (parts === undefined) {
    return undefined;
  }
  const domain = parts.domain.toLowerCase();
  // Domain literals and dotless or internationalized domains are left
  // alone; so, after one Set lookup, is any domain that's spelled right.
  const dot = domain.lastIndexOf('.');
  if (
    known.has(domain) ||
    dot === -1 ||
    domain.startsWith('[') ||
    nonAscii.test(domain) ||
    getProvider(parts) !== undefined
  ) {
    return undefined;
  }
  // Fix the TLD first, so `gmial.con` is measured as `gmial.com`.
  const tld = domain.slice(dot + 1);
  if (!Object.hasOwn(tldTypos, tld)) {
    const corrected = nearest(domain, matcher);
    return corrected === undefined ? undefined : `${parts.local}@${corrected}`;
  }
  const fixed = domain.slice(0, dot + 1) + tldTypos[tld]!;
  const isKnown =
    known.has(fixed) || getProvider({ ...parts, domain: fixed }) !== undefined;
  return `${parts.local}@${(isKnown ? undefined : nearest(fixed, matcher)) ?? fixed}`;
}

// The first target closest to `domain`, within `maxEdits`. Known domains
// never get here, so none is at distance 0, and the first at distance 1
// ends the search. More than one edit reaches too far by default: two
// turned distinct disposable services like yopmail.com into hotmail.com,
// which test/suggest.test.ts guards against.
function nearest(domain: string, matcher: Matcher): string | undefined {
  let best: string | undefined;
  let limit = matcher.maxEdits;
  for (const target of matcher.all) {
    if (limit === 0) {
      break;
    }
    if (Math.abs(target.length - domain.length) > limit) {
      continue;
    }
    const distance = editDistance(domain, target, limit, matcher);
    if (distance <= limit) {
      best = target;
      limit = distance - 1;
    }
  }
  return best;
}

// Rows reused across calls, grown for a longer target, which only a parsed
// address or a `domains` option can bring.
let before = new Uint16Array(256);
let previous = new Uint16Array(256);
let current = new Uint16Array(256);

/**
 * The optimal string alignment distance between `a` and `b`: insertions,
 * deletions, and swaps of neighboring characters, each one edit, and
 * substitutions, one edit for keys up to `maxKeyDistance` apart and two,
 * the same as a deletion and an insertion, for keys farther apart. Stops
 * early, returning `limit + 1`, once it must exceed `limit`.
 */
function editDistance(
  a: string,
  b: string,
  limit: number,
  { keys, maxKeyDistance }: Matcher,
): number {
  if (b.length + 1 > current.length) {
    const size = b.length + 1;
    before = new Uint16Array(size);
    previous = new Uint16Array(size);
    current = new Uint16Array(size);
  }
  for (let j = 0; j <= b.length; j++) {
    previous[j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowMin = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j++) {
      const bj = b.charCodeAt(j - 1);
      let value = Math.min(
        previous[j]! + 1,
        current[j - 1]! + 1,
        previous[j - 1]! +
          (ai === bj
            ? 0
            : ((ai | bj) < 128 ? keys[ai * 128 + bj]! : 255) <= maxKeyDistance
              ? 1
              : 2),
      );
      if (
        i > 1 &&
        j > 1 &&
        ai === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === bj
      ) {
        value = Math.min(value, before[j - 2]! + 1);
      }
      current[j] = value;
      if (value < rowMin) {
        rowMin = value;
      }
    }
    if (rowMin > limit) {
      return limit + 1;
    }
    [before, previous, current] = [previous, current, before];
  }
  return previous[b.length]!;
}
