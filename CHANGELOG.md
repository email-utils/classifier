# Changelog

## [1.0.0-rc.5](https://github.com/email-utils/classifier/compare/v1.0.0-rc.4...v1.0.0-rc.5) (2026-10-06)


### Bug Fixes

* **data:** update the disposable-domain list to 1aac72a ([#40](https://github.com/email-utils/classifier/issues/40)) ([cb1c4c0](https://github.com/email-utils/classifier/commit/cb1c4c0d2f47a7ba2f22d82bc8035249d8fadd5f))
* **deps:** bump @email-utils/validator-syntax from 1.0.0-rc.1 to 1.0.0-rc.3 in the email-utils group ([#38](https://github.com/email-utils/classifier/issues/38)) ([0d475ca](https://github.com/email-utils/classifier/commit/0d475ca49817d359c09caf05336393f97fe1e531))
* **deps:** bump @email-utils/validator-syntax to 1.0.0-rc.4 ([#51](https://github.com/email-utils/classifier/issues/51)) ([d170379](https://github.com/email-utils/classifier/commit/d170379132b0094e4217f87aeedbc48cc4d52511))
* **typo:** never fix a TLD onto an ignored domain ([#48](https://github.com/email-utils/classifier/issues/48)) ([bec063b](https://github.com/email-utils/classifier/commit/bec063bd8e0be46c4cecb9c9b380a371eadc4e64))

## [1.0.0-rc.4](https://github.com/email-utils/classifier/compare/v1.0.0-rc.3...v1.0.0-rc.4) (2026-09-30)


### Performance Improvements

* bound lookups and add benchmarks and size budgets ([#36](https://github.com/email-utils/classifier/issues/36)) ([ae3baff](https://github.com/email-utils/classifier/commit/ae3baffc976565ac1e9df5954de9b1e8cf19907c))

## [1.0.0-rc.3](https://github.com/email-utils/classifier/compare/v1.0.0-rc.2...v1.0.0-rc.3) (2026-09-30)


### Features

* add suggestCorrection and the /classify entry ([#32](https://github.com/email-utils/classifier/issues/32)) ([8ff3795](https://github.com/email-utils/classifier/commit/8ff37956000bd9dcf9e0c3443ae92e6efc80be5f))
* **disposable:** add isDisposable and the /disposable entry ([#30](https://github.com/email-utils/classifier/issues/30)) ([04d901c](https://github.com/email-utils/classifier/commit/04d901c777282eb93e9f1d8483b6c2c10251c769))

## [1.0.0-rc.2](https://github.com/email-utils/classifier/compare/v1.0.0-rc.1...v1.0.0-rc.2) (2026-09-29)


### ⚠ BREAKING CHANGES

* parse string input with validator-syntax's parseAddress ([#28](https://github.com/email-utils/classifier/issues/28))

### Features

* parse string input with validator-syntax's parseAddress ([#28](https://github.com/email-utils/classifier/issues/28)) ([4a87cf0](https://github.com/email-utils/classifier/commit/4a87cf02928794ddf5ec626264bc994276fee979))

## [1.0.0-rc.1](https://github.com/email-utils/classifier/compare/v1.0.0-rc.0...v1.0.0-rc.1) (2026-09-29)


### Features

* add getProvider and isRoleAccount ([#25](https://github.com/email-utils/classifier/issues/25)) ([4662b77](https://github.com/email-utils/classifier/commit/4662b771eb65c2c6808cc2b660e6b95da6d0b639))
* **providers:** add the provider registry with sources and verified dates ([#23](https://github.com/email-utils/classifier/issues/23)) ([a4940c3](https://github.com/email-utils/classifier/commit/a4940c322a3432fe07040437b5095e5a14d065be))
