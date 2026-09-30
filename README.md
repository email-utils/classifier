# @email-utils/classifier

Classify email addresses: mailbox provider, disposable domains, role accounts, and typo suggestions.

Part of [email-utils](https://github.com/email-utils/meta). Synchronous, platform-neutral, and does no I/O.

v1 is in release candidates on the `next` tag, and the API may still change before 1.0.

```sh
npm install @email-utils/classifier@next
```

## Quick start

```ts
import {
  getProvider,
  isRoleAccount,
  suggestCorrection,
} from '@email-utils/classifier';
import { isDisposable } from '@email-utils/classifier/disposable';
import { classify } from '@email-utils/classifier/classify';

getProvider('ada@googlemail.com'); // { id: 'gmail', name: 'Gmail', … }
isRoleAccount('postmaster@example.com'); // true
suggestCorrection('ada@gmial.com'); // 'ada@gmail.com'
isDisposable('ada@mailinator.com'); // true

classify('ceo@mailinator.com');
// { provider: undefined, disposable: true, role: true, suggestion: undefined }
```

Every function takes a string or a `ParsedAddress` from
[`@email-utils/validator-syntax`](https://github.com/email-utils/validator-syntax).

## Entries

| Import                               | What it has                                                             |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `@email-utils/classifier`            | `getProvider`, `isRoleAccount`, `suggestCorrection`                     |
| `@email-utils/classifier/classify`   | `classify` and `createClassifier`, which run every check at once        |
| `@email-utils/classifier/disposable` | `isDisposable`, with the vendored disposable-domain list                |
| `@email-utils/classifier/providers`  | The provider registry and `getProvider`                                 |
| `@email-utils/classifier/sources`    | Where each registry fact comes from, with the date it was last verified |

The root entry never loads the disposable-domain list, which is about 50 KB
compressed. Import `/disposable` or `/classify` only where you need it.

## Documentation

The API reference and behavior details are on the
[documentation site](https://email-utils.github.io/meta/).

## License

MIT. The disposable-domain list is from
[disposable-email-domains](https://github.com/disposable-email-domains/disposable-email-domains)
(CC0 1.0); see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).
