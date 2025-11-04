# Changelog

## [6.2.0](https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v6.1.0...v6.2.0) (2025-11-04)


### Features

* add user agent to requests ([#206](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/206)) ([ef2b97a](https://github.com/Flagsmith/flagsmith-nodejs-client/commit/ef2b97a3022a5feeb96c3ccdb8009ae89b582d0b))

### Bug Fixes

* handle environment documentation pagination ([#205](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/205)) ([a83d3a5](https://github.com/Flagsmith/flagsmith-nodejs-client/commit/a83d3a5789abbc47abc2a95d07a19756ab7befbb))


### CI

* add release please configuration ([#190](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/190)) ([946f911](https://github.com/Flagsmith/flagsmith-nodejs-client/commit/946f911e3c9d7df21bd7e5c6df5f9f92927e5e59))


### Docs

* removing hero image from SDK readme ([#194](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/194)) ([bc71d40](https://github.com/Flagsmith/flagsmith-nodejs-client/commit/bc71d40bdfa319b5333c18f4f9eacbe90b6fad0d))


### Other

* add root CODEOWNERS ([#200](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/200)) ([e81cc00](https://github.com/Flagsmith/flagsmith-nodejs-client/commit/e81cc00f1de35e0884b2cfc70c6cf54a75a3426c))
* versioned test data ([#197](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/197)) ([9fb5c12](https://github.com/Flagsmith/flagsmith-nodejs-client/commit/9fb5c127a2b56503ba876da2466c24e5ceff1d3f))

<a id="v6.1.0"></a>

## [v6.1.0](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v6.1.0) - 2025-06-18

## What's Changed

-   Bump undici from 6.21.1 to 6.21.2 by [@dependabot](https://github.com/dependabot) in [#184](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/184)
-   feat: Export FeatureModel to enable custom offline handler by [@phiggins](https://github.com/phiggins) in [#187](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/187)
-   Update test running instructions in README and other housekeeping by [@phiggins](https://github.com/phiggins) in [#186](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/186)
-   Bump vite from 5.4.18 to 5.4.19 by [@dependabot](https://github.com/dependabot) in [#185](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/185)
-   feat: Export BaseFlag, FlagsmithConfig, FlagsmithValue, TraitConfig types by [@rolodato](https://github.com/rolodato) in [#188](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/188)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v6.0.1...v6.1.0

[Changes][v6.1.0]

<a id="v6.0.1"></a>

## [v6.0.1](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v6.0.1) - 2025-04-24

## What's Changed

-   Remove uses of `any` in models.ts by [@phiggins](https://github.com/phiggins) in [#180](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/180)
-   Bump esbuild from 0.14.54 to 0.25.0 by [@dependabot](https://github.com/dependabot) in [#175](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/175)
-   Bump vite from 5.4.14 to 5.4.18 by [@dependabot](https://github.com/dependabot) in [#182](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/182)

## New Contributors

-   [@phiggins](https://github.com/phiggins) made their first contribution in [#180](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/180)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v6.0.0...v6.0.1

[Changes][v6.0.1]

<a id="v6.0.0"></a>

## [v6.0.0](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v6.0.0) - 2025-03-24

## What's Changed

### BREAKING CHANGES

-   `Flagsmith.environment` was removed. Use `getEnvironment` instead. This returns a Promise, and not a reference to the environment which could be uninitialised.
-   `onEnvironmentChange` handlers can now be invoked with an `undefined` environment if an error occurred.
-   The `Flagsmith` client now returns an error if initialised with local evaluation enabled but without a server-side SDK key. Previously, it would log an error and continue.

### New features

-   Added a new `requestRetryDelayMilliseconds` which controls how long the SDK will wait before retrying any failed HTTP requests. Previously, this was hard-coded to always be 1 second.
-   Added a `getEnvironment` method which returns the SDK's current local environment state as a Promise.

### Bug fixes

-   `getIdentityFlags` now uses any provided default flag handler if it fails, instead of just returning an error.
-   Setting `environmentRefreshInterval` to `0` now prevents any environment polling from happening.
-   Fixed a bug where if the SDK initially failed to fetch the environment document, then `getIdentityFlags` would always fail with an error even if the environment was later fetched successfully (https://github.com/Flagsmith/flagsmith-nodejs-client/issues/177).

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v5.1.1...v6.0.0

[Changes][v6.0.0]

<a id="v5.1.1"></a>

## [v5.1.1](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v5.1.1) - 2025-02-10

## What's Changed

-   Bump undici from 6.19.8 to 6.21.1 by [@dependabot](https://github.com/dependabot) in [#170](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/170)
-   Bump vite from 5.4.8 to 5.4.14 by [@dependabot](https://github.com/dependabot) in [#171](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/171)
-   Bump vitest and @vitest/coverage-v8 by [@dependabot](https://github.com/dependabot) in [#173](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/173)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v5.1.0...v5.1.1

[Changes][v5.1.1]

<a id="v5.1.0"></a>

## [v5.1.0](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v5.1.0) - 2025-01-20

## What's Changed

-   feat: Allow configuring analytics API endpoint separate from flags API by [@rolodato](https://github.com/rolodato) in [#168](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/168)
-   ci: Run tests on currently maintained Node LTS versions by [@rolodato](https://github.com/rolodato) in [#169](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/169)

## Deprecated

The [`baseApiUrl` constructor argument of `AnalyticsProcessor`](https://www.tsdocs.dev/docs/flagsmith-nodejs/5.0.1/classes/AnalyticsProcessor.html#constructor) is now deprecated. Instead, pass the full URL to the analytics endpoint using the `analyticsUrl` parameter. This deprecation only affects you if you are manually managing analytics, rather than having the SDK do it for you using the `enableAnalytics` option.

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v5.0.1...v5.1.0

[Changes][v5.1.0]

<a id="v5.0.1"></a>

## [v5.0.1](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v5.0.1) - 2025-01-14

## What's Changed

-   fix: Return 0 as number flag value instead of undefined by [@rolodato](https://github.com/rolodato) in [#167](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/167)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v5.0.0...v5.0.1

[Changes][v5.0.1]

<a id="v5.0.0"></a>

## [v5.0.0](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v5.0.0) - 2024-11-28

## What's Changed

-   fix: Export offline handler types by [@rolodato](https://github.com/rolodato) in [#166](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/166)
-   feat!: Simplify FlagsmithCache interface by [@rolodato](https://github.com/rolodato) in [#165](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/165)

## BREAKING CHANGES

The `FlagsmithCache` interface has been simplified. In practice, this will not affect most users:

-   Removed `has` method
-   Removed `ttl` parameter from `set`
-   Changed `set` return type to `Promise<void>`
-   Changed `get` return type to `Promise<Flags | undefined>`

`FlagsmithCache` since 5.0.0: https://www.tsdocs.dev/docs/flagsmith-nodejs/5.0.0/interfaces/FlagsmithCache.html
`FlagsmithCache` prior to 5.0.0: https://www.tsdocs.dev/docs/flagsmith-nodejs/4.0.0/interfaces/FlagsmithCache.html

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v4.0.0...v5.0.0

[Changes][v5.0.0]

<a id="v4.0.0"></a>

## [v4.0.0](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v4.0.0) - 2024-11-07

## What's Changed

-   feat: Support transient identities and traits by [@novakzaballa](https://github.com/novakzaballa) in [#158](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/158)
-   feat!: Custom fetch support, remove node-fetch, ESM+CJS dual build, migrate to vitest, TS fixes, test improvements by [@rolodato](https://github.com/rolodato) in [#162](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/162)
-   feat!: Remove all uses of CJS, add named Flagsmith export by [@rolodato](https://github.com/rolodato) in [#163](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/163)

### BREAKING CHANGES

Node.js 18 or later is now required.

`Flagsmith` is now a named export and not a default export. This only changes how you import the Flagsmith Node.js SDK and not how you use it.

In 3.x and earlier, `Flagsmith` is the default export:

```js
// ES modules
import Flagsmith from 'flagsmith-nodejs';
```

```js
// CommonJS
const Flagsmith = require('flagsmith-nodejs');
```

In 4.x, you must use the named export:

```js
// ES modules
import { Flagsmith } from 'flagsmith-nodejs';
```

```js
// CommonJS
const { Flagsmith } = require('flagsmith-nodejs');
```

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.3.3...v4.0.0

[Changes][v4.0.0]

<a id="v3.3.3"></a>

## [v3.3.3](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.3.3) - 2024-07-12

## What's Changed

-   Cancel timeout when it is no longer needed by [@wheineman-sunrun](https://github.com/wheineman-sunrun) in [#141](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/141)

## New Contributors

-   [@wheineman-sunrun](https://github.com/wheineman-sunrun) made their first contribution in [#141](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/141)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.3.2...v3.3.3

[Changes][v3.3.3]

<a id="v3.3.2"></a>

## [v3.3.2](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.3.2) - 2024-05-23

## What's Changed

-   fix: handle null traits for regex evaluations by [@matthewelwell](https://github.com/matthewelwell) in [#152](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/152)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.3.1...v3.3.2

[Changes][v3.3.2]

<a id="v3.3.1"></a>

## [v3.3.1](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.3.1) - 2024-05-08

## What's Changed

-   fix: only flush analytics once if requested concurrently by [@rolodato](https://github.com/rolodato) in [#148](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/148)
-   fix: error evaluating CONTAINS / NOT_CONTAINS for null traits by [@matthewelwell](https://github.com/matthewelwell) in [#150](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/150)
-   Bump version 3.3.1 by [@matthewelwell](https://github.com/matthewelwell) in [#151](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/151)

## New Contributors

-   [@rolodato](https://github.com/rolodato) made their first contribution in [#148](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/148)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.3.0...v3.3.1

[Changes][v3.3.1]

<a id="v3.3.0"></a>

## [Version 3.3.0 (v3.3.0)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.3.0) - 2024-04-19

## What's Changed

-   feat: Identity overrides in local evaluation mode by [@khvn26](https://github.com/khvn26) in [#143](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/143)
-   Bump @babel/traverse from 7.17.3 to 7.23.2 by [@dependabot](https://github.com/dependabot) in [#137](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/137)
-   chore: export FlagsmithConfig from index by [@novakzaballa](https://github.com/novakzaballa) in [#139](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/139)
-   chore: remove examples by [@dabeeeenster](https://github.com/dabeeeenster) in [#145](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/145)

## New Contributors

-   [@khvn26](https://github.com/khvn26) made their first contribution in [#143](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/143)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.2.0...v3.3.0

[Changes][v3.3.0]

<a id="v3.2.0"></a>

## [Version 3.2.0 (v3.2.0)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.2.0) - 2023-10-25

## What's Changed

-   feat: offline-mode by [@novakzaballa](https://github.com/novakzaballa) in [#136](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/136)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.1.1...v3.2.0

[Changes][v3.2.0]

<a id="v3.1.1"></a>

## [Version 3.1.1 (v3.1.1)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.1.1) - 2023-08-21

## What's Changed

-   fix: Default requestTimeout by [@novakzaballa](https://github.com/novakzaballa) in [#133](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/133)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.1.0...v3.1.1

[Changes][v3.1.1]

<a id="v3.1.0"></a>

## [Version 3.1.0 (v3.1.0)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.1.0) - 2023-08-07

## What's Changed

-   Add 10 secs by default to requestTimeoutSeconds by [@novakzaballa](https://github.com/novakzaballa) in [#128](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/128)
-   Bump version to 3.1.0 by [@novakzaballa](https://github.com/novakzaballa) in [#129](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/129)
-   Bump word-wrap from 1.2.3 to 1.2.4 by [@dependabot](https://github.com/dependabot) in [#127](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/127)
-   Bump tough-cookie from 4.0.0 to 4.1.3 by [@dependabot](https://github.com/dependabot) in [#125](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/125)
-   Lazily calculate the hash by [@eldar-gamisoniya](https://github.com/eldar-gamisoniya) in [#130](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/130)

## New Contributors

-   [@novakzaballa](https://github.com/novakzaballa) made their first contribution in [#128](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/128)
-   [@eldar-gamisoniya](https://github.com/eldar-gamisoniya) made their first contribution in [#130](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/130)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.0.1...v3.1.0

[Changes][v3.1.0]

<a id="v3.0.1"></a>

## [Version 3.0.1 (v3.0.1)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.0.1) - 2023-06-27

## What's Changed

-   Fix deploy action by [@kyle-ssg](https://github.com/kyle-ssg) in [#121](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/121)
-   Bump semver from 7.3.7 to 7.5.2 by [@dependabot](https://github.com/dependabot) in [#122](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/122)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.0.0...v3.0.1

[Changes][v3.0.1]

<a id="v3.0.0"></a>

## [Version 3.0.0 (v3.0.0)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v3.0.0) - 2023-06-15

## What's Changed

-   **BREAKING CHANGE**: Ensure percentage split evaluations are consistent by [@matthewelwell](https://github.com/matthewelwell) in [#119](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/119)

WARNING: We modified the local evaluation behaviour. You may see different flags returned to identities attributed to your percentage split-based segments after upgrading to this version.

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.5.2...v3.0.0

[Changes][v3.0.0]

<a id="v2.5.2"></a>

## [Version 2.5.2 (v2.5.2)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v2.5.2) - 2023-03-07

## What's Changed

-   Fix timeout not using default flags by [@matthewelwell](https://github.com/matthewelwell) in [#112](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/112)
-   Release 2.5.2 by [@matthewelwell](https://github.com/matthewelwell) in [#111](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/111)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.5.1...v2.5.2

[Changes][v2.5.2]

<a id="v2.5.1"></a>

## [Version 2.5.1 (v2.5.1)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v2.5.1) - 2023-01-06

## What's Changed

-   Ensure local evaluation returns consistent MV values by [@matthewelwell](https://github.com/matthewelwell) in [#103](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/103)
-   Add logic to check for empty identifiers in `getIdentity___` methods by [@matthewelwell](https://github.com/matthewelwell) in [#104](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/104)
-   Bump json5 from 2.2.0 to 2.2.3 by [@dependabot](https://github.com/dependabot) in [#101](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/101)
-   Release 2.5.1 by [@matthewelwell](https://github.com/matthewelwell) in [#102](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/102)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.5.0...v2.5.1

[Changes][v2.5.1]

<a id="v2.5.0"></a>

## [Version 2.5.0 (v2.5.0)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v2.5.0) - 2023-01-05

## What's Changed

-   Bump json5 from 2.1.0 to 2.2.3 in /examples/caching by [@dependabot](https://github.com/dependabot) in [#100](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/100)
-   Bump json5 from 2.1.0 to 2.2.3 in /examples/local-evaluation by [@dependabot](https://github.com/dependabot) in [#99](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/99)
-   Bump json5 from 2.1.0 to 2.2.3 in /examples/custom-fetch-agent by [@dependabot](https://github.com/dependabot) in [#98](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/98)
-   Bump json5 from 2.1.0 to 2.2.3 in /examples/api-proxy by [@dependabot](https://github.com/dependabot) in [#97](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/97)
-   Bump json5 from 2.1.0 to 2.2.3 in /examples/basic by [@dependabot](https://github.com/dependabot) in [#96](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/96)
-   Bump minimatch from 3.0.4 to 3.1.2 in /examples/basic by [@dependabot](https://github.com/dependabot) in [#91](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/91)
-   Bump decode-uri-component from 0.2.0 to 0.2.2 in /examples/basic by [@dependabot](https://github.com/dependabot) in [#90](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/90)
-   Bump decode-uri-component from 0.2.0 to 0.2.2 in /examples/api-proxy by [@dependabot](https://github.com/dependabot) in [#89](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/89)
-   Bump minimatch from 3.0.4 to 3.1.2 in /examples/api-proxy by [@dependabot](https://github.com/dependabot) in [#88](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/88)
-   Swallow errors arising from fetch in analytics by [@matthewelwell](https://github.com/matthewelwell) in [#95](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/95)
-   Release/2.5.0 by [@matthewelwell](https://github.com/matthewelwell) in [#84](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/84)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.4.1...v2.5.0

[Changes][v2.5.0]

<a id="v2.4.1"></a>

## [Version 2.4.1 (v2.4.1)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v2.4.1) - 2023-01-05

## What's Changed

-   Fix issue with local evaluation of multivariate flags by [@matthewelwell](https://github.com/matthewelwell) in [#87](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/87)
-   Release 2.4.1 by [@matthewelwell](https://github.com/matthewelwell) in [#86](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/86)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.4.0...v2.4.1

[Changes][v2.4.1]

<a id="v2.4.0"></a>

## [Version 2.4.0 (v2.4.0)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v2.4.0) - 2022-11-01

## What's Changed

-   Bump glob-parent and @babel/cli in /examples/local-evaluation by [@dependabot](https://github.com/dependabot) in [#67](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/67)
-   Bump ajv from 6.10.2 to 6.12.6 in /examples/local-evaluation by [@dependabot](https://github.com/dependabot) in [#69](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/69)
-   Bump ansi-regex from 3.0.0 to 3.0.1 in /examples/local-evaluation by [@dependabot](https://github.com/dependabot) in [#68](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/68)
-   Bump glob-parent and @babel/cli in /examples/custom-fetch-agent by [@dependabot](https://github.com/dependabot) in [#70](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/70)
-   Bump ajv from 6.10.2 to 6.12.6 in /examples/custom-fetch-agent by [@dependabot](https://github.com/dependabot) in [#73](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/73)
-   Bump browserslist from 4.6.6 to 4.21.3 in /examples/custom-fetch-agent by [@dependabot](https://github.com/dependabot) in [#72](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/72)
-   Bump ansi-regex from 3.0.0 to 3.0.1 in /examples/custom-fetch-agent by [@dependabot](https://github.com/dependabot) in [#71](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/71)
-   Feature/403/modulo segment operators by [@EdsnLoor](https://github.com/EdsnLoor) in [#76](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/76)
-   Feature/1145/is set is not set segment operators by [@EdsnLoor](https://github.com/EdsnLoor) in [#75](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/75)
-   Bump glob-parent and @babel/cli in /examples/caching by [@dependabot](https://github.com/dependabot) in [#74](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/74)
-   Release 2.4.0 by [@matthewelwell](https://github.com/matthewelwell) in [#77](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/77)

## New Contributors

-   [@EdsnLoor](https://github.com/EdsnLoor) made their first contribution in [#76](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/76)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.3.0...v2.4.0

[Changes][v2.4.0]

<a id="v2.3.0"></a>

## [2.3.0 - Allow custom fetch agents, improve examples and types (v2.3.0)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v2.3.0) - 2022-08-31

Allows people to supply a custom agent when initialising Flagsmith, allowing for

-   Network-related config such as keep-alive / socket timeouts
-   Proxies such as https://www.npmjs.com/package/https-proxy-agent

Exports Flagsmith constructor arguments as a type.

Adds a few examples concentrating on common use cases.

Closes [#29](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/29), [#20](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/20)

[Changes][v2.3.0]

<a id="2.1.0"></a>

## [2.1.0 ES import support](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/2.1.0) - 2022-07-22

Closes [#42](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/42) - you can now import Flagsmith as such

```
import Flagsmith, {...types} from 'flagsmith-nodejs'
```

[Changes][2.1.0]

<a id="v2.0.4"></a>

## [Version 2.0.4 (v2.0.4)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v2.0.4) - 2022-07-13

## What's Changed

-   Use featureName for analytics by [@matthewelwell](https://github.com/matthewelwell) in [#48](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/48)
-   Bump minimist from 1.2.5 to 1.2.6 by [@dependabot](https://github.com/dependabot) in [#38](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/38)
-   Bump node-fetch from 2.1.2 to 2.6.7 by [@dependabot](https://github.com/dependabot) in [#39](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/39)
-   Bump handlebars from 4.7.3 to 4.7.7 in /example by [@dependabot](https://github.com/dependabot) in [#17](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/17)
-   Release 2.0.4 by [@matthewelwell](https://github.com/matthewelwell) in [#47](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/47)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/2.0.3...v2.0.4

[Changes][v2.0.4]

<a id="2.0.3"></a>

## [2.0.3](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/2.0.3) - 2022-07-11

Closes [#43](https://github.com/Flagsmith/flagsmith-nodejs-client/issues/43)

[Changes][2.0.3]

<a id="v2.0.0"></a>

## [Version 2.0.0 (v2.0.0)](https://github.com/Flagsmith/flagsmith-nodejs-client/releases/tag/v2.0.0) - 2022-06-07

## What's Changed

-   Removes console.log of response by [@muddylemon](https://github.com/muddylemon) in [#1](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/1)
-   Make bullet-train flags stateless, fix binding. by [@kyle-ssg](https://github.com/kyle-ssg) in [#2](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/2)
-   Adds getUserIdentity(), getTrait() and setTrait(). Promise rejection if identity not provided by [@lukefanning](https://github.com/lukefanning) in [#3](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/3)
-   Update client to use new api endpoints by [@matthewelwell](https://github.com/matthewelwell) in [#4](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/4)
-   Update index.js by [@obax](https://github.com/obax) in [#6](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/6)
-   Update config.js by [@obax](https://github.com/obax) in [#5](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/5)
-   Solving error in Function by [@palazari19](https://github.com/palazari19) in [#8](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/8)
-   Bump handlebars from 4.0.12 to 4.7.3 in /example by [@dependabot](https://github.com/dependabot) in [#9](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/9)
-   feat: renamed type file to vscode automatically detect bullet-train type by [@raryson](https://github.com/raryson) in [#11](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/11)
-   Rebrand by [@kyle-ssg](https://github.com/kyle-ssg) in [#14](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/14)
-   Preventing errors while using this SDK by [@eilgin](https://github.com/eilgin) in [#15](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/15)
-   Add a cache options to reduce latency by [@eilgin](https://github.com/eilgin) in [#16](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/16)
-   fallback to require('node-fetch').default by [@kyle-ssg](https://github.com/kyle-ssg) in [#21](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/21)
-   Fix setTrait Return Type by [@beeme1mr](https://github.com/beeme1mr) in [#26](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/26)
-   WIP: Node SDK v2 by [@dabeeeenster](https://github.com/dabeeeenster) in [#23](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/23)
-   Update default URL to point to Edge API by [@matthewelwell](https://github.com/matthewelwell) in [#36](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/36)
-   feat: add semver support for segment condition by [@yuriihorodnyi21](https://github.com/yuriihorodnyi21) in [#37](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/37)
-   Release 2.0.0 by [@matthewelwell](https://github.com/matthewelwell) in [#35](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/35)

## New Contributors

-   [@muddylemon](https://github.com/muddylemon) made their first contribution in [#1](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/1)
-   [@lukefanning](https://github.com/lukefanning) made their first contribution in [#3](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/3)
-   [@obax](https://github.com/obax) made their first contribution in [#6](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/6)
-   [@palazari19](https://github.com/palazari19) made their first contribution in [#8](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/8)
-   [@dependabot](https://github.com/dependabot) made their first contribution in [#9](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/9)
-   [@raryson](https://github.com/raryson) made their first contribution in [#11](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/11)
-   [@eilgin](https://github.com/eilgin) made their first contribution in [#15](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/15)
-   [@beeme1mr](https://github.com/beeme1mr) made their first contribution in [#26](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/26)
-   [@dabeeeenster](https://github.com/dabeeeenster) made their first contribution in [#23](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/23)
-   [@yuriihorodnyi21](https://github.com/yuriihorodnyi21) made their first contribution in [#37](https://github.com/Flagsmith/flagsmith-nodejs-client/pull/37)

**Full Changelog**: https://github.com/Flagsmith/flagsmith-nodejs-client/commits/v2.0.0

[Changes][v2.0.0]

[v6.1.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v6.0.1...v6.1.0
[v6.0.1]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v6.0.0...v6.0.1
[v6.0.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v5.1.1...v6.0.0
[v5.1.1]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v5.1.0...v5.1.1
[v5.1.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v5.0.1...v5.1.0
[v5.0.1]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v5.0.0...v5.0.1
[v5.0.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v4.0.0...v5.0.0
[v4.0.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.3.3...v4.0.0
[v3.3.3]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.3.2...v3.3.3
[v3.3.2]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.3.1...v3.3.2
[v3.3.1]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.3.0...v3.3.1
[v3.3.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.2.0...v3.3.0
[v3.2.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.1.1...v3.2.0
[v3.1.1]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.1.0...v3.1.1
[v3.1.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.0.1...v3.1.0
[v3.0.1]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v3.0.0...v3.0.1
[v3.0.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.5.2...v3.0.0
[v2.5.2]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.5.1...v2.5.2
[v2.5.1]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.5.0...v2.5.1
[v2.5.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.4.1...v2.5.0
[v2.4.1]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.4.0...v2.4.1
[v2.4.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.3.0...v2.4.0
[v2.3.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/2.1.0...v2.3.0
[2.1.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.0.4...2.1.0
[v2.0.4]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/2.0.3...v2.0.4
[2.0.3]: https://github.com/Flagsmith/flagsmith-nodejs-client/compare/v2.0.0...2.0.3
[v2.0.0]: https://github.com/Flagsmith/flagsmith-nodejs-client/tree/v2.0.0

<!-- Generated by https://github.com/rhysd/changelog-from-release v3.9.0 -->
