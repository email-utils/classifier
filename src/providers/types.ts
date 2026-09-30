/** Stable provider identifier, e.g. 'gmail', 'google-workspace', or 'microsoft365'. */
export type ProviderId = string;

/**
 * What a provider's domains are:
 *
 * - `personal`: a mailbox service anyone can sign up for, free or paid
 *   (Gmail, Outlook.com, Fastmail). An address on one isn't tied to an
 *   organization.
 * - `business`: hosting for an organization's own domain (Google Workspace,
 *   Microsoft 365). These entries have no `domains`; validator-dns finds them
 *   by MX.
 * - `registrar`: a registrar's default forwarding MX, which a domain gets
 *   before its owner sets up mail (Namecheap). Mail may be forwarded
 *   anywhere, or nowhere.
 */
export type ProviderKind = 'personal' | 'business' | 'registrar';

/** A mailbox provider in the registry: its domains, MX patterns, and local-part rules. */
export interface ProviderInfo {
  id: ProviderId;
  name: string;
  kind: ProviderKind;
  /**
   * Domains the provider serves mail for, e.g. gmail.com and googlemail.com.
   * Empty for hosted-domain providers such as Google Workspace, which only
   * validator-dns can recognize, by MX.
   */
  domains: readonly string[];
  /** When set, all of `domains` share mailboxes and keys use this one, e.g. gmail.com. */
  canonicalDomain?: string;
  /**
   * MX host patterns that validator-dns's `detectProviderByMx` matches:
   * lowercase host names without the trailing dot. A leading `*.` matches
   * one or more labels, so `*.olc.protection.outlook.com` matches
   * `hotmail-com.olc.protection.outlook.com` but not
   * `olc.protection.outlook.com` itself.
   */
  mxPatterns: readonly string[];
  /** Whether dots in the local part change the mailbox (false for Gmail). */
  dotsSignificant: boolean;
  /**
   * Whether a hyphen in the local part is its own character (false for
   * Yandex, where `my-address` and `my.address` are one mailbox).
   */
  hyphensSignificant: boolean;
  /** The single character that starts a subaddress tag, e.g. '+' or '-'; absent if none. */
  subaddressSeparator?: string;
  /**
   * Whether `tag@user.<domain>` delivers to `user@<domain>`, as on Fastmail.
   * It applies to the provider's own `domains`.
   */
  subdomainAddressing: boolean;
}
