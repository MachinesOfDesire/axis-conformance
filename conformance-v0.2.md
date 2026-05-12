# AXIS Registry Conformance v0.2

**Status:** Draft, 2026-05-12.
**Covers protocol version:** AXIS Protocol v0.2.0 (shipped 2026-05-11).
**Relationship to spec:** The AXIS Protocol spec defines what goes on the wire: record formats, resolution semantics, delegation envelopes, AIT format. This document defines how a registry implementation MUST behave at runtime. The protocol spec is the data contract; this is the operational contract. A registry that calls itself AXIS-conformant satisfies both documents.
**Audience:** anyone implementing an AXIS-conformant registry. The reference implementation is [AXIS Prime](https://registry.axisprime.ai), built from [`axis-registry`](https://github.com/MachinesOfDesire/axis-registry). When a second registry appears, this is the document it conforms against.

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) and [RFC 8174](https://datatracker.ietf.org/doc/html/rfc8174).

---

## What changed from v0.1

§1 through §9 are unchanged from [Registry Conformance v0.1](./conformance-v0.1.md) and reproduced below verbatim. §10 through §14 are new operational requirements arising from the six normative changes in [AXIS Protocol v0.2.0](https://github.com/MachinesOfDesire/axis-protocol/blob/main/CHANGELOG.md). §15 is the meta-conformance section (was §10 in v0.1, renumbered).

The six v0.2 protocol changes covered by §10–§14 are:

| Protocol change | Conformance section |
|---|---|
| AIT REQUIRED `aud` claim (protocol §4.3) | §10.1 |
| AIT optional `dlg` claim (protocol §4.3) | §10.2 |
| DC formal scope grammar (protocol §4.4) | §11 |
| AIR operator-namespaced DIDs (protocol §4.1, §10.3) | §12 |
| POST /register `proof.proofType` field (protocol §6.1) | §13 |
| `/.well-known/axis-access` REQUIRED `audience` field (protocol §6.12, §7) | §14 |

A registry that meets v0.1 but does not yet meet §10–§14 is **v0.1-conformant** and is permitted to call itself "AXIS Registry Conformance v0.1." It is NOT permitted to claim v0.2 conformance. Per protocol §10.3 transition rules, v0.2-conformant registries MUST accept v0.1 DID forms in resolution; v0.1-conformant registries do not advertise the v0.2 form.

---

## §1 Authentication

**§1.1** Every mutating request (POST, PATCH, DELETE) to registry resources MUST be authenticated. The authentication mechanism MUST produce a stable `registrar_id` that the authorization layer can reference.

**§1.2** The reference registry uses SHA-256 hashed API keys submitted as `Authorization: Bearer <key>`. Conformant registries MAY use any cryptographically sound mechanism (OAuth 2.0 client credentials, mTLS, signed requests). They MUST NOT use plaintext password comparison, and they MUST NOT cache authentication decisions beyond the lifetime of a single request without documented invalidation semantics.

**§1.3** Public read endpoints (resolve, verify, delegation chain, revocation) MUST be accessible without authentication. A conformant registry MUST NOT gate public identity resolution behind authentication.

## §2 Authorization

**§2.1 — Role model.** A conformant registry MUST distinguish at least three roles on registrar accounts:

- `registrar` — default. Scoped to the registrar's own resources.
- `admin` — full cross-tenant read. Mutations on registrar-owned resources remain scoped.
- `super_admin` — admin plus the ability to call explicit break-glass mutation endpoints (§3.2).

A registry MAY introduce additional roles (auditor, billing-admin, etc.) as long as they do not weaken the constraints above.

**§2.2 — Ownership scoping.** For every mutating endpoint acting on an operator-owned resource (operator row, agent row, delegation), the registry MUST reject the call with HTTP 403 `not_your_resource` when the authenticated registrar is not the owning registrar, except through the break-glass mechanisms defined in §3.2.

This applies equally to `registrar` and `admin` callers on the normal path. `admin` role grants cross-tenant **read**, not cross-tenant mutation.

**§2.3 — Listing and enumeration.** Endpoints that enumerate operator-scoped data (e.g. "list agents under operator X") MUST require authentication. The caller MUST be either the owning registrar or an `admin+` role; otherwise the registry MUST return HTTP 401 or 403.

**§2.4 — `/admin/*` endpoints.** Any endpoint path beginning with `/admin/` MUST require `admin` or `super_admin` role. The reference registry gates this at a single middleware point so the rule is inherited by every subpath.

**§2.5 — Derivation of identity.** Authorization decisions MUST derive resource ownership from the authenticated principal's `registrar_id`, not from values supplied in the request body, query parameters, or path segments.

## §3 Audit

**§3.1 — Normal-path audit.** Every successful mutation SHOULD be recorded to an append-only audit log with at minimum: `action`, `actor` (registrar id), `target` (resource id), `registrar_id`, optional structured `details`, client `ip_address`, and a server-assigned timestamp.

**§3.2 — Break-glass audit.** Cross-tenant mutations authorized under §2 require explicit break-glass endpoints (e.g. `/admin/force-deactivate-agent/:id`, `/admin/force-revoke-delegation/:id`). For every call to a break-glass endpoint, a conformant registry MUST:

1. Require a non-empty `reason` string in the request body.
2. Write an audit row with the action, actor, target, reason, and authenticated role **before** executing the mutation.
3. Abort the mutation if the audit write fails, returning HTTP 500 `audit_write_failed`.

**§3.3 — Immutability.** The audit log MUST NOT support edit or delete operations via the registry API. Registries SHOULD store audit records in a backend that does not permit in-place modification.

**§3.4 — Retention.** Audit records MUST be retained for at least 12 months. Registries MAY retain longer; they MUST NOT delete audit records before 12 months unless compelled by law.

**§3.5 — Visibility.** Audit records MUST be readable by `admin+` roles. `registrar` role callers MUST NOT receive audit records referencing operators they do not own.

## §4 Domain verification

**§4.1 — Accepted methods.** A conformant registry MUST support at least one of:

- **DNS TXT**: a TXT record at `_axis-verify.<domain>` with value `axis-verify=<token>`.
- **HTTP file**: a JSON document at `https://<domain>/.well-known/axis-verify.json` with body `{"axis-verify": "<token>"}`.

The reference registry supports both.

**§4.2 — Token properties.** Verification tokens MUST be cryptographically random, at least 128 bits of entropy, and expire no more than 72 hours after issuance.

**§4.3 — Lookup mechanism.** Registries MUST use an out-of-band DNS or HTTP lookup for verification. They MUST NOT trust claims made in the verification request itself. The reference registry uses Cloudflare DNS over HTTPS for TXT lookups.

**§4.4 — Persistence on initiation.** When a domain is claimed for an operator that already exists, the registry MUST persist the claimed domain to the operator record at initiation time. Without this, the subsequent `check` call's ownership lookup (which queries by domain) cannot find the right operator row, and verification fails even when the proof DNS/HTTP record matches the issued token.

**§4.5 — Tier upgrade only on proof.** The operator's `verification_tier` MUST NOT be upgraded to `domain` until the DNS or HTTP proof has been verified. Initiating a claim MUST NOT grant the tier.

## §5 Operator tier visibility

**§5.1 — Presentation layer.** Operator records have two visibility layers:

- **Public**: always returned. Includes `operator_id`, `public_key` (if set), `status`, `registry_url`, `revocation_url`. No `display_name`, no `verification_tier`, no timestamps.
- **Presentation**: returned when the caller presents a valid AIT bound to an agent under the same or a peer operator, or when the caller is the owning registrar or admin+. Adds `display_name`, `verification_tier`, `registered_at`.

**§5.2 — Tiered discovery.** A conformant registry MUST NOT expose the list of registered operators to unauthenticated callers. Operator listing is an `admin+` endpoint.

**§5.3 — Agent listing visibility.** `GET /agents?operator_id=...` MUST return empty results or 403 for callers who are neither the owning registrar nor admin+. Public per-agent resolution (`GET /agents/:id`) remains public per §1.3.

## §6 Rate limiting and abuse

**§6.1 — Minimum protections.** A conformant registry MUST rate-limit at least:

- Anonymous verification endpoints (GET `/verify`, GET `/agents/:id`, GET `/resolve/:did`): per source IP.
- Registration endpoints (POST `/register`): per registrar.
- Break-glass endpoints (POST `/admin/force-*`): per registrar, aggressively.

Specific limits are implementation-defined. The reference registry runs on Cloudflare Workers and inherits Cloudflare's DDoS protection, plus per-registrar quotas enforced at the D1 layer.

**§6.2 — Enumeration resistance.** Responses for "not found" and "not authorized" SHOULD be structured so callers cannot distinguish "operator does not exist" from "operator exists but you cannot see it," where the distinction would enable enumeration of an unlisted operator's identifiers. Where the response bodies differ, the difference MUST NOT constitute an enumeration oracle.

## §7 Availability

**§7.1 — Degraded-mode behavior.** A conformant registry SHOULD continue serving public resolve, verify, and revocation endpoints during partial outages of registrar-authenticated surfaces. Identity lookups are the load-bearing function; registration and administration can tolerate short interruptions.

**§7.2 — Uptime target.** Registries SHOULD publish an uptime target for public endpoints. The reference registry targets 99.9% for public endpoints and does not commit to an SLA for administrative endpoints.

**§7.3 — Revocation timeliness.** When an agent or delegation is revoked, revocation MUST be visible at the public `GET /revocation/:id` endpoint within 60 seconds. This is load-bearing for incident response.

## §8 Data handling

**§8.1 — PII classification.** The following fields are PII-adjacent and SHOULD be treated as such:

- Operator `email`
- Agent `display_name`, `description`
- IP addresses in audit log `ip_address`

Operator `domain`, `verification_tier`, `operator_id`, and agent `axis_id`, `did`, `public_key` are not treated as PII **provided identifiers are constructed per §8.1.1**.

**§8.1.1 — Public identifiers MUST NOT carry PII.** `operator_id`, `agent_id`, and any other identifier exposed in the public layer of the Registry Data Visibility Model MUST be opaque or derived from already-public information. Specifically:

- For domain-verified operators, deriving `operator_id` from the verified `domain` (e.g. `example-com`) is acceptable — the domain is already public.
- For email-tier operators, deriving `operator_id` from any part of the email address (local-part, normalized form, hash of the email) is NOT acceptable. The `operator_id` MUST be a random opaque slug. The reference registry uses `op-` plus 24 random hex characters (v0.2; was 12 in v0.1).
- Agent identifiers derived from deterministic hashes of the public key are acceptable (the public key is already in the public layer). Agent identifiers derived from human-readable fields (display_name, email) are NOT acceptable if those fields carry PII.

Registries with pre-existing rows carrying PII-derived identifiers MUST migrate those rows to opaque identifiers at the earliest maintenance window.

**§8.2 — Storage.** PII-adjacent fields SHOULD be stored in the same data store as the rest of the record when practical, and SHOULD NOT be exposed to public endpoints per §5.1.

**§8.3 — Deletion.** Because AXIS records are evidence (see §3 and the Act mapping in the EU AI Act Kit scoping document), operator and agent records MUST NOT be hard-deleted on request. Operators who wish to withdraw MUST be marked inactive; their records persist for audit continuity. Registrars SHOULD document this to their operators at signup.

**§8.4 — Breach notification.** Registries MUST notify affected registrars within 72 hours of confirming a breach of PII-adjacent fields they hold on behalf of those registrars.

## §9 Registrar key management

**§9.1 — Rotation.** Registrars MUST be able to rotate their API keys without downtime. The reference registry supports this by allowing multiple active keys per registrar during rotation windows.

**§9.2 — Revocation.** Compromised keys MUST be revocable within 5 minutes of the registry being notified. Revocation is immediate; no grace period.

**§9.3 — Admin and super-admin keys.** Registries SHOULD issue admin and super_admin keys only to named individual humans, not to services. Service accounts SHOULD hold `registrar` role only. This ensures break-glass calls (§3.2) always have a human accountable in the audit log.

**§9.4 — Storage.** Registries MUST store API keys as salted cryptographic hashes (the reference registry uses SHA-256). Plaintext key storage is non-conformant.

---

## §10 AIT verification semantics

AXIS Protocol v0.2 introduces two changes to the AXIS Identity Token (protocol §4.3): a REQUIRED `aud` claim and an OPTIONAL `dlg` claim. Registries that operate `/verify` endpoints — and any other AIT-consuming surface — MUST enforce the v0.2 semantics described here.

### §10.1 — `aud` claim enforcement

**§10.1.1.** A v0.2-conformant verifier MUST reject AITs that do not carry an `aud` claim. The rejection MUST surface as `valid: false` in the verification response, with `reason` indicating the missing or invalid audience (e.g. `missing_aud`, `aud_mismatch`).

**§10.1.2.** When the verifier is also a platform that publishes `/.well-known/axis-access` (see §14), the AIT's `aud` claim MUST match the value advertised in `audience`. Mismatches MUST be rejected the same way as a missing `aud`. This is the load-bearing requirement that closes the cross-platform AIT replay class: a token minted for platform A cannot be presented to platform B.

**§10.1.3.** Verifiers SHOULD NOT leak the platform's expected `audience` value in error responses. The reason code `aud_mismatch` (without the expected value echoed back) is sufficient diagnostic for clients; a caller debugging an AIT mint flow can read the well-known directly.

**§10.1.4.** v0.1-tolerance: a v0.2-conformant verifier MAY accept tokens without `aud` IF AND ONLY IF the verifier has explicit configuration permitting v0.1 tokens during a transition window. Production verifiers SHOULD set this to off; the default MUST be to reject. v0.2-conformant registries that operate `/verify` MUST default-reject.

### §10.2 — `dlg` claim and chain resolution

**§10.2.1.** When an AIT carries a `dlg` claim, the verifier MUST resolve the chain by calling `GET /delegations/:id` against the operator's registry (see protocol §6.9). The resolved chain provides the effective scope under which the agent is acting.

**§10.2.2.** Chain resolution MUST be bounded. Verifiers MUST cap chain depth at the registry's published limit (the reference registry uses 16; see protocol §4.4) and reject AITs whose chain resolves deeper.

**§10.2.3.** Verifiers MUST reject AITs whose `dlg` references a credential that does not resolve (HTTP 404 from the registry, revoked, or expired). The rejection reason SHOULD be `dlg_unresolvable` so platform operators can distinguish "agent had no delegation" (no `dlg` claim) from "agent claimed a delegation that doesn't exist" (`dlg` present but unresolvable).

**§10.2.4.** Verifiers MUST apply scope intersection across the resolved chain per §11. The effective scope is the intersection of every DC in the chain plus the issuing agent's native scope.

**§10.2.5.** When `dlg` is absent, verifiers MUST treat the agent as acting under its own native scope only. No implicit delegation chain may be inferred.

---

## §11 Delegation Credential scope grammar

AXIS Protocol v0.2 stabilizes the formal scope grammar for Delegation Credentials (protocol §4.4). Vocabulary remains platform-defined and deferred to v0.3; v0.2 normatives are about scope SHAPE and INTERSECTION semantics.

### §11.1 — Segment syntax

**§11.1.1.** A scope is a colon-separated sequence of one or more segments. Each segment MUST match `[a-zA-Z0-9_-]+`. The empty string is NOT a scope and MUST be rejected at mint and at verify.

**§11.1.2.** Wildcards: the literal segment `*` matches exactly one segment at the corresponding position. The wildcard `**` (multi-segment) is NOT permitted in v0.2 and MUST be rejected.

**§11.1.3.** Scopes are case-sensitive. `Comments.Post` and `comments.post` MUST be treated as distinct scopes.

**§11.1.4.** Maximum scope length: 256 characters (octets). Maximum segment count: 16. Implementations MAY enforce tighter limits. Registries that accept scope strings on mint (`POST /delegations`) MUST reject scopes exceeding these limits with HTTP 400 `invalid_scope`.

### §11.2 — Intersection across a chain

**§11.2.1.** When a chain resolves to N delegation credentials with scope sets S₁, S₂, ..., Sₙ, the effective scope is the intersection S₁ ∩ S₂ ∩ ... ∩ Sₙ. Verifiers MUST compute this intersection and reject any action whose required scope is not present in the result.

**§11.2.2.** Intersection MUST respect wildcards: `comments.*` ∩ `comments.post` = `comments.post`. `*.post` ∩ `comments.*` = `comments.post`. `comments.*` ∩ `email.*` = ∅ (empty).

**§11.2.3.** An empty intersection MUST cause AIT verification to fail with reason `scope_empty`.

### §11.3 — Mint-time validation

**§11.3.1.** Registries that accept scope strings on `POST /delegations` MUST validate each scope against §11.1 before persisting the credential. Invalid scopes MUST cause the call to fail with HTTP 400 `invalid_scope` and a `detail` field naming the first offending scope.

**§11.3.2.** Registries SHOULD perform monotonic-attenuation validation at mint time: every scope in the new delegation MUST be implied by the issuer's own scope (or, if the issuer is acting under a parent delegation, by that parent's effective scope). v0.2 makes this SHOULD; v0.3 will promote to MUST.

---

## §12 Agent Identity Record DID shape

AXIS Protocol v0.2 introduces operator-namespaced DIDs (protocol §4.1, §10.3) to close the DID name-squatting class. Registries MUST emit v0.2 DIDs for newly-registered agents and MUST resolve both v0.1 and v0.2 forms for existing agents during the transition window.

### §12.1 — DID shape

**§12.1.1.** The v0.2 canonical DID form is `did:axis:{registry}:{operator-slug}:{agent-slug}`. Four colon-delimited segments after the `did:axis:` prefix.

**§12.1.2.** `{registry}` MUST be the registry's canonical slug (the reference registry uses `prime`). `{operator-slug}` MUST be derived from the operator's verification proof per §12.2. `{agent-slug}` MUST be opaque or derived from the agent's public key per §8.1.1.

**§12.1.3.** Registries MUST return the v0.2 form in the `did` field of `GET /agents/:id` responses for newly-registered agents (post-v0.2 cutover).

**§12.1.4.** Registries SHOULD return both v0.1 and v0.2 forms for existing agents during the transition window, either as separate fields (`did` for v0.2, `did_v1` for legacy) or as an array. The exact shape is implementation-defined; the requirement is that v0.1-only consumers can still read the legacy form.

### §12.2 — Operator-slug derivation

**§12.2.1.** Operator slugs MUST be derived from the operator's verification proof, never caller-chosen. Caller-supplied slugs MUST be rejected at `POST /operators`. This is the load-bearing requirement that kills name squatting at the protocol level.

**§12.2.2.** Tier-driven derivation:

- **`domain` tier**: slug is the verified domain root with TLD stripped (e.g. `kipple-labs.com` → `kipple-labs`). Multi-label TLDs (`example.co.uk`) SHOULD use Public Suffix List (PSL) stripping; registries MAY fall back to dot-to-dash collapse during PSL rollout (`example.co.uk` → `example-co`) but MUST document the gap.
- **`email` tier**: slug is opaque, `op-` plus 24 random hex characters. See §8.1.1.
- **`kyb_individual` tier**: same as `email` tier — opaque random.
- **`kyb_organization` tier**: domain root if a verified domain is present, otherwise opaque random.

**§12.2.3.** Operator slugs are STABLE. A registry MUST NOT change an existing operator's slug except under a documented migration (e.g. v0.1 → v0.2 backfill, or PSL correction). Slug changes MUST be audited and SHOULD be announced to affected registrars.

### §12.3 — Cross-form resolution

**§12.3.1.** Registries MUST accept both v0.1 and v0.2 DID forms at `GET /resolve/:did` and `GET /agents/:did`. v0.2 takes precedence: if both forms could resolve to different records, the v0.2-form result MUST be returned.

**§12.3.2.** Resolution MUST be deterministic: the same DID input MUST always return the same agent record (or 404). Registries MUST NOT return different records based on caller, time of day, or any other dimension.

**§12.3.3.** Cross-form resolution MUST be observable to clients: a client that resolves the v0.1 form for an agent and the v0.2 form for the same agent MUST receive the same underlying agent record (same `axis_id`, same `public_key`, same `operator_id`).

### §12.4 — Identifier consistency across endpoints

**§12.4.1.** The `operator_id` value MUST be consistent across all endpoints that return it. `GET /agents/:id` returning `operator_id: "kipple-labs"` (bare slug) and `GET /verify` returning `operator_id: "axis:kipple-labs:operator"` (canonical) for the same underlying operator is non-conformant. Registries MUST settle on a single canonical form per response payload and MUST return that same form everywhere the field appears.

**§12.4.2.** The reference registry uses the canonical form `axis:<operator-slug>:operator` across all endpoints as of v0.2 (cross-endpoint drift fix landed in axis-registry PR #13). New registries SHOULD adopt the canonical form from the start.

---

## §13 Registration proof format

AXIS Protocol v0.2 adds the `proof.proofType` field on `POST /register` (protocol §6.1) to disambiguate proof-body canonicalization. The new value `"jcs-eddsa-2026"` selects RFC 8785 JCS canonicalization; absent `proofType` means the legacy v0.1 canonicalization.

### §13.1 — Proof types accepted

**§13.1.1.** A v0.2-conformant registry MUST accept `proofType: "jcs-eddsa-2026"` on `POST /register`. The signed body is the request body with the `proof` field removed, canonicalized per RFC 8785, with `proofValue` being the base64url Ed25519 signature over the canonical bytes.

**§13.1.2.** A v0.2-conformant registry MUST continue to accept registrations with `proofType` absent (legacy v0.1 form). Legacy canonicalization is deprecated in v0.2 and will be removed in v1.0.

**§13.1.3.** Registries SHOULD attempt JCS verification first when `proofType` is absent and fall back to legacy canonicalization only on JCS verification failure. This allows v0.2-compliant SDKs to omit `proofType` without breaking; it also lets registries observe migration progress by counting fall-back rates.

**§13.1.4.** Registries MUST reject unknown `proofType` values (anything other than `"jcs-eddsa-2026"` or absent) with HTTP 400 `invalid_proof_type`.

### §13.2 — Canonicalization invariants

**§13.2.1.** JCS canonicalization (RFC 8785) requires recursive sorting of object keys and specific number-formatting rules. Registries MUST implement RFC 8785 faithfully; the v0.1 fragility was caused by `JSON.stringify(body, Object.keys(body).sort())` only sorting the top level. Conformant JCS implementations MUST sort at every nesting level.

**§13.2.2.** The proof body MUST exclude the `proof` field itself. Including the `proof` field would create a self-referential signature.

**§13.2.3.** Signature: Ed25519 / EdDSA per RFC 8037. Public key is the agent's public key as supplied in the registration request (registry verifies the proof against this key, then persists both).

---

## §14 Access-policy advertisement

AXIS Protocol v0.2 adds a REQUIRED `audience` field to `/.well-known/axis-access` (protocol §6.12, §7) so AIT issuers can populate the `aud` claim on tokens intended for the platform.

### §14.1 — `audience` field

**§14.1.1.** Every platform that consumes AITs MUST publish `/.well-known/axis-access`. v0.2-conformant well-known documents MUST include an `audience` field at the top level.

**§14.1.2.** The `audience` value MUST be a non-empty string. The convention is subdomain-shaped (`<service>.<domain>`, e.g. `ghost.example.com`) but the format is not normative; any stable string works.

**§14.1.3.** `audience` MUST be stable across the platform's lifetime. Once published, the value MUST NOT change except under a documented platform-identity migration. Stability is load-bearing for issuers who cache AITs and present them later.

**§14.1.4.** Platforms with multiple instances or environments (e.g. `staging` vs `production`) MUST publish distinct `/.well-known/axis-access` documents with distinct `audience` values. Reusing one `audience` across staging and production defeats the cross-platform-replay defense.

### §14.2 — Document signing

**§14.2.1.** Well-known documents MAY be JWS-signed (detached JWS at the `signature` field, Ed25519 / EdDSA per RFC 8037). Signing is RECOMMENDED for platforms in the federation; consumers MAY require signatures.

**§14.2.2.** When signed, the `audience` field MUST be inside the signed envelope. Unsigned `audience` outside the envelope is non-conformant — it would allow attackers to substitute the audience after signing.

### §14.3 — Caching

**§14.3.1.** Registries and platforms SHOULD send appropriate `Cache-Control` headers on `/.well-known/axis-access` to enable client caching. Reasonable default: `max-age=300, public` (5 minutes). Issuers MAY cache longer at their discretion.

**§14.3.2.** Consumers fetching `/.well-known/axis-access` MUST honor standard HTTP cache semantics. They MUST NOT cache responses with status codes >= 400.

---

## §15 Conformance tests

**§15.1.** The reference conformance runner is published as the [`axis-conformance` npm package](https://www.npmjs.com/package/axis-conformance) and built from the [`axis-conformance` repo](https://github.com/MachinesOfDesire/axis-conformance). The runner probes a registry URL against this document and emits a pass/fail report. v0.2 runner advertises which spec version it tests in its CLI banner.

**§15.2.** Self-attestation: registries that wish to claim AXIS Registry Conformance v0.2 SHOULD run the reference runner against their deployment and publish the report. Where the runner returns `skip` (insufficient inputs to probe a requirement), the operator SHOULD attest separately to that requirement.

**§15.3 — Test categories covered by the runner:**

- Authentication (§1): public endpoints reachable without auth; mutating endpoints reject unauthenticated
- Authorization (§2): BOLA test matrix (Registrar A tries to touch Registrar B's resources across every mutating endpoint); `/admin/*` rejects `registrar` role
- Break-glass audit ordering (§3.2): reason required; audit row written before mutation
- Domain verification (§4): method validation; structural checks (DNS/HTTP probes deferred to operator)
- Tiered visibility (§5): public layer does not leak presentation fields; listing endpoints require auth
- Key management (§9): invalid keys rejected; wrong-form headers rejected
- AIT verification semantics (§10): probes that can be automated without minting test AITs
- DC scope grammar (§11): mint-time validation when a registrar key is available
- AIR DID shape (§12): inspects `did` field on a known agent; tests cross-form resolution
- Registration proof format (§13): probes that the registry accepts both proof types
- Access-policy advertisement (§14): `/.well-known/axis-access` includes a non-empty `audience`

**§15.4 — Manual-verification items.** Some requirements are inherently long-term or internal and cannot be automated by a single test run:

- §3.4 audit retention duration (12-month observation)
- §6 rate-limiting thresholds (dedicated load testing)
- §7 availability SLO (multi-week observation)
- §8 PII handling and breach notification (internal processes)
- §3.2 audit-before-mutation timing (requires registry instrumentation to verify ordering)
- §10 full AIT verification (requires minting test AITs with controlled `aud` and `dlg` — queued for the stable v0.2 runner)
- §11 chain-resolution and scope intersection (requires multi-credential test chains)
- §13 JCS proof verification (requires producing a JCS-canonicalized signed body)

Registries claiming v0.2 conformance MUST self-attest to the manual-verification items.

---

## Appendix A — Relationship to the protocol spec

The AXIS Protocol spec v0.2 defines:

- Record formats (operator, agent, delegation, AIT)
- Ed25519 signing semantics
- DID resolution (`did:axis:{registry}:{operator}:{agent}`)
- AIT structure (JWT with `typ: AIT`, `alg: EdDSA`, claims `iss/sub/aud/iat/exp/dlg/scope`)
- Delegation envelope format, attenuation rules, scope grammar
- RFC 8785 JCS canonicalization for proof bodies

The protocol spec does NOT define:

- How a registry authenticates its registrars
- How a registry stores records
- How a registry handles abuse, incidents, or outages
- How a registry evolves permissions over time
- How a verifier surfaces rejection reasons
- How a registry resolves both DID forms during the v0.1 → v0.2 transition

All of those belong to this document. A change to the wire format is a spec change (requires a protocol version bump). A change to "verifiers MUST reject tokens without `aud`" is an operational change that follows from the spec but is enforced here. Keeping them separate lets the wire stay stable while the operational rules evolve.

## Appendix B — Change log

- **v0.2, 2026-05-12** — Adds §10–§14 covering the six AXIS Protocol v0.2.0 normative changes (REQUIRED `aud`, optional `dlg`, formal DC scope grammar, operator-namespaced DIDs with cross-form tolerance, `jcs-eddsa-2026` proof type, REQUIRED `audience` in `/.well-known/axis-access`). §1–§9 unchanged from v0.1. §10 of v0.1 renumbered to §15 as the meta-conformance section.
- **v0.1, 2026-04-23** — Initial draft. Formalized the three-role authz model implemented in the reference registry on April 22–23, 2026, and the associated audit-before-mutation semantics for break-glass endpoints.
