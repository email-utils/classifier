/**
 * The parts of an address the classifier reads. validator-syntax's
 * `ParsedAddress` has both, so a parsed address passes straight through.
 */
export interface AddressParts {
  local: string;
  domain: string;
}

// Every lookup takes a raw string or an address someone has already parsed.
// Strings are split at the last `@`, since a domain can't contain one. This
// stands in for validator-syntax's `parseAddress` until the classifier can
// depend on its v1 release, so quoted local parts keep their quotes. A
// string with no `@`, or with nothing on one side of it, gives `undefined`,
// which every lookup treats as an address it knows nothing about.
//
// The two halves have their own functions so the lookups, which each need
// one, allocate nothing else.

function checked(email: string | AddressParts): AddressParts {
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
  return email;
}

/**
 * The address's domain, lowercased.
 *
 * @throws TypeError when `email` is neither a string nor an object with
 * string `local` and `domain`.
 * @internal
 */
export function domainOf(email: string | AddressParts): string | undefined {
  if (typeof email === 'string') {
    const at = email.lastIndexOf('@');
    if (at < 1 || at === email.length - 1) {
      return undefined;
    }
    return email.slice(at + 1).toLowerCase();
  }
  const { local, domain } = checked(email);
  return local === '' || domain === '' ? undefined : domain.toLowerCase();
}

/**
 * The address's local part, as written.
 *
 * @throws TypeError when `email` is neither a string nor an object with
 * string `local` and `domain`.
 * @internal
 */
export function localOf(email: string | AddressParts): string | undefined {
  if (typeof email === 'string') {
    const at = email.lastIndexOf('@');
    if (at < 1 || at === email.length - 1) {
      return undefined;
    }
    return email.slice(0, at);
  }
  const { local, domain } = checked(email);
  return local === '' || domain === '' ? undefined : local;
}
