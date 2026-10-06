import type { ParsedAddress } from '@email-utils/validator-syntax';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { getProvider, isRoleAccount, suggestCorrection } from '../src';
import { partsOf, lenientTld } from '../src/address';
import {
  classify,
  createClassifier,
  defaultIgnore,
  type ClassifyOptions,
  type Keyboard,
} from '../src/classify';
import { isDisposable } from '../src/disposable';
import { blocklist } from '../src/disposable/data';
import { providers } from '../src/providers';
import { targets, tldTypos } from '../src/suggest';

// The classifier has no `isX()` beside an `x()` that returns `{ ok, … }`:
// every lookup answers directly. What summarizes something else is
// `classify`, whose four fields are each a check on its own, and
// `createClassifier`, whose checks are the standalone ones with options
// bound. The agreement properties below hold those to each other.

function parsed(local: string, domain: string): ParsedAddress {
  return { local, domain, comments: [] };
}

// Any UTF-16 code unit, lone surrogates included.
const codeUnit = fc
  .integer({ min: 0, max: 0xffff })
  .map((code) => String.fromCharCode(code));

// C0 and C1 controls, DEL, and invisible or line-breaking code points.
const control = fc.oneof(
  fc.integer({ min: 0, max: 0x1f }).map((code) => String.fromCharCode(code)),
  fc.integer({ min: 0x7f, max: 0x9f }).map((code) => String.fromCharCode(code)),
  fc.constantFrom('​', '‍', ' ', ' ', '﻿'),
);

// Characters that mean something to the address grammar.
const special = fc.constantFrom(
  '@',
  '.',
  '+',
  '-',
  '"',
  '\\',
  '[',
  ']',
  '(',
  ')',
  ' ',
  ':',
);

const piece = fc.oneof(
  fc.string({ unit: 'grapheme' }),
  fc.string({ unit: codeUnit }),
  fc.string({ unit: control }),
  fc.string({ unit: special }),
  fc.string({ unit: fc.oneof(fc.string({ unit: 'binary-ascii' }), special) }),
  fc.domain(),
);

// A domain one random slip from a target or from a TLD `tldTypos` fixes,
// so suggestions come up often enough to be compared.
const slip = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789.-'.split(''),
);
const typoDomain = fc
  .tuple(
    fc.constantFrom(...targets, 'example.com', 'company.org'),
    fc.constantFrom('insert', 'delete', 'replace', 'swap', 'tld', 'none'),
    fc.nat(),
    slip,
    fc.constantFrom(...Object.keys(tldTypos)),
  )
  .map(([domain, edit, at, char, tld]) => {
    const i = at % domain.length;
    switch (edit) {
      case 'insert':
        return domain.slice(0, i) + char + domain.slice(i);
      case 'delete':
        return domain.slice(0, i) + domain.slice(i + 1);
      case 'replace':
        return domain.slice(0, i) + char + domain.slice(i + 1);
      case 'swap':
        return i + 1 < domain.length
          ? domain.slice(0, i) +
              domain[i + 1]! +
              domain[i]! +
              domain.slice(i + 2)
          : domain;
      case 'tld':
        return `${domain.slice(0, domain.lastIndexOf('.'))}.${tld}`;
      default:
        return domain;
    }
  });

const localPart = fc.oneof(
  fc.constantFrom('ada', 'Ada.Lovelace', 'admin', 'postmaster', 'no-reply'),
  fc
    .tuple(
      fc.stringMatching(/^[a-zA-Z0-9_-]{1,12}(\.[a-zA-Z0-9_-]{1,12}){0,2}$/),
      fc.option(fc.stringMatching(/^[a-zA-Z0-9_-]{0,10}$/), { nil: undefined }),
    )
    .map(([base, tag]) => (tag === undefined ? base : `${base}+${tag}`)),
);

const typoAddress = fc
  .tuple(localPart, fc.mixedCase(typoDomain))
  .map(([local, domain]) => `${local}@${domain}`);

// Every provider domain, and for providers with subdomain addressing, a
// one-label subdomain of one.
const registryDomain = fc.oneof(
  fc.constantFrom(...providers.flatMap(({ domains }) => domains)),
  fc
    .tuple(
      fc.stringMatching(/^[a-z0-9]{1,10}$/),
      fc.constantFrom(
        ...providers
          .filter(({ subdomainAddressing }) => subdomainAddressing)
          .flatMap(({ domains }) => domains),
      ),
    )
    .map(([label, domain]) => `${label}.${domain}`),
);

const listedDomain = fc.constantFrom(...blocklist.split('\n'));

// An address on a domain the registry or the blocklist knows.
const knownAddress = fc
  .tuple(localPart, fc.mixedCase(fc.oneof(registryDomain, listedDomain)))
  .map(([local, domain]) => `${local}@${domain}`);

// Any string: arbitrary text, very long text, and strings shaped enough
// like an address to get past the parser.
const anyString = fc.oneof(
  piece,
  fc.string({ unit: 'binary', minLength: 1000, maxLength: 5000 }),
  fc
    .tuple(fc.integer({ min: 1, max: 5000 }), fc.boolean())
    .map(([n, inLocal]) =>
      inLocal ? `${'a'.repeat(n)}@gmial.com` : `ada@${'a'.repeat(n)}.con`,
    ),
  fc.emailAddress(),
  typoAddress,
  knownAddress,
  fc.tuple(piece, piece).map(([local, domain]) => `${local}@${domain}`),
  fc.tuple(piece, typoDomain).map(([local, domain]) => `${local}@${domain}`),
);

// A parsed address holding any strings, as a caller may build one.
const anyParsed = fc
  .tuple(
    fc.oneof(anyString, localPart),
    fc.oneof(anyString, typoDomain, registryDomain, listedDomain),
  )
  .map(([local, domain]) => parsed(local, domain));

const anyEmail = fc.oneof(anyString, anyParsed);

// Options of the right types, any values in them: malformed options are
// documented to throw, so they're left to test/classify.test.ts.
const domainList = fc.array(
  fc.oneof(typoDomain, fc.domain(), fc.mixedCase(fc.domain()), piece),
  { maxLength: 4 },
);
const anyOptions: fc.Arbitrary<ClassifyOptions> = fc.record(
  {
    domains: fc.option(domainList, { nil: undefined }),
    ignore: fc.option(domainList, { nil: undefined }),
    keyboard: fc.constantFrom<Keyboard | undefined>(
      'qwerty',
      'qwertz',
      'azerty',
      undefined,
    ),
    maxEdits: fc.constantFrom<0 | 1 | 2 | undefined>(0, 1, 2, undefined),
    maxKeyDistance: fc.oneof(
      fc.integer({ min: 1, max: 300 }),
      fc.constant(Infinity),
      fc.constant(undefined),
    ),
  },
  { requiredKeys: [] },
);

describe('never throws on a string or a parsed address', () => {
  it('getProvider', () => {
    fc.assert(
      fc.property(anyEmail, (email) => {
        const provider = getProvider(email);
        expect(provider === undefined || providers.includes(provider)).toBe(
          true,
        );
      }),
      { numRuns: 200 },
    );
  });

  it('isRoleAccount', () => {
    fc.assert(
      fc.property(anyEmail, (email) => {
        expect(typeof isRoleAccount(email)).toBe('boolean');
      }),
      { numRuns: 200 },
    );
  });

  it('isDisposable', () => {
    fc.assert(
      fc.property(anyEmail, (email) => {
        expect(typeof isDisposable(email)).toBe('boolean');
      }),
      { numRuns: 200 },
    );
  });

  it('suggestCorrection', () => {
    fc.assert(
      fc.property(anyEmail, (email) => {
        const suggestion = suggestCorrection(email);
        expect(suggestion === undefined || typeof suggestion === 'string').toBe(
          true,
        );
      }),
      { numRuns: 200 },
    );
  });

  it('classify', () => {
    fc.assert(
      fc.property(anyEmail, (email) => {
        expect(Object.keys(classify(email))).toEqual([
          'provider',
          'disposable',
          'role',
          'suggestion',
        ]);
      }),
      { numRuns: 200 },
    );
  });

  it('classify and createClassifier, with any well-formed options', () => {
    fc.assert(
      fc.property(anyEmail, anyOptions, (email, options) => {
        const classifier = createClassifier(options);
        expect(() => {
          classify(email, options);
          classifier.classify(email);
          classifier.suggestCorrection(email);
        }).not.toThrow();
      }),
    );
  });

  // A domain as long as the `domains` option allows grows the rows the
  // edit distance reuses, and a later, shorter one must still fit.
  it('suggestCorrection after measuring a long domain', () => {
    fc.assert(
      fc.property(fc.integer({ min: 250, max: 2000 }), anyEmail, (n, email) => {
        const long = `${'a'.repeat(n)}.example`;
        const classifier = createClassifier({ domains: [long] });
        expect(
          classifier.suggestCorrection(
            parsed('ada', `${'a'.repeat(n)}.exampel`),
          ),
        ).toBe(`ada@${long}`);
        expect(() => suggestCorrection(email)).not.toThrow();
      }),
      { numRuns: 20 },
    );
  });
});

describe('classify agrees with the checks it summarizes', () => {
  it('with the default options', () => {
    fc.assert(
      fc.property(anyEmail, (email) => {
        const result = classify(email);
        expect(result.provider).toBe(getProvider(email));
        expect(result.disposable).toBe(isDisposable(email));
        expect(result.role).toBe(isRoleAccount(email));
        expect(result.suggestion).toBe(suggestCorrection(email));
      }),
      { numRuns: 300 },
    );
  });

  it('with any options, through createClassifier', () => {
    fc.assert(
      fc.property(anyEmail, anyOptions, (email, options) => {
        const classifier = createClassifier(options);
        const result = classifier.classify(email);
        expect(result.provider).toBe(classifier.getProvider(email));
        expect(result.disposable).toBe(classifier.isDisposable(email));
        expect(result.role).toBe(classifier.isRoleAccount(email));
        expect(result.suggestion).toBe(classifier.suggestCorrection(email));
        expect(classify(email, options)).toEqual(result);
        // Options only change the suggestion; the other checks are the
        // standalone ones.
        expect(result.provider).toBe(getProvider(email));
        expect(result.disposable).toBe(isDisposable(email));
        expect(result.role).toBe(isRoleAccount(email));
      }),
    );
  });

  // Each option's documented default is what suggestCorrection uses.
  it('suggests as suggestCorrection does with no options or the defaults spelled out', () => {
    const none = createClassifier();
    const empty = createClassifier({});
    const spelledOut = createClassifier({
      ignore: [...defaultIgnore],
      keyboard: 'qwerty',
      maxEdits: 1,
      maxKeyDistance: 1,
    });
    fc.assert(
      fc.property(fc.oneof(typoAddress, anyEmail), (email) => {
        const suggestion = suggestCorrection(email);
        expect(none.suggestCorrection(email)).toBe(suggestion);
        expect(empty.suggestCorrection(email)).toBe(suggestion);
        expect(spelledOut.suggestCorrection(email)).toBe(suggestion);
      }),
      { numRuns: 300 },
    );
  });
});

describe('documented invariants', () => {
  it('isRoleAccount ignores the case of the local part and a + tag', () => {
    const local = fc.oneof(
      fc.constantFrom('admin', 'postmaster', 'no-reply', 'do_not_reply', 'ceo'),
      fc.stringMatching(/^[a-z0-9._-]{1,16}$/),
    );
    fc.assert(
      fc.property(
        local.chain((base) =>
          fc.tuple(fc.constant(base), fc.mixedCase(fc.constant(base))),
        ),
        fc.stringMatching(/^[a-zA-Z0-9._+-]{0,12}$/),
        fc.oneof(fc.domain(), typoDomain),
        ([base, cased], tag, domain) => {
          const role = isRoleAccount(parsed(base, domain));
          expect(isRoleAccount(parsed(cased, domain))).toBe(role);
          expect(isRoleAccount(parsed(`${cased}+${tag}`, domain))).toBe(role);
        },
      ),
    );
  });

  it('the domain lookups ignore the case of the domain', () => {
    fc.assert(
      fc.property(
        fc
          .oneof(registryDomain, typoDomain, fc.domain(), listedDomain)
          .chain((domain) =>
            fc.tuple(fc.constant(domain), fc.mixedCase(fc.constant(domain))),
          ),
        localPart,
        ([domain, cased], local) => {
          expect(getProvider(parsed(local, cased))).toBe(
            getProvider(parsed(local, domain)),
          );
          expect(isDisposable(parsed(local, cased))).toBe(
            isDisposable(parsed(local, domain)),
          );
          expect(suggestCorrection(parsed(local, cased))).toBe(
            suggestCorrection(parsed(local, domain.toLowerCase())),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('isDisposable finds any subdomain of a listed domain', () => {
    fc.assert(
      fc.property(fc.domain(), listedDomain, (prefix, listed) => {
        expect(isDisposable(parsed('ada', listed))).toBe(true);
        expect(isDisposable(parsed('ada', `${prefix}.${listed}`))).toBe(true);
      }),
    );
  });

  it('suggestCorrection leaves any domain the registry knows alone', () => {
    fc.assert(
      fc.property(localPart, fc.mixedCase(registryDomain), (local, domain) => {
        const email = `${local}@${domain}`;
        expect(getProvider(email)).toBeDefined();
        expect(suggestCorrection(email)).toBeUndefined();
        expect(classify(email).suggestion).toBeUndefined();
      }),
      { numRuns: 200 },
    );
  });

  it('suggestCorrection keeps the local part as written and lowercases the domain', () => {
    fc.assert(
      fc.property(fc.oneof(typoAddress, anyEmail), (email) => {
        const suggestion = suggestCorrection(email);
        if (suggestion === undefined) {
          return;
        }
        const parts = partsOf(email, lenientTld);
        if (parts === undefined) {
          throw new Error(
            `suggested ${suggestion} for an address it can’t read`,
          );
        }
        const { local, domain } = parts;
        expect(suggestion.startsWith(`${local}@`)).toBe(true);
        const corrected = suggestion.slice(local.length + 1);
        expect(corrected).toBe(corrected.toLowerCase());
        expect(corrected).not.toBe(domain.toLowerCase());
      }),
      { numRuns: 300 },
    );
  });

  it('createClassifier never corrects toward a domain in ignore', () => {
    fc.assert(
      fc.property(
        fc.oneof(typoAddress, anyEmail),
        anyOptions,
        (email, options) => {
          const suggestion = createClassifier(options).suggestCorrection(email);
          if (suggestion === undefined) {
            return;
          }
          // A parsed address can have an @ in its domain, so the local part
          // is sliced off rather than split on.
          const { local } = partsOf(email, lenientTld)!;
          const domain = suggestion.slice(local.length + 1);
          const ignore = [...(options.ignore ?? defaultIgnore), domain];
          const ignoring = createClassifier({ ...options, ignore });
          expect(ignoring.suggestCorrection(email)).not.toBe(suggestion);
        },
      ),
      { numRuns: 300 },
    );
  });
});
