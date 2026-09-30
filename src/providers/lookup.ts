import type { ParsedAddress } from '@email-utils/validator-syntax';
import { partsOf } from '../address';
import { providers } from './data';
import type { ProviderInfo } from './types';

// Built on first use, so a bundle that never calls `getProvider` can drop
// the registry. It gives each domain to one provider; test/providers.test.ts
// holds it to that.
let byDomain: ReadonlyMap<string, ProviderInfo> | undefined;

function domainIndex(): ReadonlyMap<string, ProviderInfo> {
  byDomain ??= new Map(
    providers.flatMap((provider) =>
      provider.domains.map((domain) => [domain, provider] as const),
    ),
  );
  return byDomain;
}

/**
 * The provider whose domains the address is on, e.g. Gmail for
 * `ada@googlemail.com`. With `subdomainAddressing`, one-label subdomains of
 * the provider's domains match too: `news@ada.fastmail.com` is Fastmail.
 *
 * A custom domain hosted on a provider, such as a company's domain on Google
 * Workspace, can't be told from the domain alone, so it returns `undefined`;
 * validator-dns's `detectProviderByMx` finds those by MX.
 *
 * @example
 * ```ts
 * import { getProvider } from '@email-utils/classifier';
 *
 * getProvider('ada@googlemail.com');
 * // => { id: 'gmail', canonicalDomain: 'gmail.com', subaddressSeparator: '+' }
 * getProvider('news@ada.fastmail.com')?.id; // => 'fastmail'
 * getProvider('ada@example.com'); // => undefined
 * ```
 *
 * @throws TypeError when `email` is neither a string nor a parsed address.
 */
export function getProvider(
  email: string | ParsedAddress,
): ProviderInfo | undefined {
  const parts = partsOf(email);
  if (parts === undefined) {
    return undefined;
  }
  const domain = parts.domain.toLowerCase();
  const index = domainIndex();
  const provider = index.get(domain);
  if (provider !== undefined) {
    return provider;
  }
  const dot = domain.indexOf('.');
  if (dot < 1) {
    return undefined;
  }
  const parent = index.get(domain.slice(dot + 1));
  return parent?.subdomainAddressing === true ? parent : undefined;
}
