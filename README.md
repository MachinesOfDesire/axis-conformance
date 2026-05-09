# axis-conformance

Two artifacts in one repository:

1. **The normative spec** — [`conformance-v0.1.md`](./conformance-v0.1.md), the runtime-behavior requirements every AXIS-conformant registry must meet.
2. **The reference test runner** — `axis-conformance` (npm package, source under `src/`), which probes a registry against the spec and emits a pass/fail report.

The protocol wire contract (record formats, AIT structure, endpoint schemas) lives at [MachinesOfDesire/axis-protocol](https://github.com/MachinesOfDesire/axis-protocol). A registry that wants to call itself AXIS-conformant satisfies both documents.

> **Status:** spec v0.1, runner v0.1.0-alpha.1. The runner covers the subset of conformance requirements that can be automated. Several requirements (availability SLOs, retention duration, PII handling) are inherently long-term or internal and are flagged as manual-verification items in the spec.

---

## The spec

[Registry Conformance v0.1](./conformance-v0.1.md) covers authentication, authorization scoping, audit logging, retention, domain verification, tiered visibility, rate limiting, availability, data handling, and key management. Pre-1.0 — breaking changes are possible between minor versions. Conformance versions are independent of the protocol specification version; a registry declares conformance against a specific version of this document (e.g., "AXIS Registry Conformance v0.1") alongside its protocol version.

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

The more keys and IDs you supply, the more of the suite runs. Tests that can't run with your inputs report as `skip`, not `fail`.

### Example output

```
AXIS Registry Conformance v0.1
target: https://registry.axisprime.ai
time:   2026-04-23T16:22:11.489Z

§1 Authentication
  ✓ PASS      §1.1.1.a  POST /register without auth returns 401
  ✓ PASS      §1.1.1.b  DELETE /agents/:id without auth returns 401
  ✓ PASS      §1.1.1.c  POST /delegations without auth returns 401
  ✓ PASS      §1.1.3.a  GET /.well-known/axis-access is publicly accessible
  ✓ PASS      §1.1.3.b  GET /verify with a malformed token returns valid=false (not 401)

§2 Authorization
  ✓ PASS      §2.2.3.a  GET /agents?operator_id= without auth returns 401
  ✓ PASS      §2.2.3.b  GET /operators without auth returns 401
  ✓ PASS      §2.2.4.a  GET /admin/stats without auth returns 401
  ...

summary: 12 pass  0 fail  13 skip  0 error
verdict: CONFORMANT
```

### What it does NOT test

Kept out of scope for v0.1 (either requires manual observation or is a long-term property):

- **§3.4 Retention duration.** We can't test "did this record still exist 12 months later" from a single test run.
- **§6 Rate limiting.** Measuring real limits requires dedicated load testing.
- **§7 Availability.** An SLO is an observation over weeks, not a test.
- **§8 Data handling.** PII classification and breach notification process are internal, not API-observable.
- **§3.2 Audit-before-mutation timing.** Verifying "audit row written before mutation applied" requires instrumenting the registry; this tool treats a successful break-glass call as evidence that the pattern is at least plausible.

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

Spec versions and runner versions evolve independently. The current pairing is **spec v0.1** and **runner v0.1.0-alpha.1**. The runner advertises which spec version it covers in its CLI output.

## License

Apache 2.0. See [LICENSE](./LICENSE).
