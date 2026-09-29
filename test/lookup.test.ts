import type { ParsedAddress } from '@email-utils/validator-syntax';
import { describe, expect, it } from 'vitest';
import { getProvider, isRoleAccount } from '../src';
import * as providersEntry from '../src/providers';

function providerId(email: string | ParsedAddress): string | undefined {
  return getProvider(email)?.id;
}

function parsed(local: string, domain: string): ParsedAddress {
  return { local, domain, comments: [] };
}

describe('getProvider', () => {
  it('finds a provider by any of its domains', () => {
    expect(providerId('ada@gmail.com')).toBe('gmail');
    expect(providerId('ada@googlemail.com')).toBe('gmail');
    expect(providerId('ada@hotmail.co.uk')).toBe('outlook');
    expect(providerId('ada@ya.ru')).toBe('yandex');
  });

  it('returns the registry entry itself', () => {
    const gmail = providersEntry.providers.find(({ id }) => id === 'gmail');
    expect(getProvider('ada@gmail.com')).toBe(gmail);
  });

  it('ignores the case of the domain', () => {
    expect(providerId('Ada@GMail.COM')).toBe('gmail');
  });

  it('knows nothing of domains outside the registry', () => {
    expect(getProvider('ada@example.com')).toBeUndefined();
    expect(getProvider('ada@mail.gmail.com.example')).toBeUndefined();
  });

  it('matches one-label subdomains where the provider has subdomain addressing', () => {
    expect(providerId('news@ada.fastmail.com')).toBe('fastmail');
    expect(providerId('news@ada.fastmail.com.au')).toBe('fastmail');
  });

  it('matches no deeper subdomains, and none on other providers', () => {
    expect(getProvider('news@a.ada.fastmail.com')).toBeUndefined();
    expect(getProvider('ada@mail.gmail.com')).toBeUndefined();
    expect(getProvider('ada@.fastmail.com')).toBeUndefined();
  });

  it('knows nothing of a string the practical preset rejects', () => {
    for (const email of [
      '',
      'ada',
      'ada@',
      '@gmail.com',
      '@',
      '"a@b"@gmail.com',
      'ada@gmail.com@example.com',
      ' ada@gmail.com',
    ]) {
      expect(getProvider(email)).toBeUndefined();
    }
  });

  it('takes an address that is already parsed', () => {
    expect(providerId(parsed('ada', 'GMAIL.com'))).toBe('gmail');
    expect(getProvider(parsed('', 'gmail.com'))).toBeUndefined();
    expect(getProvider(parsed('ada', 'localhost'))).toBeUndefined();
    expect(getProvider(parsed('ada', '.fastmail.com'))).toBeUndefined();
  });

  it('is exported from /providers too', () => {
    expect(providersEntry.getProvider).toBe(getProvider);
  });
});

describe('isRoleAccount', () => {
  it('knows the RFC 2142 mailboxes', () => {
    for (const local of ['postmaster', 'abuse', 'hostmaster', 'webmaster']) {
      expect(isRoleAccount(`${local}@example.com`)).toBe(true);
    }
  });

  it('knows senders that take no replies, however they are spelled', () => {
    for (const local of ['noreply', 'no-reply', 'no_reply', 'donotreply']) {
      expect(isRoleAccount(`${local}@example.com`)).toBe(true);
    }
  });

  it('counts the quick start example', () => {
    expect(isRoleAccount('ceo@mailinator.com')).toBe(true);
    expect(isRoleAccount('admin@example.com')).toBe(true);
  });

  it('ignores case and a + tag', () => {
    expect(isRoleAccount('Admin@example.com')).toBe(true);
    expect(isRoleAccount('SUPPORT+billing@example.com')).toBe(true);
  });

  it('leaves people alone', () => {
    for (const local of [
      'ada',
      'ada.lovelace',
      'admins',
      'info.ada',
      '+admin',
    ]) {
      expect(isRoleAccount(`${local}@example.com`)).toBe(false);
    }
  });

  it('is false for a string the practical preset rejects', () => {
    expect(isRoleAccount('admin')).toBe(false);
    expect(isRoleAccount('admin@')).toBe(false);
    expect(isRoleAccount('"admin"@example.com')).toBe(false);
  });

  it('takes an address that is already parsed', () => {
    expect(isRoleAccount(parsed('Postmaster', 'example.com'))).toBe(true);
    expect(isRoleAccount(parsed('admin', ''))).toBe(false);
  });
});

describe('input', () => {
  it('throws TypeError for anything but a string or a parsed address', () => {
    for (const bad of [undefined, null, 42, {}, { local: 'ada' }]) {
      // @ts-expect-error: checking the runtime guard
      expect(() => getProvider(bad)).toThrow(TypeError);
      // @ts-expect-error: checking the runtime guard
      expect(() => isRoleAccount(bad)).toThrow(TypeError);
    }
    // @ts-expect-error: checking the runtime guard
    expect(() => getProvider(null)).toThrow(
      'Expected a string or a parsed address, got null',
    );
  });
});
