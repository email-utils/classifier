import { domainToUnicode } from 'node:url';
import type { ParsedAddress } from '@email-utils/validator-syntax';
import { describe, expect, it } from 'vitest';
import * as root from '../src';
import { isDisposable } from '../src/disposable';
import { blocklist, maxDots } from '../src/disposable/data';
import { providers } from '../src/providers';

function parsed(local: string, domain: string): ParsedAddress {
  return { local, domain, comments: [] };
}

const listed = blocklist.split('\n');

describe('isDisposable', () => {
  it('finds a listed domain', () => {
    expect(isDisposable('ada@mailinator.com')).toBe(true);
    expect(isDisposable('ada@0-mail.com')).toBe(true);
  });

  it('finds a listed domain below a public suffix', () => {
    expect(isDisposable('ada@0-mailer.dynv6.net')).toBe(true);
    expect(isDisposable('ada@dynv6.net')).toBe(false);
  });

  it('finds subdomains of a listed domain', () => {
    expect(isDisposable('ada@x.mailinator.com')).toBe(true);
    expect(isDisposable('ada@a.b.c.mailinator.com')).toBe(true);
    const deepest = listed.find(
      (domain) => domain.split('.').length - 1 === maxDots,
    );
    expect(isDisposable(parsed('ada', `${'a.'.repeat(100)}${deepest}`))).toBe(
      true,
    );
    expect(isDisposable(parsed('ada', `.${deepest}`))).toBe(true);
  });

  it('matches whole labels only', () => {
    expect(isDisposable('ada@qqmailinator.com')).toBe(false);
    expect(isDisposable('ada@mailinator.com.example')).toBe(false);
  });

  it('ignores the case of the domain', () => {
    expect(isDisposable('Ada@MailInator.COM')).toBe(true);
    expect(isDisposable(parsed('ada', 'X.MAILINATOR.com'))).toBe(true);
  });

  it('knows nothing of domains off the list', () => {
    expect(isDisposable('ada@example.com')).toBe(false);
    expect(isDisposable('ada@gmail.com')).toBe(false);
  });

  it('matches an internationalized domain by its A-label', () => {
    const aLabel = listed.find((domain) => domain.includes('xn--')) ?? '';
    const uLabel = domainToUnicode(aLabel);
    expect(uLabel).not.toBe(aLabel);
    expect(isDisposable(parsed('ada', aLabel))).toBe(true);
    expect(isDisposable(parsed('ada', uLabel))).toBe(true);
    expect(isDisposable(parsed('ada', 'ü.mailinator.com'))).toBe(true);
    expect(isDisposable(parsed('ada', 'mailinätor.com'))).toBe(false);
    expect(isDisposable(parsed('ada', 'bad host.ü'))).toBe(false);
  });

  it('knows nothing of domain literals or dotless domains', () => {
    expect(isDisposable(parsed('ada', '[127.0.0.1]'))).toBe(false);
    expect(isDisposable(parsed('ada', 'localhost'))).toBe(false);
    expect(isDisposable(parsed('ada', 'com'))).toBe(false);
  });

  it('knows nothing of a string the practical preset rejects', () => {
    for (const email of ['', 'ada', 'ada@', '@mailinator.com', '"a@b"@x.io']) {
      expect(isDisposable(email)).toBe(false);
    }
  });

  it('throws TypeError for anything but a string or a parsed address', () => {
    for (const bad of [undefined, null, 42, {}, { local: 'ada' }]) {
      // @ts-expect-error: checking the runtime guard
      expect(() => isDisposable(bad)).toThrow(TypeError);
    }
  });

  it('is not re-exported from the root entry', () => {
    expect('isDisposable' in root).toBe(false);
  });
});

describe('the vendored list', () => {
  it('is sorted, unique, lowercase hostnames of two or more labels', () => {
    expect(listed.length).toBeGreaterThan(5000);
    // Each domain sorts strictly after the one before: ordered, no repeats.
    expect(
      listed.filter((domain, i) => i > 0 && (listed[i - 1] ?? '') >= domain),
    ).toEqual([]);
    for (const domain of listed) {
      expect(domain).toMatch(/^[a-z\d-]+(?:\.[a-z\d-]+)+$/);
    }
  });

  // isDisposable skips suffixes with more dots than this, so it must be the
  // list's deepest domain.
  it('records the most dots in a listed domain', () => {
    expect(maxDots).toBe(
      Math.max(...listed.map((domain) => domain.split('.').length - 1)),
    );
  });

  // A mailbox provider's domain on the list would flag real people's
  // addresses; a weekly refresh that adds one fails here and doesn't merge.
  it('holds no domain from the provider registry', () => {
    const providerDomains = providers.flatMap(({ domains }) => domains);
    expect(
      providerDomains.filter((domain) => isDisposable(`a@${domain}`)),
    ).toEqual([]);
  });
});
