/**
 * `@email-utils/classifier`: facts and heuristics about an email address.
 *
 * Typo suggestions and `classify` land with the remaining implementation
 * issues; see https://github.com/email-utils/classifier/issues. The provider
 * registry itself is `@email-utils/classifier/providers`, and `isDisposable`
 * is `@email-utils/classifier/disposable`, so this entry never loads the
 * disposable-domain list.
 *
 * @packageDocumentation
 */

export { getProvider } from './providers/lookup';
export type { ProviderId, ProviderInfo, ProviderKind } from './providers/types';
export { isRoleAccount } from './role';

/** The package name, for diagnostics. */
export const packageName = '@email-utils/classifier';
