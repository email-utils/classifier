import {
  parseAddress,
  type ParsedAddress,
  type SyntaxOptions,
} from '@email-utils/validator-syntax';

// Every lookup takes a raw string or an address someone has already parsed.
// Strings go through validator-syntax's `parseAddress` with the `practical`
// preset, so the classifier splits an address exactly as the parser does. A
// string it rejects gives `undefined`, which every lookup treats as an
// address it knows nothing about (C2); that keeps quoted local parts, which
// `practical` doesn't allow, away from the role check.

const practical: SyntaxOptions = { preset: 'practical' };

/**
 * The address's local part and domain, as written, or `undefined` for a
 * string the parser rejects or a parsed address with an empty half.
 *
 * @throws TypeError when `email` is neither a string nor an object with
 * string `local` and `domain`.
 * @internal
 */
export function partsOf(
  email: string | ParsedAddress,
): ParsedAddress | undefined {
  if (typeof email === 'string') {
    const result = parseAddress(email, practical);
    return result.ok ? result.value : undefined;
  }
  if (
    typeof email !== 'object' ||
    email === null ||
    typeof email.local !== 'string' ||
    typeof email.domain !== 'string'
  ) {
    throw new TypeError(
      `Expected a string or a parsed address, got ${email === null ? 'null' : typeof email}`,
    );
  }
  return email.local === '' || email.domain === '' ? undefined : email;
}
