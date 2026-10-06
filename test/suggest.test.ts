import {
  isValidSyntax,
  type ParsedAddress,
} from '@email-utils/validator-syntax';
import { describe, expect, it } from 'vitest';
import * as root from '../src';
import { blocklist } from '../src/disposable/data';
import { getProvider, providers } from '../src/providers';
import {
  defaultIgnore,
  suggestCorrection,
  targets,
  tldTypos,
} from '../src/suggest';

function parsed(local: string, domain: string): ParsedAddress {
  return { local, domain, comments: [] };
}

describe('suggestCorrection', () => {
  it('corrects a misspelled mailbox domain', () => {
    expect(suggestCorrection('ada@gmial.com')).toBe('ada@gmail.com');
    expect(suggestCorrection('ada@gnail.com')).toBe('ada@gmail.com');
    expect(suggestCorrection('ada@gmai.com')).toBe('ada@gmail.com');
    expect(suggestCorrection('ada@yahooo.com')).toBe('ada@yahoo.com');
    expect(suggestCorrection('ada@outlok.com')).toBe('ada@outlook.com');
    expect(suggestCorrection('ada@iclod.com')).toBe('ada@icloud.com');
  });

  it('counts two swapped letters as one edit', () => {
    expect(suggestCorrection('ada@gamil.com')).toBe('ada@gmail.com');
    expect(suggestCorrection('ada@hotmial.com')).toBe('ada@hotmail.com');
  });

  it('counts a letter typed on a neighboring key as one edit', () => {
    expect(suggestCorrection('ada@gmsil.com')).toBe('ada@gmail.com');
    expect(suggestCorrection('ada@hptmail.com')).toBe('ada@hotmail.com');
    expect(suggestCorrection('ada@yahpo.com')).toBe('ada@yahoo.com');
  });

  // L is five keys from F; lastmail.com is a disposable service, not a slip.
  it('counts a letter typed on a farther key as two', () => {
    expect(suggestCorrection('ada@lastmail.com')).toBeUndefined();
    expect(suggestCorrection('ada@cmail.com')).toBeUndefined();
    expect(suggestCorrection('ada@amail.com')).toBeUndefined();
  });

  it('allows one edit, never two', () => {
    expect(suggestCorrection('ada@hotmial.co')).toBeUndefined();
    expect(suggestCorrection('ada@hotmal.co')).toBeUndefined();
    expect(suggestCorrection('ada@gmal.co')).toBeUndefined();
  });

  it('corrects a TLD slip on any domain', () => {
    expect(suggestCorrection('ada@example.con')).toBe('ada@example.com');
    expect(suggestCorrection('ada@example.cmo')).toBe('ada@example.com');
    expect(suggestCorrection('ada@example.nte')).toBe('ada@example.net');
    expect(suggestCorrection('ada@example.ogr')).toBe('ada@example.org');
    expect(suggestCorrection('ada@a.b.example.con')).toBe(
      'ada@a.b.example.com',
    );
  });

  it('never fixes a TLD onto a domain in defaultIgnore', () => {
    expect(suggestCorrection('ada@mail.con')).toBeUndefined();
    expect(suggestCorrection('ada@email.cmo')).toBeUndefined();
  });

  it('corrects the TLD before measuring the name', () => {
    expect(suggestCorrection('ada@gmail.con')).toBe('ada@gmail.com');
    expect(suggestCorrection('ada@gmial.con')).toBe('ada@gmail.com');
    expect(suggestCorrection('ada@me.con')).toBe('ada@me.com');
    expect(suggestCorrection('ada@googlemail.con')).toBe('ada@googlemail.com');
  });

  it('corrects a real TLD only when the name is near a known domain', () => {
    expect(suggestCorrection('ada@gmail.cm')).toBe('ada@gmail.com');
    expect(suggestCorrection('ada@yahoo.co')).toBe('ada@yahoo.com');
    expect(suggestCorrection('ada@example.co')).toBeUndefined();
    expect(suggestCorrection('ada@example.cm')).toBeUndefined();
  });

  it('gives a tie to the more widely used domain', () => {
    // One edit from both hotmail.de and hotmail.fr.
    expect(suggestCorrection('ada@hotmail.dr')).toBe('ada@hotmail.fr');
  });

  it('leaves domains the registry knows alone', () => {
    for (const { domains } of providers) {
      for (const domain of domains) {
        expect(suggestCorrection(`ada@${domain}`)).toBeUndefined();
      }
    }
    expect(suggestCorrection('ada@news.fastmail.com')).toBeUndefined();
  });

  it('leaves common domains outside the registry alone', () => {
    expect(suggestCorrection('ada@mail.com')).toBeUndefined();
    expect(suggestCorrection('ada@email.com')).toBeUndefined();
  });

  it('leaves domains far from any known one alone', () => {
    expect(suggestCorrection('ada@example.com')).toBeUndefined();
    expect(suggestCorrection('ada@company.org')).toBeUndefined();
    expect(suggestCorrection('ada@gmail.co.uk')).toBeUndefined();
  });

  it('never guesses at names of three letters or fewer', () => {
    expect(suggestCorrection('ada@gmx.dr')).toBeUndefined();
    expect(suggestCorrection('ada@ne.com')).toBeUndefined();
    expect(suggestCorrection('ada@aol.cm')).toBeUndefined();
  });

  it('keeps the local part as written and lowercases the domain', () => {
    expect(suggestCorrection('Ada.Lovelace+x@GMIAL.COM')).toBe(
      'Ada.Lovelace+x@gmail.com',
    );
    expect(suggestCorrection('ada@Gmail.com')).toBeUndefined();
  });

  it('takes a parsed address', () => {
    expect(suggestCorrection(parsed('ada', 'gmial.com'))).toBe('ada@gmail.com');
    expect(suggestCorrection(parsed('ada', 'example.con'))).toBe(
      'ada@example.com',
    );
  });

  it('leaves domain literals and dotless or internationalized domains alone', () => {
    expect(suggestCorrection(parsed('ada', '[127.0.0.1]'))).toBeUndefined();
    expect(suggestCorrection(parsed('ada', 'con'))).toBeUndefined();
    expect(suggestCorrection(parsed('ada', 'gmial'))).toBeUndefined();
    expect(suggestCorrection(parsed('ada', 'gmäil.com'))).toBeUndefined();
  });

  it('ignores TLDs named like object properties', () => {
    expect(suggestCorrection('ada@example.constructor')).toBeUndefined();
    expect(suggestCorrection('ada@example.tostring')).toBeUndefined();
  });

  it('knows nothing of a string the parser rejects', () => {
    for (const email of ['', 'ada', 'ada@', '@gmial.com', '"a@b"@gmial.com']) {
      expect(suggestCorrection(email)).toBeUndefined();
    }
  });

  it('throws TypeError for anything but a string or a parsed address', () => {
    for (const bad of [undefined, null, 42, {}, { local: 'ada' }]) {
      // @ts-expect-error: checking the runtime guard
      expect(() => suggestCorrection(bad)).toThrow(TypeError);
    }
  });

  it('is exported from the root entry', () => {
    expect(root.suggestCorrection).toBe(suggestCorrection);
  });
});

describe('the suggestion data', () => {
  it('corrects only toward registry domains', () => {
    expect(
      targets.filter((domain) => getProvider(`a@${domain}`) === undefined),
    ).toEqual([]);
    expect(new Set(targets).size).toBe(targets.length);
  });

  it('never corrects toward a target from another', () => {
    for (const domain of targets) {
      expect(suggestCorrection(`ada@${domain}`)).toBeUndefined();
    }
  });

  it('lists common domains that are outside the registry', () => {
    expect(
      defaultIgnore.filter(
        (domain) => getProvider(`a@${domain}`) !== undefined,
      ),
    ).toEqual([]);
  });

  // A real TLD in the table would rewrite working addresses.
  it('fixes only TLDs outside the IANA set, to ones in it', () => {
    for (const [typo, tld] of Object.entries(tldTypos)) {
      expect(isValidSyntax(`ada@example.${typo}`)).toBe(false);
      expect(isValidSyntax(`ada@example.${tld}`)).toBe(true);
    }
  });

  // A disposable service's own domain is what its user meant, so one near a
  // target mustn't be "corrected" to it. Two edits turned yopmail.com into
  // ymail.com, and any substitution counting as one turned lastmail.com into
  // fastmail.com. These are the listed domains one edit from a target,
  // all typo-squats; a refresh that adds another fails here for a person to
  // judge.
  it('corrects only typo-like domains on the disposable list', () => {
    expect(
      blocklist
        .split('\n')
        .filter((domain) => suggestCorrection(`a@${domain}`) !== undefined),
    ).toEqual([
      '5ymail.com',
      'gmial.com',
      'gotmail.com',
      'hotmai.com',
      'hotmial.com',
      'tmail.com',
    ]);
    expect(suggestCorrection('ada@yopmail.com')).toBeUndefined();
    expect(suggestCorrection('ada@lastmail.com')).toBeUndefined();
  });
});
