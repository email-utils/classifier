/**
 * Where each fact in the provider registry comes from, published as
 * `@email-utils/classifier/sources` so the docs' support matrix can cite
 * them without every caller of `/providers` shipping the URLs.
 *
 * @remarks
 * Every provider cites its `mxPatterns`, its `domains` when it has any, and
 * each rule that differs from the default: a `canonicalDomain`, dots or
 * hyphens that don't count, a subaddress separator, or subdomain
 * addressing. A default rule is cited only where the provider documents it,
 * such as dots mattering on Google Workspace. Facts the provider publishes
 * nowhere, like the MX hosts of its own domains, cite the DNS lookup that
 * showed them.
 *
 * @packageDocumentation
 */
import type { ProviderId, ProviderInfo } from '../providers/types';

/** The registry field a source backs. */
export type ProviderRule = keyof Omit<ProviderInfo, 'id' | 'name' | 'kind'>;

/** Where one registry fact about a provider comes from, and when it was checked. */
export interface ProviderSource {
  rule: ProviderRule;
  /** The provider's own page for the fact; absent when it was read from DNS. */
  url?: string;
  /** When the fact was last checked against the source, as `YYYY-MM-DD`. */
  verified: string;
  /** What the source says, or how the fact was observed when there's no page. */
  note?: string;
}

const VERIFIED = '2026-09-29';

/**
 * Sources for every provider in the registry, by provider ID.
 *
 * @example
 * ```ts
 * import { providerSources } from '@email-utils/classifier/sources';
 *
 * providerSources.gmail?.find(
 *   (source) => source.rule === 'subaddressSeparator',
 * );
 * // => { url: 'https://support.google.com/mail/answer/12096' }
 * ```
 */
export const providerSources: Readonly<
  Record<ProviderId, readonly ProviderSource[]>
> = {
  gmail: [
    {
      rule: 'domains',
      url: 'https://support.google.com/mail/answer/10313',
      verified: VERIFIED,
      note: 'Messages sent to @gmail.com and @googlemail.com are the same.',
    },
    {
      rule: 'canonicalDomain',
      url: 'https://support.google.com/mail/answer/10313',
      verified: VERIFIED,
    },
    {
      rule: 'dotsSignificant',
      url: 'https://support.google.com/mail/answer/7436150',
      verified: VERIFIED,
      note: 'Dots in a Gmail address are ignored.',
    },
    {
      rule: 'subaddressSeparator',
      url: 'https://support.google.com/mail/answer/12096',
      verified: VERIFIED,
      note: 'Mail to janedoe+school@gmail.com goes to janedoe@gmail.com.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of gmail.com and googlemail.com: gmail-smtp-in.l.google.com and alt1–alt4.',
    },
  ],
  'google-workspace': [
    {
      rule: 'mxPatterns',
      url: 'https://knowledge.workspace.google.com/admin/domains/set-up-mx-records-for-google-workspace',
      verified: VERIFIED,
      note: 'smtp.google.com, with the pre-2023 aspmx values still supported. The legacy host names are from the MX of domains that still use them.',
    },
    {
      rule: 'dotsSignificant',
      url: 'https://support.google.com/mail/answer/7436150',
      verified: VERIFIED,
      note: 'On work, school, and other organization accounts, dots do change the address.',
    },
    {
      rule: 'subaddressSeparator',
      url: 'https://support.google.com/mail/answer/12096',
      verified: VERIFIED,
      note: "Gmail's plus aliases, which the page doesn't limit to personal accounts.",
    },
  ],
  outlook: [
    {
      rule: 'domains',
      url: 'https://support.microsoft.com/en-us/office/add-or-remove-an-email-alias-in-outlook-com-459b1989-356d-40fa-a689-8f285b13f1f2',
      verified: VERIFIED,
      note: 'Names Hotmail, Live, Outlook.com, and MSN addresses. The country domains are from their MX, which is Outlook.com’s.',
    },
    {
      rule: 'subaddressSeparator',
      url: 'https://support.microsoft.com/en-us/office/add-or-remove-an-email-alias-in-outlook-com-459b1989-356d-40fa-a689-8f285b13f1f2',
      verified: VERIFIED,
      note: 'chester.beane+microsoft@outlook.com arrives in the same inbox.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain: <domain>-com, eur, nam, or apc under olc.protection.outlook.com.',
    },
  ],
  microsoft365: [
    {
      rule: 'mxPatterns',
      url: 'https://learn.microsoft.com/en-us/microsoft-365/enterprise/external-domain-name-system-records',
      verified: VERIFIED,
      note: '<domain-key>.mail.protection.outlook.com.',
    },
    {
      rule: 'mxPatterns',
      url: 'https://learn.microsoft.com/en-us/exchange/security-and-compliance/how-dane-secures-email',
      verified: VERIFIED,
      note: 'Domains with DNSSEC point at <domain-key>.<subdomain>.mx.microsoft, e.g. contosotest-com.o-v1.mx.microsoft, and drop legacy MX ending in mail.protection.outlook.com, mail.eo.outlook.com, or mail.protection.outlook.de.',
    },
    {
      rule: 'subaddressSeparator',
      url: 'https://learn.microsoft.com/en-us/exchange/recipients-in-exchange-online/plus-addressing-in-exchange-online',
      verified: VERIFIED,
      note: 'On by default; an organization can turn it off.',
    },
  ],
  yahoo: [
    {
      rule: 'domains',
      url: 'https://help.yahoo.com/kb/domain-extensions-yahoo-mail-sln2153.html',
      verified: VERIFIED,
      note: 'Names yahoo.com, myyahoo.com, yahoo.co.uk, and yahoo.fr. ymail.com, rocketmail.com, and the other country domains are from their MX.',
    },
    {
      rule: 'subaddressSeparator',
      url: 'https://help.yahoo.com/kb/SLN28815.html',
      verified: VERIFIED,
      note: 'None. Disposable addresses are nickname-keyword@yahoo.com, where the nickname is not the mailbox name.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain.',
    },
  ],
  aol: [
    {
      rule: 'domains',
      verified: VERIFIED,
      note: 'Every listed domain has MX mx-aol.mail.gm0.yahoodns.net.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain.',
    },
  ],
  icloud: [
    {
      rule: 'domains',
      url: 'https://support.apple.com/en-us/118230',
      verified: VERIFIED,
      note: 'Every @me.com and @mac.com account also has the @icloud.com address.',
    },
    {
      rule: 'canonicalDomain',
      url: 'https://support.apple.com/en-us/118230',
      verified: VERIFIED,
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain: mx01 and mx02.mail.icloud.com.',
    },
  ],
  proton: [
    {
      rule: 'domains',
      url: 'https://proton.me/support/addresses-and-aliases',
      verified: VERIFIED,
      note: 'proton.me or protonmail.com is chosen at sign-up; they are separate addresses. protonmail.ch and pm.me are from their MX.',
    },
    {
      rule: 'subaddressSeparator',
      url: 'https://proton.me/support/addresses-and-aliases',
      verified: VERIFIED,
      note: 'Plus aliases: ericnorbert+bills@proton.me.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain.',
    },
  ],
  fastmail: [
    {
      rule: 'domains',
      url: 'https://www.fastmail.help/hc/en-us/articles/6239365719055-What-domains-can-I-use-with-Fastmail',
      verified: VERIFIED,
    },
    {
      rule: 'subaddressSeparator',
      url: 'https://www.fastmail.help/hc/en-us/articles/360060591053-Plus-addressing-and-subdomain-addressing',
      verified: VERIFIED,
    },
    {
      rule: 'subdomainAddressing',
      url: 'https://www.fastmail.help/hc/en-us/articles/360060591053-Plus-addressing-and-subdomain-addressing',
      verified: VERIFIED,
      note: 'Works without setup on Fastmail domains; custom domains must turn it on.',
    },
    {
      rule: 'mxPatterns',
      url: 'https://www.fastmail.help/hc/en-us/articles/360060591153-Manual-DNS-configuration',
      verified: VERIFIED,
    },
  ],
  zoho: [
    {
      rule: 'domains',
      verified: VERIFIED,
      note: 'Both domains have MX smtpin, smtpin2, and smtpin3.zoho.com.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain.',
    },
  ],
  'zoho-business': [
    {
      rule: 'mxPatterns',
      url: 'https://www.zoho.com/mail/help/adminconsole/configure-email-delivery.html',
      verified: VERIFIED,
      note: 'mx, mx2, and mx3.zoho.com, with the TLD varying by data center. The other data centers’ hosts are the ones that resolve in DNS; mx3.zoho.com.cn does not.',
    },
  ],
  yandex: [
    {
      rule: 'domains',
      url: 'https://yandex.com/support/yandex-360/customers/mail/en/web/preferences/about-sender/additional-addresses',
      verified: VERIFIED,
      note: 'Every mailbox also gets the ru, by, and kz country domains and ya.ru.',
    },
    {
      rule: 'canonicalDomain',
      url: 'https://yandex.com/support/yandex-360/customers/mail/en/web/preferences/about-sender/additional-addresses',
      verified: VERIFIED,
    },
    {
      rule: 'hyphensSignificant',
      url: 'https://yandex.com/support/yandex-360/customers/mail/en/web/security/strange-letters.html',
      verified: VERIFIED,
      note: 'Yandex Mail doesn’t distinguish between dots and hyphens; they are synonymous addresses of the same mailbox.',
    },
    {
      rule: 'subaddressSeparator',
      url: 'https://yandex.com/support/yandex-360/customers/mail/en/reg',
      verified: VERIFIED,
      note: 'alice.the.girl+teaforum@yandex.com reaches the mailbox.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain.',
    },
  ],
  'yandex-360': [
    {
      rule: 'mxPatterns',
      url: 'https://yandex.com/support/yandex-360/business/admin/en/domains/dns/mx',
      verified: VERIFIED,
      note: 'mx.yandex.net.',
    },
  ],
  gmx: [
    {
      rule: 'domains',
      verified: VERIFIED,
      note: 'Every listed domain has MX under emig.gmx.net (Germany, Austria, Switzerland) or gmx.net (gmx.com).',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain.',
    },
  ],
  'web-de': [
    {
      rule: 'domains',
      verified: VERIFIED,
      note: 'web.de has its own MX, separate from GMX.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of web.de.',
    },
  ],
  'mail-ru': [
    {
      rule: 'domains',
      verified: VERIFIED,
      note: 'Every listed domain has MX mxs.mail.ru.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain.',
    },
  ],
  tuta: [
    {
      rule: 'domains',
      verified: VERIFIED,
      note: 'The domains Tuta offers at sign-up, all with MX mail.tutanota.de.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of every listed domain.',
    },
  ],
  hey: [
    {
      rule: 'domains',
      verified: VERIFIED,
      note: 'hey.com is the only domain HEY offers personal addresses on.',
    },
    {
      rule: 'mxPatterns',
      verified: VERIFIED,
      note: 'MX of hey.com.',
    },
  ],
  namecheap: [
    {
      rule: 'mxPatterns',
      url: 'https://www.namecheap.com/support/knowledgebase/article.aspx/308/2214/how-to-set-up-free-email-forwarding/',
      verified: VERIFIED,
      note: 'Email Forwarding sets the MX records itself; the page doesn’t name the eforward1–5.registrar-servers.com hosts, which resolve in DNS.',
    },
  ],
};
