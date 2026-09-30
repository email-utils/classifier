/**
 * `@email-utils/classifier`: facts and heuristics about an email address.
 *
 * The provider registry itself is `@email-utils/classifier/providers`.
 * `isDisposable` is `@email-utils/classifier/disposable`, and `classify` and
 * `createClassifier`, which use it, are `@email-utils/classifier/classify`,
 * so this entry never loads the disposable-domain list.
 *
 * @packageDocumentation
 */

export { getProvider } from './providers/lookup';
export type { ProviderId, ProviderInfo, ProviderKind } from './providers/types';
export { isRoleAccount } from './role';
export { suggestCorrection } from './suggest';

/** The package name, for diagnostics. */
export const packageName = '@email-utils/classifier';
