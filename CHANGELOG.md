## [3.2.5](https://github.com/soliantconsulting/fm-odata-client/compare/v3.2.4...v3.2.5) (2026-02-13)


### Bug Fixes

* **connection:** strip all illegal control characters from JSON ([70808a5](https://github.com/soliantconsulting/fm-odata-client/commit/70808a57f3b1f3670824f02a3e51fda2c9aa9c97))

## [3.2.4](https://github.com/soliantconsulting/fm-odata-client/compare/v3.2.3...v3.2.4) (2026-02-12)


### Bug Fixes

* **lax-parsing:** remove null characters from JSON response before parsing ([c3c3ab4](https://github.com/soliantconsulting/fm-odata-client/commit/c3c3ab4cc8c3bb9dc01f02a0282cb73e018e16b2))

## [3.2.3](https://github.com/soliantconsulting/fm-odata-client/compare/v3.2.2...v3.2.3) (2026-02-12)


### Bug Fixes

* **connection:** roll back custom fetch due to type and intance collisions ([1b8c2c2](https://github.com/soliantconsulting/fm-odata-client/commit/1b8c2c2c8a6a065c764763d17630b1629ccbfb9c))

## [3.2.2](https://github.com/soliantconsulting/fm-odata-client/compare/v3.2.1...v3.2.2) (2026-02-12)


### Bug Fixes

* **connection:** generalize ConnectionFetch type to avoid type conflicts ([5ffe646](https://github.com/soliantconsulting/fm-odata-client/commit/5ffe646c7860ea3c800323ae5e75dbec065769f8))

## [3.2.1](https://github.com/soliantconsulting/fm-odata-client/compare/v3.2.0...v3.2.1) (2026-02-12)


### Bug Fixes

* **connection:** instead of accepting a dispatcher, accept a custom fetch ([c3b1506](https://github.com/soliantconsulting/fm-odata-client/commit/c3b1506680e56663bd21b94986533676bb5d0347))

# [3.2.0](https://github.com/soliantconsulting/fm-odata-client/compare/v3.1.0...v3.2.0) (2026-02-11)


### Features

* allow setting dispatcher for all fetch requests ([eb8af0a](https://github.com/soliantconsulting/fm-odata-client/commit/eb8af0a8c0bf63e62017e0cd439aa5356a3a81d5))

# [3.1.0](https://github.com/soliantconsulting/fm-odata-client/compare/v3.0.2...v3.1.0) (2026-01-27)


### Features

* split fetchField into fetchFieldValue and fetchFieldBlob ([fee074e](https://github.com/soliantconsulting/fm-odata-client/commit/fee074e71df19c5ded49a411949812dfec3f7c37))

## [3.0.2](https://github.com/soliantconsulting/fm-odata-client/compare/v3.0.1...v3.0.2) (2025-10-23)


### Bug Fixes

* add provenance attestation ([d1a840c](https://github.com/soliantconsulting/fm-odata-client/commit/d1a840c826edae7aa74891879b48bf8832343882))

## [3.0.1](https://github.com/soliantconsulting/fm-odata-client/compare/v3.0.0...v3.0.1) (2024-11-01)


### Bug Fixes

* **connection:** let fetch automatically infer the content-length header ([a7ce592](https://github.com/soliantconsulting/fm-odata-client/commit/a7ce59202fa0c7095f8c752673524d48bb25fad5))

# [3.0.0](https://github.com/soliantconsulting/fm-odata-client/compare/v2.1.0...v3.0.0) (2024-11-01)


### Features

* update minimum supported node version to 20 ([24cb93e](https://github.com/soliantconsulting/fm-odata-client/commit/24cb93e35ae85cc92d39766ef036c80528e2acb9))


### BREAKING CHANGES

* we are now relying on the native fetch implementation

# [2.1.0](https://github.com/soliantconsulting/fm-odata-client/compare/v2.0.0...v2.1.0) (2023-04-04)


### Features

* allow disabling SSL for connections ([fd396cb](https://github.com/soliantconsulting/fm-odata-client/commit/fd396cbeb6515ea3a8897b4d2d321bf59dae5c9a))

# [2.0.0](https://github.com/soliantconsulting/fm-odata-client/compare/v1.1.0...v2.0.0) (2023-04-04)


### Features

* add ESM support and split claris-id export ([dc4a5ae](https://github.com/soliantconsulting/fm-odata-client/commit/dc4a5aeaebbc09e55cccadfd2f5f9bfa42963000))
* generate ESM format in addition to CJS ([f020a48](https://github.com/soliantconsulting/fm-odata-client/commit/f020a48561ffd4312fc3ba782cf9d3a3db3385ce))


### BREAKING CHANGES

* claris-id is not split into s a separate export to avoid
packaging issues with external tools. The NodeJS version was also raised to 18+
in order to prepare for native fetch support once typings become available.

# [1.1.0](https://github.com/soliantconsulting/fm-odata-client/compare/v1.0.5...v1.1.0) (2022-07-11)


### Features

* **Connection:** add lax parsing option to handle non encoded newlines in JSON responses ([bd14088](https://github.com/soliantconsulting/fm-odata-client/commit/bd14088ddf2ae3259938f2e411be2a18277d19a4))

## [1.0.5](https://github.com/soliantconsulting/fm-odata-client/compare/v1.0.4...v1.0.5) (2022-06-24)


### Bug Fixes

* **Table:** remove debugging console.log ([3abd765](https://github.com/soliantconsulting/fm-odata-client/commit/3abd765d53d1b59d3ad292e6d3df457050b7e358))
* **Table:** use arrays to denote composite primary keys instead of objects ([072696d](https://github.com/soliantconsulting/fm-odata-client/commit/072696d34bdedd420e22967e34efb2dbe0a64467))

## [1.0.4](https://github.com/soliantconsulting/fm-odata-client/compare/v1.0.3...v1.0.4) (2022-06-20)


### Bug Fixes

* **Table:** allow null values being returned by create and update commands ([c8cda68](https://github.com/soliantconsulting/fm-odata-client/commit/c8cda68cbac883f0fd75422e7563bdc1cdcde9eb))

## [1.0.3](https://github.com/soliantconsulting/fm-odata-client/compare/v1.0.2...v1.0.3) (2022-06-20)


### Bug Fixes

* **Table:** allow null values in cross join result ([52e949b](https://github.com/soliantconsulting/fm-odata-client/commit/52e949b5dc55aeec189918204420280bc3232817))

## [1.0.2](https://github.com/soliantconsulting/fm-odata-client/compare/v1.0.1...v1.0.2) (2022-06-20)


### Bug Fixes

* **Table:** allow null as field value ([40829e0](https://github.com/soliantconsulting/fm-odata-client/commit/40829e0f44f8bfd3300c73d0629afc0bc182ca7a))
* **Table:** handle null values in compileRowData() ([5f696e6](https://github.com/soliantconsulting/fm-odata-client/commit/5f696e6254c12215be9fed7bdbbf163c352d1bcd))

## [1.0.1](https://github.com/soliantconsulting/fm-odata-client/compare/v1.0.0...v1.0.1) (2022-06-16)


### Bug Fixes

* **Table:** explicitly return void on CUD methods when in batched context ([0695ce9](https://github.com/soliantconsulting/fm-odata-client/commit/0695ce9acf326313b8ae12717f531e231c6d9222))

# 1.0.0 (2022-06-16)


### Features

* lazily load amazon-cognito-identity-js to make it truely optional ([f3847b6](https://github.com/soliantconsulting/fm-odata-client/commit/f3847b6c909d57369609ed49127dd1155281dfcd))
