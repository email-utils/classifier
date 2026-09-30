import {
  parseAddress,
  type ParsedAddress,
  type ReasonCode,
  type Result,
} from '@email-utils/validator-syntax';
import { describe, expectTypeOf, it } from 'vitest';
import * as root from '../src';
import {
  getProvider,
  isRoleAccount,
  suggestCorrection,
  type ProviderId,
  type ProviderInfo,
  type ProviderKind,
} from '../src';
import * as classifyEntry from '../src/classify';
import {
  classify,
  createClassifier,
  defaultIgnore,
  type Classification,
  type Classifier,
  type ClassifyOptions,
  type Keyboard,
} from '../src/classify';
import * as disposableEntry from '../src/disposable';
import { isDisposable } from '../src/disposable';
import * as providersEntry from '../src/providers';
import * as sourcesEntry from '../src/sources';
import type { ProviderRule, ProviderSource } from '../src/sources';

// The classifier has no `{ ok, … }` result of its own: its lookups answer
// directly, and the result that narrows on `ok` is validator-syntax's,
// whose `value` they take. Its closed unions are the provider kinds, the
// keyboards, `maxEdits`, and the registry rules a source cites; it has no
// reason codes.

type Email = string | ParsedAddress;

describe('results', () => {
  it('takes a parse result’s value only once it narrows on ok', () => {
    const result = parseAddress('"ada@home"@gmail.com', { preset: 'rfc5321' });
    expectTypeOf(result).toEqualTypeOf<Result<ParsedAddress>>();
    // @ts-expect-error: `value` is there only when `ok` is true
    expectTypeOf(getProvider).toBeCallableWith(result.value);
    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<ParsedAddress>();
      expectTypeOf(getProvider).toBeCallableWith(result.value);
      expectTypeOf(isRoleAccount).toBeCallableWith(result.value);
      expectTypeOf(suggestCorrection).toBeCallableWith(result.value);
      expectTypeOf(isDisposable).toBeCallableWith(result.value);
      expectTypeOf(classify).toBeCallableWith(result.value);
    } else {
      expectTypeOf(result.reason).toEqualTypeOf<ReasonCode>();
      expectTypeOf(result).not.toHaveProperty('value');
    }
  });

  it('gives a provider or undefined, which narrows', () => {
    const provider = getProvider('ada@gmail.com');
    expectTypeOf(provider).toEqualTypeOf<ProviderInfo | undefined>();
    if (provider !== undefined) {
      expectTypeOf(provider).toEqualTypeOf<ProviderInfo>();
      expectTypeOf(provider.id).toEqualTypeOf<ProviderId>();
      expectTypeOf(provider.kind).toEqualTypeOf<ProviderKind>();
      expectTypeOf(provider.domains).toEqualTypeOf<readonly string[]>();
      expectTypeOf(provider.canonicalDomain).toEqualTypeOf<
        string | undefined
      >();
      expectTypeOf(provider.subaddressSeparator).toEqualTypeOf<
        string | undefined
      >();
    }
  });

  it('gives a suggestion or undefined, which narrows', () => {
    const suggestion = suggestCorrection('ada@gmial.com');
    expectTypeOf(suggestion).toEqualTypeOf<string | undefined>();
    if (suggestion !== undefined) {
      expectTypeOf(suggestion).toEqualTypeOf<string>();
    }
  });

  it('gives a classification with all four fields', () => {
    expectTypeOf(classify('ada@example.com')).toEqualTypeOf<Classification>();
    expectTypeOf<Classification>().toEqualTypeOf<{
      provider: ProviderInfo | undefined;
      disposable: boolean;
      role: boolean;
      suggestion: string | undefined;
    }>();
  });

  it('takes a string or a parsed address, and nothing else', () => {
    expectTypeOf(getProvider).parameters.toEqualTypeOf<[Email]>();
    expectTypeOf(isRoleAccount).parameters.toEqualTypeOf<[Email]>();
    expectTypeOf(suggestCorrection).parameters.toEqualTypeOf<[Email]>();
    expectTypeOf(isDisposable).parameters.toEqualTypeOf<[Email]>();
    expectTypeOf(classify).parameters.toEqualTypeOf<
      [Email, (ClassifyOptions | undefined)?]
    >();
    // @ts-expect-error: not an address
    expectTypeOf(getProvider).toBeCallableWith(42);
    // @ts-expect-error: not an address
    expectTypeOf(isDisposable).toBeCallableWith(null);
    // @ts-expect-error: a parsed address needs `domain` and `comments`
    expectTypeOf(isRoleAccount).toBeCallableWith({ local: 'ada' });
  });

  it('binds each check with the standalone one’s type', () => {
    expectTypeOf(createClassifier()).toEqualTypeOf<Classifier>();
    expectTypeOf<Classifier['classify']>().toEqualTypeOf<
      (email: Email) => Classification
    >();
    expectTypeOf<Classifier['getProvider']>().toEqualTypeOf<
      typeof getProvider
    >();
    expectTypeOf<Classifier['isDisposable']>().toEqualTypeOf<
      typeof isDisposable
    >();
    expectTypeOf<Classifier['isRoleAccount']>().toEqualTypeOf<
      typeof isRoleAccount
    >();
    expectTypeOf<Classifier['suggestCorrection']>().toEqualTypeOf<
      typeof suggestCorrection
    >();
  });
});

describe('options', () => {
  it('accepts each option, and none', () => {
    const domains: readonly string[] = ['example-corp.com'];
    expectTypeOf(createClassifier).toBeCallableWith();
    expectTypeOf(createClassifier).toBeCallableWith(undefined);
    expectTypeOf(createClassifier).toBeCallableWith({});
    expectTypeOf(createClassifier).toBeCallableWith({
      domains,
      ignore: [...defaultIgnore, 'example.net'],
      keyboard: 'azerty',
      maxEdits: 2,
      maxKeyDistance: Infinity,
    });
    // Each option is declared `| undefined`, so an explicit undefined is
    // fine under exactOptionalPropertyTypes.
    expectTypeOf(classify).toBeCallableWith('ada@example.com', {
      domains: undefined,
      ignore: undefined,
      keyboard: undefined,
      maxEdits: undefined,
      maxKeyDistance: undefined,
    });
  });

  it('rejects what the runtime rejects', () => {
    // @ts-expect-error: options are an object
    expectTypeOf(createClassifier).toBeCallableWith(null);
    // @ts-expect-error: unknown option
    expectTypeOf(createClassifier).toBeCallableWith({ domain: ['a.com'] });
    // @ts-expect-error: domains is an array
    expectTypeOf(createClassifier).toBeCallableWith({ domains: 'a.com' });
    // @ts-expect-error: of strings
    expectTypeOf(createClassifier).toBeCallableWith({ ignore: [1] });
    // @ts-expect-error: unknown keyboard
    expectTypeOf(createClassifier).toBeCallableWith({ keyboard: 'dvorak' });
    // @ts-expect-error: maxEdits is 0, 1, or 2
    expectTypeOf(createClassifier).toBeCallableWith({ maxEdits: 3 });
    // @ts-expect-error: maxKeyDistance is a number
    expectTypeOf(createClassifier).toBeCallableWith({ maxKeyDistance: '1' });
  });

  it('types each option exactly', () => {
    expectTypeOf<ClassifyOptions>().toEqualTypeOf<{
      domains?: readonly string[] | undefined;
      ignore?: readonly string[] | undefined;
      keyboard?: Keyboard | undefined;
      maxEdits?: 0 | 1 | 2 | undefined;
      maxKeyDistance?: number | undefined;
    }>();
    expectTypeOf(defaultIgnore).toEqualTypeOf<readonly string[]>();
    expectTypeOf(createClassifier).parameters.toEqualTypeOf<
      [(ClassifyOptions | undefined)?]
    >();
  });
});

describe('unions', () => {
  it('Keyboard', () => {
    expectTypeOf<Keyboard>().toEqualTypeOf<'qwerty' | 'qwertz' | 'azerty'>();
  });

  it('ProviderKind', () => {
    expectTypeOf<ProviderKind>().toEqualTypeOf<
      'personal' | 'business' | 'registrar'
    >();
  });

  it('ProviderRule', () => {
    expectTypeOf<ProviderRule>().toEqualTypeOf<
      | 'domains'
      | 'canonicalDomain'
      | 'mxPatterns'
      | 'dotsSignificant'
      | 'hyphensSignificant'
      | 'subaddressSeparator'
      | 'subdomainAddressing'
    >();
  });

  it('maxEdits', () => {
    expectTypeOf<NonNullable<ClassifyOptions['maxEdits']>>().toEqualTypeOf<
      0 | 1 | 2
    >();
  });

  it('ProviderId is any string', () => {
    expectTypeOf<ProviderId>().toEqualTypeOf<string>();
  });
});

describe('entry points', () => {
  it('@email-utils/classifier', () => {
    expectTypeOf<keyof typeof root>().toEqualTypeOf<
      'getProvider' | 'isRoleAccount' | 'suggestCorrection' | 'packageName'
    >();
    expectTypeOf(root.getProvider).toEqualTypeOf<
      (email: Email) => ProviderInfo | undefined
    >();
    expectTypeOf(root.isRoleAccount).toEqualTypeOf<(email: Email) => boolean>();
    expectTypeOf(root.suggestCorrection).toEqualTypeOf<
      (email: Email) => string | undefined
    >();
    expectTypeOf<
      typeof root.packageName
    >().toEqualTypeOf<'@email-utils/classifier'>();
  });

  it('@email-utils/classifier/providers', () => {
    expectTypeOf<keyof typeof providersEntry>().toEqualTypeOf<
      'providers' | 'getProvider'
    >();
    expectTypeOf(providersEntry.providers).toEqualTypeOf<
      readonly ProviderInfo[]
    >();
    expectTypeOf(providersEntry.getProvider).toEqualTypeOf<
      typeof root.getProvider
    >();
  });

  it('@email-utils/classifier/sources', () => {
    expectTypeOf<
      keyof typeof sourcesEntry
    >().toEqualTypeOf<'providerSources'>();
    expectTypeOf(sourcesEntry.providerSources).toEqualTypeOf<
      Readonly<Record<ProviderId, readonly ProviderSource[]>>
    >();
    expectTypeOf<ProviderSource>().toEqualTypeOf<{
      rule: ProviderRule;
      url?: string;
      verified: string;
      note?: string;
    }>();
  });

  it('@email-utils/classifier/disposable', () => {
    expectTypeOf<
      keyof typeof disposableEntry
    >().toEqualTypeOf<'isDisposable'>();
    expectTypeOf(disposableEntry.isDisposable).toEqualTypeOf<
      (email: Email) => boolean
    >();
  });

  it('@email-utils/classifier/classify', () => {
    expectTypeOf<keyof typeof classifyEntry>().toEqualTypeOf<
      'classify' | 'createClassifier' | 'defaultIgnore'
    >();
    expectTypeOf(classifyEntry.classify).toEqualTypeOf<
      (email: Email, options?: ClassifyOptions) => Classification
    >();
    expectTypeOf(classifyEntry.createClassifier).toEqualTypeOf<
      (options?: ClassifyOptions) => Classifier
    >();
  });
});
