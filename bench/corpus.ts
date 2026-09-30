import {
  parseAddress,
  type ParsedAddress,
} from '@email-utils/validator-syntax';
import { syntaxFixtures } from '@email-utils/validator-syntax/fixtures';

// validator-syntax's shared syntax corpus, from its `/fixtures` entry: 287
// addresses, valid and not, most on example domains. `corpusStrings` is
// every one of them, which a lookup parses first; `corpusParsed` is the 57
// that `practical` accepts, parsed, as a caller that already validated would
// pass them. A pass over either is one bench iteration.
export const corpusStrings: readonly string[] = syntaxFixtures.map(
  ({ address }) => address,
);

export const corpusParsed: readonly ParsedAddress[] = syntaxFixtures.flatMap(
  ({ address }) => {
    const result = parseAddress(address, { preset: 'practical' });
    return result.ok ? [result.value] : [];
  },
);

/** A single-input case: `local@domain`, already parsed. */
export function parsed(local: string, domain: string): ParsedAddress {
  return { local, domain, comments: [] };
}
