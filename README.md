# axis-conformance

Two artifacts in one repository:

1. **The normative spec** — [`conformance-v0.3.md`](./conformance-v0.3.md), the runtime-behavior requirements every AXIS-conformant registry must meet. Prior versions [`conformance-v0.2.md`](./conformance-v0.2.md) and [`conformance-v0.1.md`](./conformance-v0.1.md) remain as historical references for registries at those conformance levels during the transition window.
2. **The reference test runner** — `axis-conformance` (npm package, source under `src/`), which probes a registry against the spec and emits a pass/fail report.

The protocol wire contract (record formats, AIT structure, endpoint schemas) lives at [MachinesOfDesire/axis-protocol](https://github.com/MachinesOfDesire/axis-protocol). A registry that wants to call itself AXIS-conformant satisfies both documents.

> **Status:** spec v0.3 (covers AXIS Protocol v0.3), runner v0.3.0-alpha.1. The runner covers the subset of conformance requirements that can be automated against a deployed registry. v0.3 adds §16–§19 (registry-legitimacy artifacts, scope-vocabulary discovery, versioned discovery, chain-by-`dlg` resolution) — all public read-only GETs that pass against the reference registry today. Several requirements (availability SLOs, retention duration, PII handling, full AIT verification semantics, JCS proof verification) plus the specified-but-not-yet-enforced v0.3 mechanisms (sender-constrained AITs / DPoP, ephemeral delegates, mint-time vocabulary enforcement, `/.well-known/axis-versions`) are inherently long-term, internal, or intentionally deferred; these are flagged as manual-verification items in the spec.

---

## The spec

[Registry Conformance v0.2](./conformance-v0.2.md) covers everything in v0.1 (authentication, authorization scoping, audit logging, retention, domain verification, tiered visibility, rate limiting, availability, data handling, key management) plus five new sections for AXIS Protocol v0.2.0: AIT verification semantics (REQUIRED `aud`, optional `dlg`), DC scope grammar, AIR operator-namespaced DIDs with cross-form tolerance, registration proof format (`jcs-eddsa-2026`), and `/.well-known/axis-access` audience advertisement. Pre-1.0 — breaking changes are possible between minor versions. Conformance versions are independent of the protocol specification version; a registry declares conformance against a specific version of this document (e.g., "AXIS Registry Conformance v0.2") alongside its protocol version.

## The runner

If you operate a registry (the reference one at `registry.axisprime.ai`, your own fork, or a third-party in the federation), this tool tells you whether your registry meets the spec. If you're building one, run it against your WIP. If you're the reference team, this runs in CI on every deploy.

### Install

```bash
npm install -g axis-conformance
```

Or via `npx`:

```bash
npx axis-conformance --registry-url https://registry.axisprime.ai
```

### Run

**Minimum (public-only checks):**

```bash
axis-conformance --registry-url https://registry.axisprime.ai
```

**Full suite (all automated checks):**

```bash
axis-conformance \
  --registry-url https://registry.axisprime.ai \
  --registrar-key-a "$PLAIN_REGISTRAR_KEY" \
  --registrar-key-b "$SECOND_REGISTRAR_KEY" \
  --admin-key "$ADMIN_KEY" \
  --super-admin-key "$SUPER_ADMIN_KEY" \
  --known-operator-id "some-operator-id" \
  --known-agent-id "axis:some-op:some-agent"
```

**JSON output (for CI):**

```bash
axis-conformance --registry-url https://... --json > conformance-report.json
```

Exit codes: `0` conformant, `1` non-conformant, `2` invalid args.

### What it tests

| Section | Tests |
|---|---|
| §1 Authentication | Mutating endpoints reject unauthenticated; public endpoints work without auth |
| §2 Authorization | BOLA matrix (when second key supplied); `/admin/*` gating by role |
| §3 Audit | Break-glass endpoints require non-empty reason; admin audit readable; self-scoped audit optional |
| §4 Domain verification | Method validation; structural checks |
| §5 Tiered visibility | Public layer does not leak presentation fields; listing endpoints require auth; agent listing enforces owner-or-admin |
| §9 Key management | Invalid keys rejected; wrong-form headers rejected |
| §10 AIT verification (v0.2) | `/verify` rejects malformed and empty tokens without 5xx; `aud` / `dlg` enforcement via minted controlled-claim AITs when inputs supplied |
| §11 DC scope grammar (v0.2) | Mint-time scope validation via signed delegation envelope when a registrar key + issuer supplied |
| §12 AIR DID shape (v0.2) | Known agent's `did` matches v0.1 or v0.2 grammar; cross-form v0.1 → v0.2 resolution tolerance; `operator_id` consistency across `/agents` and `/resolve` |
| §13 Registration proof (v0.2) | `POST /register` rejects unknown `proofType`; JCS proof verification via signed register body when a registrar key + known operator supplied |
| §14 `/.well-known/axis-access` audience (v0.2) | Endpoint returns 200; `audience` field present, non-empty, stable across GETs; `Cache-Control` header (SHOULD) |
| §16 Registry-legitimacy artifacts (v0.3) | Signed self-manifest `/.well-known/axis-registry` + signed root directory `/.well-known/axis-directory`; legitimacy chain (active key fingerprinted in the directory) |
| §17 Scope-vocabulary discovery (v0.3) | `/.well-known/axis-scopes` served; two-layer `namespace:action` standard vocabulary; each entry carries `scope`/`standard`/`description`; core `content` namespace present |
| §18 Versioned discovery (v0.3) | Every discovery document self-declares `axis_version`; v0.3 docs declare `"0.3"`; `/.well-known/axis-versions` optional |
| §19 Delegation chain by `dlg` (v0.3) | `GET /delegations/:id/chain` routed; chain verdict for a known credential when `--known-delegation-id` supplied |

The more keys and IDs you supply, the more of the suite runs. Tests that can't run with your inputs report as `skip`, not `fail`.

### Example output

```
AXIS Registry Conformance v0.3
target: https://registry.axisprime.ai
time:   2026-07-18T21:30:00.000Z

§1 Authentication
  ✓ PASS      §1.1.1.a  POST /register without auth returns 401
  ✓ PASS      §1.1.3.a  GET /.well-known/axis-access is publicly accessible
  ...

§16 Registry-legitimacy artifacts (v0.3)
  ✓ PASS      §16.1.a   GET /.well-known/axis-registry returns 200 JSON
  ✓ PASS      §16.1.d   Self-manifest is signed (top-level signature field)
  ✓ PASS      §16.3.a   Legitimacy chain: active key fingerprinted in the root directory

§17 Scope-vocabulary discovery (v0.3)
  ✓ PASS      §17.1.d   Standard scopes follow the two-layer namespace:action grammar

§18 Versioned discovery (v0.3)
  ✓ PASS      §18.1.b   The v0.3-introduced documents declare axis_version "0.3"

§19 Delegation chain resolution by dlg (v0.3)
  ✓ PASS      §19.1.a   GET /delegations/:id/chain is a routed endpoint
  ○ SKIP      §19.1.b   Chain verdict for a known credential (needs --known-delegation-id)

summary: N pass  0 fail  M skip  0 error
verdict: CONFORMANT (at the level covered by v0.3 automation; skipped tests need manual verification)
```

### What it does NOT test

Kept out of scope for v0.3-alpha.1 (either requires manual observation, is a long-term property, requires inputs the runner is not supplied, or is a v0.3 mechanism specified-but-not-yet-enforced):

- **§3.4 Retention duration.** We can't test "did this record still exist 12 months later" from a single test run.
- **§6 Rate limiting.** Measuring real limits requires dedicated load testing.
- **§7 Availability.** An SLO is an observation over weeks, not a test.
- **§8 Data handling.** PII classification and breach notification process are internal, not API-observable.
- **§3.2 Audit-before-mutation timing.** Verifying "audit row written before mutation applied" requires instrumenting the registry; this tool treats a successful break-glass call as evidence that the pattern is at least plausible.
- **§10.2.b / §11.2 chain intersection and depth cap.** Require multi-credential test chains anchored to agents whose private keys the runner is not supplied. The signing fixtures exist; the inputs do not.
- **§11.3.2 mint-time monotonic attenuation (now a MUST in v0.3).** Requires an issuer credential + its parent chain to broaden against; probed only when those inputs are supplied.
- **v0.3 specified-but-not-yet-enforced mechanisms** — mint-time scope-vocabulary enforcement, sender-constrained AITs (`cnf.jkt` / DPoP), ephemeral sub-agent delegates, the AIT `axis_version` claim, and `/.well-known/axis-versions`. These are deliberately NOT given pass/fail probes: the reference registry conforms to v0.3's staged rollout by NOT enforcing them yet, so a probe would penalize honest conformance. They are listed in `conformance-v0.3.md` §15.5 as manual-verification / deferred.

### Use in CI

```yaml
- name: Registry conformance
  run: |
    npx axis-conformance \
      --registry-url https://registry.axisprime.ai \
      --super-admin-key "${{ secrets.AXIS_CONFORMANCE_KEY }}" \
      --known-operator-id "${{ vars.AXIS_KNOWN_OPERATOR }}"
```

Exit status is non-zero on any failure, so the workflow fails the deploy.

### Self-test

A structural self-test for the runner machinery (no network access required):

```bash
npm test
```

Validates the SECTIONS array, test shape, and id uniqueness. For "does my registry conform?" use `npm run check` or the `axis-conformance` bin shown above.

## Versioning

Spec versions and runner versions evolve independently. The current pairing is **spec v0.3** and **runner v0.3.0-alpha.1**. The runner advertises which spec version it covers in its CLI output. The spec is independent of the AXIS Protocol version it covers; spec v0.3 covers AXIS Protocol v0.3.

See [CHANGELOG.md](./CHANGELOG.md) for runner version history and the [Version Coordination Log](https://www.notion.so/35df359483b281c98747fa47df0b1a65) (internal) for cross-project version coordination.

## Governance

AXIS Conformance is owned by Kipple Labs, Inc. and published under Apache 2.0. It is the companion repository to [AXIS Protocol](https://github.com/MachinesOfDesire/axis-protocol): the wire-protocol contract lives there; the runtime-behavior conformance criteria and the reference test runner live here. A registry that calls itself AXIS-conformant satisfies both documents.

The project is currently maintained by Kipple Labs. At a future date when adoption justifies it, day-to-day maintenance and governance may be delegated to an independent nonprofit foundation, with Kipple Labs retaining ownership of the conformance spec and trademarks. The open source licensing and Contributor License Agreement (see [CONTRIBUTING.md](./CONTRIBUTING.md)) were designed to make this transition legally and technically possible.

## Contributing

Contributions are welcome — issues, pull requests, additional automated tests, refinements to the spec language, third-party registry implementations to verify against. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and sign the CLA before submitting a pull request.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full text and [NOTICE](./NOTICE) for attribution.

© 2026 Kipple Labs, Inc. "AXIS," "AXIS Protocol," "AXIS Prime," "N7," and "Kipple Labs" are pending trademarks of Kipple Labs, Inc. Use of "AXIS Registry Conformance v0.x" as a label for compatible implementations is permitted; see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidance.
