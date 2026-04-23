# axis-conformance

Conformance test suite for AXIS registries. Probes a registry URL against the [Registry Conformance v0.1 spec](https://github.com/MachinesOfDesire/axis-registry/blob/main/docs/conformance.md) and emits a pass/fail report.

> **Status:** v0.1.0-alpha.1. Covers the subset of conformance requirements that can be automated. Several requirements (availability SLOs, retention duration, PII handling) are inherently long-term or internal and are flagged as manual-verification items.

---

## What this is for

If you run a registry (the reference one at `registry.axisprime.ai`, or your own fork, or eventually a third-party registry from someone else in the federation), this tool tells you whether your registry meets Registry Conformance v0.1.

If you are thinking about building one, run this against your WIP to see where you stand.

If you are the reference team, this runs in CI on every deploy and guards against regressions.

## Install

```bash
npm install -g axis-conformance
```

Or run via `npx`:

```bash
npx axis-conformance --registry-url https://registry.axisprime.ai
```

## Run

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

## What it tests

| Section | Tests |
|---|---|
| §1 Authentication | Mutating endpoints reject unauthenticated; public endpoints work without auth |
| §2 Authorization | BOLA matrix (when second key supplied); `/admin/*` gating by role |
| §3 Audit | Break-glass endpoints require non-empty reason; admin audit readable; self-scoped audit optional |
| §4 Domain verification | Method validation; structural checks |
| §5 Tiered visibility | Public layer does not leak presentation fields; listing endpoints require auth; agent listing enforces owner-or-admin |
| §9 Key management | Invalid keys rejected; wrong-form headers rejected |

The more keys and IDs you supply, the more of the suite runs. Tests that can't run with your inputs report as `skip`, not `fail`.

## Example output

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

## What it does NOT test

Kept out of scope for v0.1 (either requires manual observation or is a long-term property):

- **§3.4 Retention duration.** We can't test "did this record still exist 12 months later" from a single test run.
- **§6 Rate limiting.** Measuring real limits requires dedicated load testing.
- **§7 Availability.** An SLO is an observation over weeks, not a test.
- **§8 Data handling.** PII classification and breach notification process are internal, not API-observable.
- **§3.2 Audit-before-mutation timing.** Verifying "audit row written before mutation applied" requires instrumenting the registry; this tool treats a successful break-glass call as evidence that the pattern is at least plausible.

## Use in CI

Add to your GitHub Actions workflow:

```yaml
- name: Registry conformance
  run: |
    npx axis-conformance \
      --registry-url https://registry.axisprime.ai \
      --super-admin-key "${{ secrets.AXIS_CONFORMANCE_KEY }}" \
      --known-operator-id "${{ vars.AXIS_KNOWN_OPERATOR }}"
```

Exit status is non-zero on any failure, so the workflow fails the deploy.

## License

Apache 2.0. See [LICENSE](./LICENSE).
