import {
  parseAddress,
  type ParsedAddress,
  type SyntaxOptions,
} from '@email-utils/validator-syntax';
import { syntaxFixtures } from '@email-utils/validator-syntax/fixtures';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { getProvider, isRoleAccount, suggestCorrection } from '../src';
import { lenientTld, partsOf } from '../src/address';
import { classify } from '../src/classify';
import { isDisposable } from '../src/disposable';

// The syntax corpus, split by the practical preset's verdict on each address.
const accepted = syntaxFixtures.filter(({ expected }) => expected.practical.ok);
const rejected = syntaxFixtures.filter(
  ({ expected }) => !expected.practical.ok,
);

const practical: SyntaxOptions = { preset: 'practical' };
const rfc5321: SyntaxOptions = { preset: 'rfc5321' };

/** The address parsed under `options`, which must accept it. */
function parse(address: string, options: SyntaxOptions): ParsedAddress {
  const result = parseAddress(address, options);
  if (!result.ok) {
    throw new Error(`${options.preset} rejects ${address}: ${result.reason}`);
  }
  return result.value;
}

/** The local part `parseAddress` finds under `options`, if it accepts. */
function localOf(address: string, options: SyntaxOptions): string | undefined {
  const result = parseAddress(address, options);
  return result.ok ? result.value.local : undefined;
}

describe('the classifier splits addresses as parseAddress does', () => {
  it('covers both sides of the corpus', () => {
    expect(accepted.length).toBeGreaterThan(0);
    expect(rejected.length).toBeGreaterThan(0);
  });

  it.each(accepted)('$address', ({ address }) => {
    const result = parseAddress(address, { preset: 'practical' });
    if (!result.ok) {
      throw new Error(`practical rejects ${address}: ${result.reason}`);
    }
    expect(partsOf(address)).toEqual(result.value);
    expect(getProvider(address)).toBe(getProvider(result.value));
    expect(isRoleAccount(address)).toBe(isRoleAccount(result.value));
  });

  it.each(rejected)('knows nothing of $address', ({ address }) => {
    expect(partsOf(address)).toBeUndefined();
    expect(getProvider(address)).toBeUndefined();
    expect(isRoleAccount(address)).toBe(false);
  });
});

// `practical` has no quoted local parts, so a string with one is something
// the classifier knows nothing of. A caller can still hand it one parsed
// under `rfc5321`; the lookups must then read the domain after the last
// `@`, as the parser split it, and a suggestion must keep the quoted local
// part whole so it parses back to the same halves.
describe('quoted local parts holding @, ., and +', () => {
  it.each([
    ['"ada@home"@gmial.com', '"ada@home"', '"ada@home"@gmail.com'],
    ['"ada.lovelace"@gmial.com', '"ada.lovelace"', '"ada.lovelace"@gmail.com'],
    ['"ada+tag"@gmail.con', '"ada+tag"', '"ada+tag"@gmail.com'],
    ['"a.b+c@d"@example.con', '"a.b+c@d"', '"a.b+c@d"@example.com'],
    [
      '"ada@gmail.com"@gmial.com',
      '"ada@gmail.com"',
      '"ada@gmail.com"@gmail.com',
    ],
    ['"a\\"@b"@gmial.com', '"a\\"@b"', '"a\\"@b"@gmail.com'],
  ])('%s splits at the last @', (address, local, suggestion) => {
    expect(parseAddress(address, practical).ok).toBe(false);
    expect(partsOf(address)).toBeUndefined();
    expect(classify(address)).toEqual({
      provider: undefined,
      disposable: false,
      role: false,
      suggestion: undefined,
    });

    const parts = parse(address, rfc5321);
    expect(parts.local).toBe(local);
    expect(partsOf(parts)).toBe(parts);
    expect(suggestCorrection(parts)).toBe(suggestion);
    expect(localOf(suggestion, rfc5321)).toBe(local);
  });

  it('takes the domain from after the last @, never from inside the quotes', () => {
    const inner = parse('"ada@gmail.com"@example.com', rfc5321);
    expect(getProvider(inner)).toBeUndefined();
    expect(isDisposable(inner)).toBe(false);
    expect(suggestCorrection(inner)).toBeUndefined();

    const outer = parse('"ada@example.com"@googlemail.com', rfc5321);
    expect(getProvider(outer)?.id).toBe('gmail');
    expect(isDisposable(parse('"ada@gmail.com"@mailinator.com', rfc5321))).toBe(
      true,
    );
    expect(classify(parse('"x@y"@mailinator.com', rfc5321)).disposable).toBe(
      true,
    );
  });

  // A quoted `"admin"` isn't the role check's business: it compares the
  // local part as written, and `practical` never gives it quotes.
  it('leaves the + tag inside the quotes to the role check', () => {
    expect(isRoleAccount(parse('"admin+x@y"@example.com', rfc5321))).toBe(
      false,
    );
  });

  it('keeps any quoted local part whole in a suggestion', () => {
    // qtextSMTP (printable ASCII but " and \), the three characters this
    // is about, and quoted pairs.
    const qcontent = fc.oneof(
      fc.constantFrom('@', '.', '+'),
      fc
        .integer({ min: 0x20, max: 0x7e })
        .filter((code) => code !== 0x22 && code !== 0x5c)
        .map((code) => String.fromCharCode(code)),
      fc.constantFrom('\\"', '\\\\', '\\@'),
    );
    const quoted = fc
      .array(qcontent, { minLength: 1, maxLength: 30 })
      .map((chars) => `"${chars.join('')}"`);
    const domains = fc.constantFrom(
      'gmial.com',
      'gmail.con',
      'hotmial.co.uk',
      'example.con',
      'gmail.com',
      'mailinator.com',
      'example.com',
    );
    fc.assert(
      fc.property(quoted, domains, (local, domain) => {
        const address = `${local}@${domain}`;
        const parts = parse(address, rfc5321);
        expect(parts.local).toBe(local);
        expect(parts.domain).toBe(domain);
        expect(partsOf(address)).toBeUndefined();

        // The quoted local part changes nothing the domain decides.
        const bare: ParsedAddress = { local: 'ada', domain, comments: [] };
        expect(getProvider(parts)).toBe(getProvider(bare));
        expect(isDisposable(parts)).toBe(isDisposable(bare));

        // The suggestion is the bare one's with the local part swapped in,
        // and parses back to it.
        const suggestion = suggestCorrection(parts);
        const forBare = suggestCorrection(bare);
        expect(suggestion).toBe(
          forBare === undefined
            ? undefined
            : `${local}@${forBare.slice('ada@'.length)}`,
        );
        expect(
          suggestion === undefined ? undefined : localOf(suggestion, rfc5321),
        ).toBe(suggestion === undefined ? undefined : local);
      }),
      { numRuns: 200 },
    );
  });
});

describe('generated addresses split as parseAddress splits them', () => {
  const tlds = fc.constantFrom('com', 'net', 'org', 'io', 'de', 'co.uk', 'con');
  const locals = fc
    .tuple(
      fc.stringMatching(
        /^[a-zA-Z0-9!#$%&'*/=?^_`{|}~-]{1,12}(\.[a-zA-Z0-9_-]{1,8}){0,2}$/,
      ),
      fc.option(fc.stringMatching(/^[a-zA-Z0-9_-]{0,8}$/), { nil: undefined }),
    )
    .map(([base, tag]) => (tag === undefined ? base : `${base}+${tag}`));
  const addresses = fc.oneof(
    fc.emailAddress(),
    // fast-check's TLDs are mostly not in the IANA set, which `practical`
    // checks; give some a real one.
    fc
      .tuple(fc.emailAddress(), tlds)
      .map(([email, tld]) => email.replace(/\.[^.@]+$/, `.${tld}`)),
    fc
      .tuple(
        locals,
        fc.constantFrom(
          'gmail.com',
          'gmial.com',
          'mailinator.com',
          'fastmail.com',
        ),
      )
      .map(([local, domain]) => `${local}@${domain}`),
    fc
      .tuple(locals, fc.domain(), tlds)
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
  );

  it('under both presets the classifier reads with', () => {
    fc.assert(
      fc.property(addresses, (email) => {
        const strict = parseAddress(email, practical);
        expect(partsOf(email)).toEqual(strict.ok ? strict.value : undefined);
        const lenient = parseAddress(email, lenientTld);
        expect(partsOf(email, lenientTld)).toEqual(
          lenient.ok ? lenient.value : undefined,
        );
      }),
      { numRuns: 300 },
    );
  });

  it('with the same answers from the string and the parsed address', () => {
    fc.assert(
      fc.property(addresses, (email) => {
        const result = parseAddress(email, practical);
        const parts = result.ok ? result.value : undefined;
        expect(getProvider(email)).toBe(
          parts === undefined ? undefined : getProvider(parts),
        );
        expect(isDisposable(email)).toBe(
          parts !== undefined && isDisposable(parts),
        );
        expect(isRoleAccount(email)).toBe(
          parts !== undefined && isRoleAccount(parts),
        );
        // A string `practical` rejects may still get a suggestion, from the
        // lenient parse; one it accepts gets the parsed address's.
        expect(suggestCorrection(email)).toBe(
          suggestCorrection(parts ?? email),
        );
      }),
      { numRuns: 300 },
    );
  });

  it('and a suggestion keeps the local part the parser found', () => {
    fc.assert(
      fc.property(addresses, (email) => {
        const suggestion = suggestCorrection(email);
        if (suggestion === undefined) {
          return;
        }
        const local = localOf(email, lenientTld);
        expect(local).toBeDefined();
        expect(localOf(suggestion, lenientTld)).toBe(local);
      }),
      { numRuns: 300 },
    );
  });
});
