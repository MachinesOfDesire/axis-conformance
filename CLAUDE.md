# Claude Code Instructions — AXIS Conformance

## First action every session

1. Read PROJECT_CANON.md in this repo (when added; not yet present)
2. Open the Kipple Labs Manifest in Notion: https://www.notion.so/35df359483b2817a97c5e9c7a5169e85
3. Read the Corporate Canon in Notion: https://www.notion.so/35df359483b28183a02ac7603504b904
4. Read the AXIS Conformance Canon in Notion: https://www.notion.so/35df359483b2814f8b33ff002c67dd90
5. Read the AXIS Protocol Canon in Notion (conformance depends on the protocol):
   https://www.notion.so/35df359483b281848efae1f258ba0458
6. Check the Cross-Project Coordination database, filtered to AXIS-Conformance-affecting items:
   https://www.notion.so/d2f90b6b9d384973abfbb25b17592d20
7. Read the AXIS Conformance hub: https://www.notion.so/35df359483b281898e2edcb76d2d81e4
8. Check the Version Coordination Log if your work touches spec or runner versioning:
   https://www.notion.so/35df359483b281c98747fa47df0b1a65

If any of those documents are missing or contradict each other, STOP and surface to Josh.

## Project scope

AXIS Conformance is two artifacts in one repository:

- The normative **conformance spec** (`conformance-v0.x.md`) — runtime-behavior requirements every AXIS-conformant registry must meet, supplementing the wire-protocol contract in AXIS Protocol.
- The reference **test runner** (`axis-conformance` npm package; source under `src/`) — probes a registry URL against the spec and emits a pass/fail report.

This Project's scope:

- Conformance spec authoring (clarifications within a version; new requirements in the next version)
- Runner implementation, test coverage, diagnostics, CI integration
- Third-party registry verification targets
- Conformance-specific documentation (README, CHANGELOG, CONTRIBUTING, NOTICE, LICENSE)

This Project does NOT do:

- AXIS Protocol wire-format or schema changes (raise as cross-project Coordination item; Assigned to AXIS Protocol)
- AXIS Prime / axis-registry implementation changes (raise as cross-project Coordination item; Assigned to AXIS Prime)
- N7 agent harness changes (raise as cross-project Coordination item; Assigned to N7)
- Legal / IP / canonical content (Corporate; or Josh decision required)

## Files I cannot modify without explicit instruction

- LICENSE
- NOTICE
- README.md (copyright footer, governance section, license section, trademark notice)
- CONTRIBUTING.md (CLA grantee language, maintainer reference)
- CONTRIBUTORS.md (when added)
- `conformance-v0.1.md` (the normative spec — spec changes require explicit instruction or an accepted Coordination item)
- PROJECT_CANON.md (when added)
- `package.json` `version` field without checking the Version Coordination Log
- Anything related to spec version or runner version numbers without checking the Version Coordination Log
- Anything related to AXIS Protocol version without checking the Version Coordination Log

For these files, I must:

1. State what change I propose
2. Reference the canon value being changed
3. Wait for Josh's explicit approval

## Conflict handling

- README runner version drift vs. actual release tag: surface, don't silently update unless the change is the explicit reason this session was invoked
- Spec text contradicts the AXIS Conformance Canon: surface, don't silently update
- Existing repo content contradicts prior sessions' work: surface, don't silently revert
- Version coordination decision unclear (spec version, runner version, or which AXIS Protocol version the spec covers): surface to Josh

## Version coordination

- Spec versions (`conformance-v0.x.md`) and runner versions (`package.json`) evolve independently
- The runner CLI banner advertises which spec version it tests; keep these in sync
- The spec body declares which AXIS Protocol version it covers; bumping AXIS Protocol may require a new spec version
- Any version bump anywhere creates a Version Coordination Log entry before shipping
- Disputes over conformance versioning go to Josh

## Branch and commit hygiene

- Never push to main
- Feature branch matches the originating session slug (chat name lowercased, spaces to hyphens, no prefix). Same string as the local workspace dir under `~/.claude/sessions/`. Example: chat "AXIS Conformance - Canon Cleanup" -> branch `axis-conformance-canon-cleanup`. This convention was standardized 2026-05-11 across all Kipple Labs repos; do not use a `claude-code/` or `cowork/` prefix.
- Conventional commit messages (`spec:`, `runner:`, `test:`, `docs:`, `chore:`, `build:`, `refactor:`)
- One conceptual change per commit
- Open a PR when complete; do not merge yourself

## Session log

At session start, update the session's own `~/.claude/sessions/<slug>/ACTIVE.md` (multi-session workspace convention) with:

- What I'm working on
- Branch I'm using
- Expected output

At session end, update ACTIVE.md plus append to JOURNAL.md and refresh HANDOFF.md per `~/.claude/memory/session_workspace_convention.md`. Mirror ACTIVE state to the Claude Sessions Notion page: https://www.notion.so/35bf359483b281a5b350c3290dc124dc

## Code conventions

- Runner: JavaScript, Node 18+, ES modules
- One section file per spec section under `src/sections/`
- Test ids follow `N.N.x` format and are globally unique; the structural self-test (`npm test`) enforces this
- Tests are independent — no test depends on side effects of a previous test
- No real-network calls in `npm test`; the network-driven suite runs via `npm run check` or the `axis-conformance` bin
- Exit codes: `0` conformant, `1` non-conformant, `2` invalid args
- Conventional commits
- Run the full structural self-test before opening a PR; new tests add `N.N.x` ids that pass the self-test
- Cryptographic primitives: Ed25519 / EdDSA per RFC 8037 (matches AXIS Protocol)

## When in doubt

Surface to Josh. The canon system's value depends on no session silently improvising.
