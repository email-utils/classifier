import type { ParsedAddress } from '@email-utils/validator-syntax';
import { partsOf } from './address';

// Local parts that name a function rather than a person. Lowercase, with
// each common spelling listed, since a lookup is cheaper than folding
// separators on every call.
const roleLocalParts: ReadonlySet<string> = new Set([
  // RFC 2142's mailbox names, and RFC 5321's postmaster.
  'abuse',
  'ftp',
  'hostmaster',
  'info',
  'marketing',
  'news',
  'noc',
  'postmaster',
  'sales',
  'security',
  'support',
  'usenet',
  'uucp',
  'webmaster',
  'www',
  // Senders that take no replies.
  'donotreply',
  'do-not-reply',
  'do_not_reply',
  'mailer-daemon',
  'noreply',
  'no-reply',
  'no_reply',
  // Running the system.
  'admin',
  'administrator',
  'it',
  'root',
  'sysadmin',
  // Teams and desks.
  'accounting',
  'accounts',
  'billing',
  'careers',
  'compliance',
  'contact',
  'customerservice',
  'enquiries',
  'feedback',
  'finance',
  'hello',
  'help',
  'helpdesk',
  'hr',
  'inquiries',
  'jobs',
  'legal',
  'media',
  'office',
  'orders',
  'press',
  'privacy',
  'service',
  'team',
  // Lists and notifications.
  'alerts',
  'all',
  'everyone',
  'newsletter',
  'notifications',
  'staff',
  // Offices rather than their holders.
  'ceo',
  'cfo',
  'coo',
  'cto',
]);

/**
 * Whether the address belongs to a function rather than a person:
 * `postmaster@`, `noreply@`, `support@`, and the like. The local part is
 * compared without case and without a `+` tag, so `Admin+alerts@` counts.
 *
 * @example
 * ```ts
 * import { isRoleAccount } from '@email-utils/classifier';
 *
 * isRoleAccount('no-reply@example.com'); // => true
 * isRoleAccount('Admin+alerts@example.com'); // => true
 * isRoleAccount('ada@example.com'); // => false
 * ```
 *
 * @throws TypeError when `email` is neither a string nor a parsed address.
 */
export function isRoleAccount(email: string | ParsedAddress): boolean {
  const parts = partsOf(email);
  if (parts === undefined) {
    return false;
  }
  const { local } = parts;
  const plus = local.indexOf('+');
  return roleLocalParts.has(
    (plus === -1 ? local : local.slice(0, plus)).toLowerCase(),
  );
}
