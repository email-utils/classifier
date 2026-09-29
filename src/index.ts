/**
 * `@email-utils/classifier`: facts and heuristics about an email address.
 *
 * The v1 API (provider detection, disposable and role checks, typo
 * suggestions) lands with the implementation issues; see
 * https://github.com/email-utils/classifier/issues. The provider registry
 * itself is `@email-utils/classifier/providers`.
 *
 * @packageDocumentation
 */

export type { ProviderId, ProviderInfo, ProviderKind } from './providers/types';

/** The package name, for diagnostics. */
export const packageName = '@email-utils/classifier';
