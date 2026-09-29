import { describe, expect, it } from 'vitest';
import { providers, type ProviderInfo } from '../src/providers';
import { providerSources, type ProviderRule } from '../src/sources';

const byId = new Map(providers.map((provider) => [provider.id, provider]));

function entry(id: string): ProviderInfo {
  const found = byId.get(id);
  if (found === undefined) {
    throw new Error(`no provider ${id}`);
  }
  return found;
}

// A lowercase host name: LDH labels, no trailing dot.
const HOST = /^(?!-)[a-z\d-]{1,63}(?<!-)(\.(?!-)[a-z\d-]{1,63}(?<!-))+$/;

// The rules an entry must cite: its MX patterns, its domains if any, and
// every rule that isn't the default.
function requiredRules(p: ProviderInfo): ProviderRule[] {
  return [
    'mxPatterns',
    ...(p.domains.length > 0 ? (['domains'] as const) : []),
    ...(p.canonicalDomain === undefined ? [] : (['canonicalDomain'] as const)),
    ...(p.dotsSignificant ? [] : (['dotsSignificant'] as const)),
    ...(p.hyphensSignificant ? [] : (['hyphensSignificant'] as const)),
    ...(p.subaddressSeparator === undefined
      ? []
      : (['subaddressSeparator'] as const)),
    ...(p.subdomainAddressing ? (['subdomainAddressing'] as const) : []),
  ];
}

describe('the registry', () => {
  it('covers every provider classifier#7 lists', () => {
    expect(new Set(byId.keys())).toEqual(
      new Set([
        'aol',
        'fastmail',
        'gmail',
        'gmx',
        'google-workspace',
        'hey',
        'icloud',
        'mail-ru',
        'microsoft365',
        'namecheap',
        'outlook',
        'proton',
        'tuta',
        'web-de',
        'yahoo',
        'yandex',
        'yandex-360',
        'zoho',
        'zoho-business',
      ]),
    );
  });

  it('has unique, lowercase kebab-case IDs', () => {
    expect(byId.size).toBe(providers.length);
    for (const { id } of providers) {
      expect(id).toMatch(/^[a-z\d]+(-[a-z\d]+)*$/);
    }
  });

  it('gives each domain to one provider, as a lowercase host name', () => {
    const domains = providers.flatMap((p) => p.domains);
    expect(domains.filter((domain) => !HOST.test(domain))).toEqual([]);
    expect(new Set(domains).size).toBe(domains.length);
  });

  it('writes MX patterns as host names with an optional leading *.', () => {
    for (const { mxPatterns } of providers) {
      expect(mxPatterns.length).toBeGreaterThan(0);
      for (const pattern of mxPatterns) {
        expect(pattern.replace(/^\*\./, '')).toMatch(HOST);
      }
    }
  });

  it('keeps each canonical domain among its own domains', () => {
    const stray = providers.filter(
      ({ canonicalDomain, domains }) =>
        canonicalDomain !== undefined && !domains.includes(canonicalDomain),
    );
    expect(stray.map(({ id }) => id)).toEqual([]);
  });

  it('uses a single-character subaddress separator', () => {
    const separators = providers.flatMap(({ subaddressSeparator }) =>
      subaddressSeparator === undefined ? [] : [subaddressSeparator],
    );
    expect(separators.filter((separator) => separator.length !== 1)).toEqual(
      [],
    );
  });

  it('lists domains for personal providers only', () => {
    for (const { kind, domains } of providers) {
      expect(domains.length > 0).toBe(kind === 'personal');
    }
  });

  it('only gives subdomain addressing to providers with domains', () => {
    const stray = providers.filter(
      ({ subdomainAddressing, domains }) =>
        subdomainAddressing && domains.length === 0,
    );
    expect(stray.map(({ id }) => id)).toEqual([]);
  });
});

describe('provider rules', () => {
  it('ignores dots on gmail.com and googlemail.com', () => {
    expect(entry('gmail')).toMatchObject({
      domains: ['gmail.com', 'googlemail.com'],
      canonicalDomain: 'gmail.com',
      dotsSignificant: false,
      subaddressSeparator: '+',
    });
  });

  it('keeps dots significant on Google Workspace, which Google documents', () => {
    expect(entry('google-workspace')).toMatchObject({
      kind: 'business',
      domains: [],
      dotsSignificant: true,
    });
  });

  it('keeps Gmail and Google Workspace MX patterns apart', () => {
    const gmail = entry('gmail').mxPatterns;
    for (const pattern of entry('google-workspace').mxPatterns) {
      expect(gmail).not.toContain(pattern);
    }
    expect(entry('google-workspace').mxPatterns).toContain('smtp.google.com');
  });

  it('matches Microsoft 365 and Outlook.com MX by their own subdomains', () => {
    expect(entry('microsoft365').mxPatterns).toContain(
      '*.mail.protection.outlook.com',
    );
    expect(entry('outlook').mxPatterns).toEqual([
      '*.olc.protection.outlook.com',
    ]);
  });

  it('ignores the hyphen/dot difference on Yandex only', () => {
    expect(
      providers.filter((p) => !p.hyphensSignificant).map(({ id }) => id),
    ).toEqual(['yandex']);
  });

  it('matches Microsoft 365 by its DNSSEC mx.microsoft hosts too', () => {
    expect(entry('microsoft365').mxPatterns).toContain('*.mx.microsoft');
  });

  it('keeps personal and business MX apart for Zoho and Yandex', () => {
    for (const [personal, business] of [
      ['zoho', 'zoho-business'],
      ['yandex', 'yandex-360'],
    ] as const) {
      const shared = entry(business).mxPatterns.filter((pattern) =>
        entry(personal).mxPatterns.includes(pattern),
      );
      expect(shared).toEqual([]);
      expect(entry(business).kind).toBe('business');
    }
  });

  it('gives Fastmail subdomain addressing', () => {
    expect(entry('fastmail')).toMatchObject({
      subaddressSeparator: '+',
      subdomainAddressing: true,
    });
    expect(entry('fastmail').domains).toContain('fastmail.com');
  });

  it('marks the registrar default MX', () => {
    expect(entry('namecheap')).toMatchObject({
      kind: 'registrar',
      domains: [],
    });
  });

  it('adds no separator a provider does not document', () => {
    const undocumented = ['yahoo', 'aol', 'icloud', 'zoho', 'gmx', 'tuta'];
    expect(
      undocumented.filter((id) => entry(id).subaddressSeparator !== undefined),
    ).toEqual([]);
  });
});

describe('sources', () => {
  it('cites every non-default rule of every provider', () => {
    const missing = providers.flatMap((p) => {
      const cited = new Set(
        (providerSources[p.id] ?? []).map(({ rule }) => rule),
      );
      return requiredRules(p)
        .filter((rule) => !cited.has(rule))
        .map((rule) => `${p.id} ${rule}`);
    });
    expect(missing).toEqual([]);
  });

  it('cites Google Workspace dots, which the issue asks to verify', () => {
    const rules = (providerSources['google-workspace'] ?? []).map(
      ({ rule }) => rule,
    );
    expect(rules).toContain('dotsSignificant');
  });

  it('only cites providers in the registry', () => {
    expect(Object.keys(providerSources).filter((id) => !byId.has(id))).toEqual(
      [],
    );
  });

  it('has an HTTPS page or a note, and a real verified date, on each source', () => {
    const today = new Date().toISOString().slice(0, 10);
    const bad = Object.entries(providerSources).flatMap(([id, sources]) =>
      sources
        .filter(
          ({ url, note, verified }) =>
            (url === undefined && note === undefined) ||
            (url !== undefined && !url.startsWith('https://')) ||
            !/^\d{4}-\d{2}-\d{2}$/.test(verified) ||
            Number.isNaN(Date.parse(verified)) ||
            verified > today,
        )
        .map(({ rule }) => `${id} ${rule}`),
    );
    expect(bad).toEqual([]);
  });
});
