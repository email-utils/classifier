import type { ParsedAddress } from '@email-utils/validator-syntax';
import { describe, expect, it } from 'vitest';
import * as root from '../src';
import { classify, createClassifier, defaultIgnore } from '../src/classify';
import { getProvider } from '../src/providers';

function parsed(local: string, domain: string): ParsedAddress {
  return { local, domain, comments: [] };
}

describe('classify', () => {
  it('combines the provider, disposable, role, and suggestion checks', () => {
    expect(classify('ceo@mailinator.com')).toEqual({
      provider: undefined,
      disposable: true,
      role: true,
      suggestion: undefined,
    });
    expect(classify('ada@googlemail.com')).toEqual({
      provider: getProvider('ada@gmail.com'),
      disposable: false,
      role: false,
      suggestion: undefined,
    });
    expect(classify('support@gnail.com')).toEqual({
      provider: undefined,
      disposable: false,
      role: true,
      suggestion: 'support@gmail.com',
    });
  });

  // Typo-squatted domains like gmial.com are on the blocklist, so an
  // address can be both.
  it('can find a domain both disposable and a typo', () => {
    expect(classify('ada@gmial.com')).toEqual({
      provider: undefined,
      disposable: true,
      role: false,
      suggestion: 'ada@gmail.com',
    });
  });

  it('always has all four keys', () => {
    expect(Object.keys(classify('ada@example.com'))).toEqual([
      'provider',
      'disposable',
      'role',
      'suggestion',
    ]);
  });

  it('takes a parsed address', () => {
    expect(classify(parsed('admin', 'gnail.com'))).toEqual({
      provider: undefined,
      disposable: false,
      role: true,
      suggestion: 'admin@gmail.com',
    });
  });

  // `practical` rejects `.con`, so the other checks know nothing of it, as
  // they do when called alone; only the suggestion reads it.
  it('still suggests for a TLD the practical preset rejects', () => {
    expect(classify('admin@gmail.con')).toEqual({
      provider: undefined,
      disposable: false,
      role: false,
      suggestion: 'admin@gmail.com',
    });
  });

  it('knows nothing of a string the parser rejects', () => {
    for (const email of ['', 'ada', 'ada@', '@mailinator.com']) {
      expect(classify(email)).toEqual({
        provider: undefined,
        disposable: false,
        role: false,
        suggestion: undefined,
      });
    }
  });

  it('applies options', () => {
    expect(
      classify('ada@example-crop.com', { domains: ['example-corp.com'] })
        .suggestion,
    ).toBe('ada@example-corp.com');
  });

  it('throws TypeError for anything but a string or a parsed address', () => {
    for (const bad of [undefined, null, 42, {}, { local: 'ada' }]) {
      // @ts-expect-error: checking the runtime guard
      expect(() => classify(bad)).toThrow(TypeError);
    }
  });

  it('is not exported from the root entry', () => {
    expect('classify' in root).toBe(false);
    expect('createClassifier' in root).toBe(false);
  });
});

describe('createClassifier', () => {
  it('binds the checks it makes', () => {
    const classifier = createClassifier();
    expect(classifier.isDisposable('ada@mailinator.com')).toBe(true);
    expect(classifier.isRoleAccount('postmaster@example.com')).toBe(true);
    expect(classifier.getProvider('ada@gmail.com')).toBe(
      getProvider('ada@gmail.com'),
    );
    expect(classifier.suggestCorrection('ada@gmial.com')).toBe('ada@gmail.com');
    expect(classifier.classify('ceo@mailinator.com').disposable).toBe(true);
  });

  it('corrects toward extra domains, ahead of the defaults', () => {
    const classifier = createClassifier({
      domains: ['Example-Corp.com', 'gmail.cn'],
    });
    expect(classifier.suggestCorrection('ada@example-crop.com')).toBe(
      'ada@example-corp.com',
    );
    expect(
      classifier.suggestCorrection('ada@EXAMPLE-CORP.COM'),
    ).toBeUndefined();
    // gmail.cn is one edit from gmail.cm (N beside M), as gmail.com is, and
    // comes first.
    expect(classifier.suggestCorrection('ada@gmail.cm')).toBe('ada@gmail.cn');
    expect(classifier.suggestCorrection('ada@gmial.com')).toBe('ada@gmail.com');
  });

  it('never corrects away from extra domains', () => {
    expect(suggestCorrectionOf('ada@gmail.co')).toBe('ada@gmail.com');
    const classifier = createClassifier({ domains: ['gmail.co'] });
    expect(classifier.suggestCorrection('ada@gmail.co')).toBeUndefined();
    expect(
      createClassifier({ domains: ['example.con'] }).suggestCorrection(
        'ada@example.con',
      ),
    ).toBeUndefined();
  });

  it('measures domains longer than a hostname can be', () => {
    const long = `${'a'.repeat(300)}.example`;
    expect(
      createClassifier({ domains: [long] }).suggestCorrection(
        parsed('ada', `${'a'.repeat(299)}s.example`),
      ),
    ).toBe(`ada@${long}`);
  });

  it('leaves each classifier its own domains', () => {
    createClassifier({ domains: ['example-corp.com'] });
    expect(
      createClassifier().suggestCorrection('ada@example-crop.com'),
    ).toBeUndefined();
  });

  it('takes dotless domains as known but never corrects toward them', () => {
    const classifier = createClassifier({ domains: ['intranet'] });
    expect(
      classifier.suggestCorrection(parsed('ada', 'intranet')),
    ).toBeUndefined();
    expect(
      classifier.suggestCorrection(parsed('ada', 'intranett')),
    ).toBeUndefined();
  });

  it('replaces the default ignore list with ignore', () => {
    expect(root.suggestCorrection('ada@mail.com')).toBeUndefined();
    const replaced = createClassifier({ ignore: ['Gnail.com'] });
    expect(replaced.suggestCorrection('ada@gnail.com')).toBeUndefined();
    expect(replaced.suggestCorrection('ada@mail.com')).toBe('ada@gmail.com');
    const extended = createClassifier({
      ignore: [...defaultIgnore, 'gnail.com'],
    });
    expect(extended.suggestCorrection('ada@gnail.com')).toBeUndefined();
    expect(extended.suggestCorrection('ada@mail.com')).toBeUndefined();
  });

  it('never corrects toward an ignored domain', () => {
    const classifier = createClassifier({ ignore: ['hotmail.fr'] });
    expect(classifier.suggestCorrection('ada@hotmail.dr')).toBe(
      'ada@hotmail.de',
    );
    expect(
      createClassifier({ ignore: ['gmail.com'] }).suggestCorrection(
        'ada@gmial.com',
      ),
    ).toBeUndefined();
  });

  it('measures key distance on the chosen keyboard', () => {
    // T is beside Y on QWERTY; on QWERTZ, Y is at the bottom left.
    expect(root.suggestCorrection('ada@tahoo.com')).toBe('ada@yahoo.com');
    expect(
      createClassifier({ keyboard: 'qwertz' }).suggestCorrection(
        'ada@tahoo.com',
      ),
    ).toBeUndefined();
    // M is beside L on AZERTY, two keys from it on QWERTY.
    expect(root.suggestCorrection('ada@glail.com')).toBeUndefined();
    expect(
      createClassifier({ keyboard: 'azerty' }).suggestCorrection(
        'ada@glail.com',
      ),
    ).toBe('ada@gmail.com');
  });

  it('allows as many edits as maxEdits', () => {
    expect(root.suggestCorrection('ada@hotmal.co')).toBeUndefined();
    const two = createClassifier({ maxEdits: 2 });
    expect(two.suggestCorrection('ada@hotmal.co')).toBe('ada@hotmail.com');
    const none = createClassifier({ maxEdits: 0 });
    expect(none.suggestCorrection('ada@gmial.com')).toBeUndefined();
    expect(none.suggestCorrection('ada@example.con')).toBe('ada@example.com');
  });

  it('counts substitutions up to maxKeyDistance keys apart as one edit', () => {
    // C is two keys from G, and L five from F.
    const two = createClassifier({ maxKeyDistance: 2 });
    expect(two.suggestCorrection('ada@cmail.com')).toBe('ada@gmail.com');
    expect(two.suggestCorrection('ada@lastmail.com')).toBeUndefined();
    const any = createClassifier({ maxKeyDistance: Infinity });
    expect(any.suggestCorrection('ada@lastmail.com')).toBe('ada@fastmail.com');
    // Characters off the layout, like a hyphen or a non-ASCII letter in a
    // `domains` option, substitute only under Infinity.
    expect(
      createClassifier({ domains: ['exämple.com'] }).suggestCorrection(
        'ada@example.com',
      ),
    ).toBeUndefined();
    expect(
      createClassifier({
        domains: ['exämple.com'],
        maxKeyDistance: Infinity,
      }).suggestCorrection('ada@example.com'),
    ).toBe('ada@exämple.com');
    expect(
      createClassifier({ domains: ['exa-mple.com'] }).suggestCorrection(
        'ada@exa.mple.com',
      ),
    ).toBeUndefined();
    expect(
      createClassifier({
        domains: ['exa-mple.com'],
        maxKeyDistance: Infinity,
      }).suggestCorrection('ada@exa.mple.com'),
    ).toBe('ada@exa-mple.com');
  });

  it('accepts empty options', () => {
    expect(createClassifier({}).suggestCorrection('ada@gmial.com')).toBe(
      'ada@gmail.com',
    );
    expect(
      createClassifier({ domains: undefined }).classify('ada@example.com')
        .suggestion,
    ).toBeUndefined();
  });

  it('throws TypeError for malformed options', () => {
    // @ts-expect-error: checking the runtime guard
    expect(() => createClassifier(null)).toThrow(
      'Expected the options to be an object',
    );
    // @ts-expect-error: checking the runtime guard
    expect(() => createClassifier('gmail.com')).toThrow(TypeError);
    // @ts-expect-error: checking the runtime guard
    expect(() => createClassifier({ domain: ['a.com'] })).toThrow(
      'Unknown option: domain',
    );
    for (const domains of ['a.com', [1], [null], {}]) {
      // @ts-expect-error: checking the runtime guard
      expect(() => createClassifier({ domains })).toThrow(
        'Expected domains to be an array of strings',
      );
    }
    // @ts-expect-error: checking the runtime guard
    expect(() => createClassifier({ ignore: 'a.com' })).toThrow(
      'Expected ignore to be an array of strings',
    );
    // @ts-expect-error: checking the runtime guard
    expect(() => createClassifier({ keyboard: 'dvorak' })).toThrow(
      'Unknown keyboard: dvorak',
    );
    // @ts-expect-error: checking the runtime guard
    expect(() => createClassifier({ keyboard: 'toString' })).toThrow(TypeError);
    for (const maxEdits of [-1, 3, 1.5, '1']) {
      // @ts-expect-error: checking the runtime guard
      expect(() => createClassifier({ maxEdits })).toThrow(
        'Expected maxEdits to be 0, 1, or 2',
      );
    }
    for (const maxKeyDistance of [0, -1, 1.5, NaN, '1', -Infinity]) {
      expect(() =>
        // @ts-expect-error: checking the runtime guard
        createClassifier({ maxKeyDistance }),
      ).toThrow('Expected maxKeyDistance to be a positive integer or Infinity');
    }
    // @ts-expect-error: checking the runtime guard
    expect(() => classify('ada@gmail.com', { domains: 'a.com' })).toThrow(
      TypeError,
    );
  });
});

function suggestCorrectionOf(email: string): string | undefined {
  return root.suggestCorrection(email);
}
