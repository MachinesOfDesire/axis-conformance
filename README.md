# axis-conformance

Two artifacts in one repository:

1. **The normative spec** — [`conformance-v0.2.md`](./conformance-v0.2.md), the runtime-behavior requirements every AXIS-conformant registry must meet. The previous version [`conformance-v0.1.md`](./conformance-v0.1.md) remains as a historical reference for v0.1-conformant registries during the transition window.
2. **The reference test runner** — `axis-conformance` (npm package, source under `src/`), which probes a registry against the spec and emits a pass/fail report.

The protocol wire contract (record formats, AIT structure, endpoint schemas) lives at [MachinesOfDesire/axis-protocol](https://github.com/MachinesOfDesire/axis-protocol). A registry that wants to call itself AXIS-conformant satisfies both documents.

> **Status:** spec v0.2 (covers AXIS Protocol v0.2.0), runner v0.2.0-alpha.1. The runner covers the subset of conformance requirements that can be automated without minting test AITs against a known agent's private key. Several requirements (availability SLOs, retention duration, PII handling, full AIT verification semantics, JCS proof verification) are inherently long-term, internal, or require additional test-mint machinery; these are flagged as manual-verification items in the spec.

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
| §10 AIT verification (v0.2) | `/verify` rejects malformed and empty tokens without 5xx; `aud` / `dlg` enforcement queued for stable v0.2 runner (requires AIT-mint helper) |
| §11 DC scope grammar (v0.2) | Mint-time scope validation queued for stable v0.2 runner (requires signed delegation envelope) |
| §12 AIR DID shape (v0.2) | Known agent's `did` matches v0.1 or v0.2 grammar; cross-form v0.1 → v0.2 resolution tolerance; `operator_id` consistency across `/agents` and `/resolve` |
| §13 Registration proof (v0.2) | `POST /register` rejects unknown `proofType`; JCS verification queued for stable v0.2 runner |
| §14 `/.well-known/axis-access` audience (v0.2) | Endpoint returns 200; `audience` field present, non-empty, stable across GETs; `Cache-Control` header (SHOULD) |

The more keys and IDs you supply, the more of the suite runs. Tests that can't run with your inputs report as `skip`, not `fail`.

### Example output

```
AXIS Registry Conformance v0.2
target: https://registry.axisprime.ai
time:   2026-05-12T03:30:00.000Z

§1 Authentication
  ✓ PASS      §1.1.1.a  POST /register without auth returns 401
  ✓ PASS      §1.1.3.a  GET /.well-known/axis-access is publicly accessible
  ...

§14 Access-policy advertisement (v0.2)
  ✓ PASS      §14.1.a   GET /.well-known/axis-access returns 200
  ✓ PASS      §14.1.b   Response includes `audience` field
  ✓ PASS      §14.1.c   `audience` is a non-empty string
  ✓ PASS      §14.1.d   `audience` is stable across multiple GETs
  ○ SKIP      §14.3.a   Response includes Cache-Control header (SHOULD — advisory)

summary: N pass  0 fail  M skip  0 error
verdict: CONFORMANT (at the level covered by v0.2 automation; skipped tests need manual verification)
```

### What it does NOT test

Kept out of scope for v0.2-alpha.1 (either requires manual observation, is a long-term property, or requires test-mint machinery the runner does not yet have):

- **§3.4 Retention duration.** We can't test "did this record still exist 12 months later" from a single test run.
- **§6 Rate limiting.** Measuring real limits requires dedicated load testing.
- **§7 Availability.** An SLO is an observation over weeks, not a test.
- **§8 Data handling.** PII classification and breach notification process are internal, not API-observable.
- **§3.2 Audit-before-mutation timing.** Verifying "audit row written before mutation applied" requires instrumenting the registry; this tool treats a successful break-glass call as evidence that the pattern is at least plausible.
- **§10 full AIT verification semantics.** Probing `aud` and `dlg` enforcement requires the runner to mint test AITs against a known agent's private key. The mint helper is queued for the stable v0.2 runner.
- **§11 DC scope grammar at mint.** Requires a valid signed delegation envelope to reach scope validation. Queued for stable v0.2.
- **§13 JCS proof verification.** Requires the runner to produce JCS-canonicalized signed registration bodies. Queued for stable v0.2.

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

Spec versions and runner versions evolve independently. The current pairing is **spec v0.2** and **runner v0.2.0-alpha.1**. The runner advertises which spec version it covers in its CLI output. The spec is independent of the AXIS Protocol version it covers; spec v0.2 covers AXIS Protocol v0.2.0.

See [CHANGELOG.md](./CHANGELOG.md) for runner version history and the [Version Coordination Log](https://www.notion.so/35df359483b281c98747fa47df0b1a65) (internal) for cross-project version coordination.

## Governance

AXIS Conformance is owned by Kipple Labs, Inc. and published under Apache 2.0. It is the companion repository to [AXIS Protocol](https://github.com/MachinesOfDesire/axis-protocol): the wire-protocol contract lives there; the runtime-behavior conformance criteria and the reference test runner live here. A registry that calls itself AXIS-conformant satisfies both documents.

The project is currently maintained by Kipple Labs. At a future date when adoption justifies it, day-to-day maintenance and governance may be delegated to an independent nonprofit foundation, with Kipple Labs retaining ownership of the conformance spec and trademarks. The open source licensing and Contributor License Agreement (see [CONTRIBUTING.md](./CONTRIBUTING.md)) were designed to make this transition legally and technically possible.

## Contributing

Contributions are welcome — issues, pull requests, additional automated tests, refinements to the spec language, third-party registry implementations to verify against. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) and sign the CLA before submitting a pull request.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full text and [NOTICE](./NOTICE) for attribution.

© 2026 Kipple Labs, Inc. "AXIS," "AXIS Protocol," "AXIS Prime," "N7," and "Kipple Labs" are pending trademarks of Kipple Labs, Inc. Use of "AXIS Registry Conformance v0.x" as a label for compatible implementations is permitted; see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidance.
