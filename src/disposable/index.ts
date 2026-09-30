/**
 * `@email-utils/classifier/disposable`: whether an address is on a
 * throwaway-mailbox domain. The root entry doesn't re-export it, so
 * importing `@email-utils/classifier` never loads the list.
 *
 * @remarks
 * The domains are the
 * {@link https://github.com/disposable-email-domains/disposable-email-domains | disposable-email-domains}
 * blocklist (CC0 1.0), vendored at build time and refreshed weekly.
 *
 * @packageDocumentation
 */
import type { ParsedAddress } from '@email-utils/validator-syntax';
import { partsOf } from '../address';
import { blocklist, maxDots } from './data';

// Built on first use, so loading the entry costs one string literal.
let domains: ReadonlySet<string> | undefined;

// Listed domains are ASCII, with IDNs as A-labels.
const nonAscii = /\P{ASCII}/u;

/**
 * Whether the address's domain, or a parent of it, is a known disposable
 * domain: `a@mailinator.com` and `a@x.mailinator.com` both are. The domain is
 * compared without case, and an internationalized domain by its A-label.
 *
 * @example
 * ```ts
 * import { isDisposable } from '@email-utils/classifier/disposable';
 *
 * isDisposable('ada@mailinator.com'); // => true
 * isDisposable('ada@x.mailinator.com'); // => true
 * isDisposable('ada@gmail.com'); // => false
 * ```
 *
 * @throws TypeError when `email` is neither a string nor a parsed address.
 */
export function isDisposable(email: string | ParsedAddress): boolean {
  const parts = partsOf(email);
  if (parts === undefined) {
    return false;
  }
  const domain = asciiDomain(parts.domain);
  if (domain === undefined) {
    return false;
  }
  domains ??= new Set(blocklist.split('\n'));
  // The list holds registrable domains, so `x.y.example` matches a listed
  // `y.example`. The walk starts at the longest suffix a listed domain could
  // be, so a domain of many labels costs no more lookups than a short one,
  // and stops at two labels: no TLD is listed.
  let start = domain.length;
  for (let dots = 0; dots <= maxDots && start !== -1; dots++) {
    start = domain.lastIndexOf('.', start - 1);
  }
  let suffix = domain.slice(start + 1);
  let dot = suffix.indexOf('.');
  while (dot !== -1) {
    if (domains.has(suffix)) {
      return true;
    }
    suffix = suffix.slice(dot + 1);
    dot = suffix.indexOf('.');
  }
  return false;
}

// Lowercase, with U-labels turned into A-labels; `undefined` for a domain
// literal or a name that isn't a valid hostname.
function asciiDomain(domain: string): string | undefined {
  if (domain.startsWith('[')) {
    return undefined;
  }
  if (!nonAscii.test(domain)) {
    return domain.toLowerCase();
  }
  try {
    return new URL(`http://${domain}`).hostname;
  } catch {
    return undefined;
  }
}
