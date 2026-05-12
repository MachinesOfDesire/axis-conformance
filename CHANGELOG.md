# Changelog

All notable changes to `axis-conformance` (the spec docs at `conformance-v0.x.md` plus the test runner at `src/`). Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

The spec version (currently v0.2) and the runner version evolve independently. This changelog tracks **runner** versions; spec changes show up as version bumps in `conformance-v0.x.md` and in the runner's CLI banner.

## [0.2.0-alpha.1] — 2026-05-12

First v0.2 release. Adds normative conformance criteria for the six wire-format changes in [AXIS Protocol v0.2.0](https://github.com/MachinesOfDesire/axis-protocol/blob/main/CHANGELOG.md) (shipped 2026-05-11) plus runner test cases for the portion of those criteria automatable today. Also rolls in the canonical-infrastructure cleanup that landed in [axis-conformance#1](https://github.com/MachinesOfDesire/axis-conformance/pull/1) (merged 2026-05-11) which had been sitting at `[Unreleased]` between releases.

### Added — spec v0.2

- **`conformance-v0.2.md`** — new normative spec at the repo root. §1–§9 carry forward from v0.1 unchanged; §10–§14 are new conformance criteria for the v0.2 protocol changes:
  - **§10 AIT verification semantics** — `aud` REQUIRED (§10.1), `dlg` optional with chain resolution and depth cap (§10.2)
  - **§11 DC scope grammar** — segment syntax `[a-zA-Z0-9_-]+`, single-segment wildcard `*`, intersection across chain, mint-time validation (§11.1–§11.3)
  - **§12 AIR DID shape** — v0.2 4-segment form `did:axis:{registry}:{operator-slug}:{agent-slug}`, tier-driven slug derivation, cross-form (v0.1 + v0.2) resolution tolerance, cross-endpoint `operator_id` consistency (§12.1–§12.4)
  - **§13 Registration proof format** — `proofType: "jcs-eddsa-2026"` (RFC 8785 JCS) plus legacy v0.1 form, fallback semantics, unknown-type rejection (§13.1–§13.2)
  - **§14 Access-policy advertisement** — `/.well-known/axis-access` REQUIRED `audience` field, stability requirement, signing posture, caching (§14.1–§14.3)
- **§15 Conformance tests** — meta-conformance section (renumbered from §10 in v0.1). Enumerates runner coverage and manual-verification items.

### Added — runner v0.2.0-alpha.1

- **Five new test sections** at `src/tests/`: `10-ait-verification.js`, `11-dc-scope-grammar.js`, `12-air-did-shape.js`, `13-registration-proof.js`, `14-access-policy-audience.js`. Each registered in `runner.js` `SECTIONS` array.
- **Automatable coverage today** (no AIT-mint helper required):
  - §10.1.a–b — `/verify` rejects malformed and empty tokens without 5xx
  - §12.1.a — known agent's `did` field matches v0.1 or v0.2 grammar
  - §12.3.a — v0.1 form of a v0.2 agent resolves at `/resolve/:did` and returns the same agent record
  - §12.4.a — `operator_id` consistent across `/agents/:id` and `/resolve/:did`
  - §13.1.a — `POST /register` rejects unknown `proofType` with 400
  - §14.1.a–d — `/.well-known/axis-access` returns 200; `audience` present, non-empty string, stable across multiple GETs
  - §14.3.a — `Cache-Control` header advisory check
- **Queued for stable v0.2 runner** (require AIT-mint helper, signed delegation envelope, or JCS proof builder): §10.1.c–d aud enforcement, §10.2.a–b chain resolution, §11.1.a–c and §11.2.a and §11.3.a DC scope mint validation and intersection, §12.1.b new-agent v0.2 form, §13.1.b–c and §13.2.a JCS proof verification. All return `skip` with a documented reason today.
- **CLI banner advertises spec v0.2 coverage.** `SUITE_VERSION` bumped `0.1.0-alpha.1` → `0.2.0-alpha.1`; `CONFORMANCE_VERSION` bumped `0.1` → `0.2`. CLI help text and report headers updated.
- **`package.json` version** bumped to `0.2.0-alpha.1`.

### Changed — also in this release (carried from PR #1 canon cleanup)

- **LICENSE copyright line** corrected from `Copyright 2026 Josh Ashcroft / Kipple Labs` to `Copyright 2026 Kipple Labs, Inc.` per Corporate Canon.
- **README runner-version line** corrected `runner v0.1.0-alpha.1` → `runner v0.1.0-alpha.2` (and now updated to alpha.1 of v0.2 in this release).
- **README** Governance / expanded License / trademark notice / Contributing pointer added mirroring axis-protocol#3.

### Added — also in this release (carried from PR #1 canon cleanup)

- **NOTICE** at repo root with CIIAA date April 24, 2026 and the Kipple Labs trademark list.
- **CONTRIBUTING.md** with canonical CLA (grantee = Kipple Labs, Inc.).
- **CLAUDE.md** at repo root mirroring N7's structural template.

### Live verification

Live-target verification deferred to a follow-up: registry v0.2 implementation merged on `axis-registry` main (PRs #8 / #9 / #10 / #13) but not yet release-tagged or confirmed deployed at `registry.axisprime.ai`. Spec v0.2 + runner v0.2.0-alpha.1 will be exercised against the deployed v0.2 registry once it cuts.

## [0.1.0-alpha.2] — 2026-05-09

First release that publishes the runner code to GitHub. Prior to this release the public `MachinesOfDesire/axis-conformance` repo held only the spec doc; the runner code lived local-only.

### Added

- **Repository consolidation**: spec doc (`conformance-v0.1.md`) and runner (`src/`, `package.json`, etc.) now live in one repo. Histories merged with `--allow-unrelated-histories`. README rewritten to describe both. (Commit `be667c0`.)
- **Structural self-test**: `src/self-test.js` validates the runner's internal shape (`SECTIONS` non-empty, every test has `id`/`requirement`/`run`, ids are globally unique, ids match `N.N.x` format). Runs with `npm test`. Designed to catch refactoring regressions; for "does my registry conform?" use `npm run check` or the `axis-conformance` bin. (Commit `89eef04`.)

### Fixed

- **`npm test` was silently passing zero tests**: The script pointed at `test/*.test.js`, which did not exist (the suite is CLI-driven via `runner.js`, not unit tests). The new self-test replaces it.

### Live verification

Runner v0.1.0-alpha.2 against `https://registry.axisprime.ai` (2026-05-09): **19 pass / 0 fail / 6 skip / verdict CONFORMANT**. The 6 skips need a separate registrar key + `--known-operator-id` / `--known-agent-id` to fully exercise (BOLA matrix and tier-leak tests).

## [0.1.0-alpha.1] — 2026-04-30

Initial commit. Local-only at the time. Includes:

- Conformance Spec v0.1 (`conformance-v0.1.md`) — runtime-behavior requirements every AXIS-conformant registry must meet, complementing the wire-protocol contract at [MachinesOfDesire/axis-protocol](https://github.com/MachinesOfDesire/axis-protocol).
- Runner with CLI (`axis-conformance --registry-url ...`), JSON output mode, configurable depth via supplied keys, exit codes 0/1/2 for conformant/non-conformant/invalid-args.
- Test sections covering authentication (§1), authorization (§2), audit (§3), domain verification (§4), tiered visibility (§5), key management (§9). Three sections (§6 rate limiting, §7 availability, §8 data handling) are explicitly out of scope for automation — flagged in the spec as manual-verification items.
