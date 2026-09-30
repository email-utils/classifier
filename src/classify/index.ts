/**
 * `@email-utils/classifier/classify`: every check on an address at once,
 * with `classify` and the `createClassifier` factory. It loads the
 * disposable-domain list, like `@email-utils/classifier/disposable`, which
 * is why the root entry doesn't export it.
 *
 * @packageDocumentation
 */
import type { ParsedAddress } from '@email-utils/validator-syntax';
import { partsOf } from '../address';
import { isDisposable } from '../disposable';
import { getProvider } from '../providers/lookup';
import type { ProviderInfo } from '../providers/types';
import { isRoleAccount } from '../role';
import { isKeyboard, type Keyboard } from '../keyboard';
import { createSuggester, type SuggestSettings } from '../suggest';

export type { Keyboard } from '../keyboard';
export { defaultIgnore } from '../suggest';

/** How `suggestCorrection` matches a domain against the ones it knows. */
export interface ClassifyOptions {
  /**
   * Domains that `suggestCorrection` corrects toward, ahead of the common
   * mailbox domains, and never away from, such as your own company's.
   * Compared without case.
   */
  domains?: readonly string[] | undefined;
  /**
   * Domains that are never corrected and never corrected toward, compared
   * without case. Replaces {@link defaultIgnore}, the real domains one edit
   * from a common one; spread it in to keep them. Registry domains are
   * never corrected either way.
   *
   * @defaultValue {@link defaultIgnore}
   */
  ignore?: readonly string[] | undefined;
  /**
   * The layout that key distance is measured on.
   *
   * @defaultValue `'qwerty'`
   */
  keyboard?: Keyboard | undefined;
  /**
   * The most edits a domain may be from a known one and still be taken for
   * it: 0 turns name corrections off, leaving only TLD fixes. 2 catches
   * double slips like `hotmal.co`, and also turns some distinct domains,
   * like `yopmail.com`, into common ones.
   *
   * @defaultValue `1`
   */
  maxEdits?: 0 | 1 | 2 | undefined;
  /**
   * How many keys apart a typed letter may be from the intended one and
   * still count as one edit: 1 for neighboring keys only. A letter farther
   * away counts as two, a deletion and an insertion. `Infinity` counts any
   * substitution as one edit.
   *
   * @defaultValue `1`
   */
  maxKeyDistance?: number | undefined;
}

/** What the classifier knows about an address. */
export interface Classification {
  /** The mailbox provider, from {@link getProvider}. */
  provider: ProviderInfo | undefined;
  /** From {@link isDisposable}. */
  disposable: boolean;
  /** From {@link isRoleAccount}. */
  role: boolean;
  /** A likely intended address when the domain looks like a typo, from `suggestCorrection`. */
  suggestion: string | undefined;
}

/** {@link classify} and each check it makes, with options bound. */
export interface Classifier {
  classify(email: string | ParsedAddress): Classification;
  isDisposable(email: string | ParsedAddress): boolean;
  isRoleAccount(email: string | ParsedAddress): boolean;
  suggestCorrection(email: string | ParsedAddress): string | undefined;
  getProvider(email: string | ParsedAddress): ProviderInfo | undefined;
}

let defaultClassifier: Classifier | undefined;

/**
 * The address's provider, whether it's disposable or a role account, and a
 * suggested correction if its domain looks like a typo. A string is parsed
 * once for all four.
 *
 * @example
 * ```ts
 * import { classify } from '@email-utils/classifier/classify';
 *
 * classify('ceo@mailinator.com');
 * // => { provider: undefined, disposable: true, role: true, suggestion: undefined }
 * classify('ada@gmial.com').suggestion; // => 'ada@gmail.com'
 * classify('ada@gmail.com', { maxKeyDistance: 0 }); // => throws TypeError
 * ```
 *
 * @throws TypeError when `email` is neither a string nor a parsed address,
 * or `options` are malformed.
 */
export function classify(
  email: string | ParsedAddress,
  options?: ClassifyOptions,
): Classification {
  if (options === undefined) {
    defaultClassifier ??= createClassifier();
    return defaultClassifier.classify(email);
  }
  return createClassifier(options).classify(email);
}

/**
 * Binds `options` once, checking them up front, and returns
 * {@link classify} and the checks it makes with them applied.
 *
 * @example
 * ```ts
 * import { createClassifier } from '@email-utils/classifier/classify';
 *
 * const classifier = createClassifier({ domains: ['example-corp.com'] });
 * classifier.suggestCorrection('ada@example-crop.com');
 * // => 'ada@example-corp.com'
 * classifier.classify('ada@example-corp.com');
 * // => { provider: undefined, suggestion: undefined }
 * ```
 *
 * @throws TypeError when `options` are malformed.
 */
export function createClassifier(options?: ClassifyOptions): Classifier {
  const suggestCorrection = createSuggester(settingsOf(options));
  return {
    classify(email) {
      const parts = partsOf(email);
      if (parts === undefined) {
        // `practical` rejected it, perhaps for a mistyped TLD, which the
        // suggestion's lenient parse still reads.
        return {
          provider: undefined,
          disposable: false,
          role: false,
          suggestion: suggestCorrection(email),
        };
      }
      return {
        provider: getProvider(parts),
        disposable: isDisposable(parts),
        role: isRoleAccount(parts),
        suggestion: suggestCorrection(parts),
      };
    },
    isDisposable,
    isRoleAccount,
    suggestCorrection,
    getProvider,
  };
}

const optionNames: ReadonlySet<string> = new Set([
  'domains',
  'ignore',
  'keyboard',
  'maxEdits',
  'maxKeyDistance',
]);

function settingsOf(
  options: ClassifyOptions | undefined,
): Partial<SuggestSettings> {
  if (options === undefined) {
    return {};
  }
  if (typeof options !== 'object' || options === null) {
    throw new TypeError('Expected the options to be an object');
  }
  for (const key of Object.keys(options)) {
    if (!optionNames.has(key)) {
      throw new TypeError(`Unknown option: ${key}`);
    }
  }
  const { domains, ignore, keyboard, maxEdits, maxKeyDistance } = options;
  const settings: Partial<SuggestSettings> = {};
  if (domains !== undefined) {
    settings.domains = domainList('domains', domains);
  }
  if (ignore !== undefined) {
    settings.ignore = domainList('ignore', ignore);
  }
  if (keyboard !== undefined) {
    if (!isKeyboard(keyboard)) {
      throw new TypeError(`Unknown keyboard: ${String(keyboard)}`);
    }
    settings.keyboard = keyboard;
  }
  if (maxEdits !== undefined) {
    if (maxEdits !== 0 && maxEdits !== 1 && maxEdits !== 2) {
      throw new TypeError('Expected maxEdits to be 0, 1, or 2');
    }
    settings.maxEdits = maxEdits;
  }
  if (maxKeyDistance !== undefined) {
    if (
      typeof maxKeyDistance !== 'number' ||
      !(Number.isInteger(maxKeyDistance) || maxKeyDistance === Infinity) ||
      maxKeyDistance < 1
    ) {
      throw new TypeError(
        'Expected maxKeyDistance to be a positive integer or Infinity',
      );
    }
    settings.maxKeyDistance = maxKeyDistance;
  }
  return settings;
}

function domainList(name: string, domains: unknown): string[] {
  if (
    !Array.isArray(domains) ||
    !domains.every((domain) => typeof domain === 'string')
  ) {
    throw new TypeError(`Expected ${name} to be an array of strings`);
  }
  return domains.map((domain) => domain.toLowerCase());
}
