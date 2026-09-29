/**
 * The provider registry, published as `@email-utils/classifier/providers`:
 * one entry per mailbox provider, with its domains, MX patterns, and
 * local-part rules, and `getProvider` to look an address up in it. The
 * sanitizer's provider rules and validator-dns's `detectProviderByMx` read
 * it, and `@email-utils/classifier/sources` cites where each fact comes
 * from.
 *
 * @packageDocumentation
 */
export { providers } from './data';
export { getProvider } from './lookup';
export type { ProviderId, ProviderInfo, ProviderKind } from './types';
