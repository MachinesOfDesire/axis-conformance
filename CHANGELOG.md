# Changelog

All notable changes to `axis-conformance` (the spec doc at `conformance-v0.1.md` plus the test runner at `src/`). Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

The spec version (currently v0.1) and the runner version evolve independently. This changelog tracks **runner** versions; spec changes show up as version bumps in `conformance-v0.1.md` and in the runner's CLI banner.

## [Unreleased]

### Changed

- **LICENSE copyright line** corrected from `Copyright 2026 Josh Ashcroft / Kipple Labs` (joint attribution) to `Copyright 2026 Kipple Labs, Inc.` per Corporate Canon. All IP held by Kipple Labs, Inc. (Delaware C-corp, formed 2026-04-22) since CIIAA Schedule 1 dated 2026-04-24.
- **README runner-version line** corrected from `runner v0.1.0-alpha.1` to `runner v0.1.0-alpha.2` to match the shipped release (2026-05-09).
- **README** gained a Governance section, an expanded License section with trademark notice, and a Contributing pointer — mirroring the structure shipped in [axis-protocol#3](https://github.com/MachinesOfDesire/axis-protocol/pull/3).

### Added

- **NOTICE file** at repo root, attributing the work to Joshua Ashcroft as the original author prior to Kipple Labs formation, with the CIIAA assignment recorded and the Kipple Labs trademark list named. Required by Apache 2.0 §4(d) attribution pattern.
- **CONTRIBUTING.md** with the canonical Contributor License Agreement — CLA grantee is Kipple Labs, Inc. (and any future foundation or successor that inherits stewardship), per the Corporate Canon. Same CLA language as shipped in axis-protocol#3 (merged 2026-05-11).
- **CLAUDE.md** at repo root, mirroring the structure standardized in the N7 repo on 2026-05-11: project scope, version coordination as its own section, code conventions filled in, branch-naming convention with date reference, project-specific orientation.

### Notes

These changes are documentation- and canonical-infrastructure-only. No runner behavior or spec text changes. No version bump.

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
