# AXIS Registry Conformance v0.1

**Status:** Draft, April 23, 2026.
**Relationship to spec:** The AXIS Protocol spec v0.1 defines what goes on the wire: record formats, resolution semantics, delegation envelopes, AIT format. This document defines how a registry implementation MUST behave at runtime. Protocol v0.1 is the data contract; this is the operational contract.
**Audience:** anyone implementing an AXIS-conformant registry. When Kipple Labs is the only registry, this document is internal. When a second registry appears, this is the document it conforms against.

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as in RFC 2119.

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
- For email-tier operators, deriving `operator_id` from any part of the email address (local-part, normalized form, hash of the email) is NOT acceptable. The `operator_id` MUST be a random opaque slug. The reference registry uses `op-` plus 12 random hex characters.
- Agent identifiers derived from deterministic hashes of the public key are acceptable (the public key is already in the public layer). Agent identifiers derived from human-readable fields (display_name, email) are NOT acceptable if those fields carry PII.

Registries with pre-existing rows carrying PII-derived identifiers MUST migrate those rows to opaque identifiers at the earliest maintenance window.

**§8.2 — Storage.** PII-adjacent fields SHOULD be stored in the same data store as the rest of the record when practical, and SHOULD NOT be exposed to public endpoints per §5.1.

**§8.3 — Deletion.** Because AXIS records are evidence (see Registry Conformance §3 and the Act mapping in the EU AI Act Kit scoping document), operator and agent records MUST NOT be hard-deleted on request. Operators who wish to withdraw MUST be marked inactive; their records persist for audit continuity. Registrars SHOULD document this to their operators at signup.

**§8.4 — Breach notification.** Registries MUST notify affected registrars within 72 hours of confirming a breach of PII-adjacent fields they hold on behalf of those registrars.

## §9 Registrar key management

**§9.1 — Rotation.** Registrars MUST be able to rotate their API keys without downtime. The reference registry supports this by allowing multiple active keys per registrar during rotation windows.

**§9.2 — Revocation.** Compromised keys MUST be revocable within 5 minutes of the registry being notified. Revocation is immediate; no grace period.

**§9.3 — Admin and super-admin keys.** Registries SHOULD issue admin and super_admin keys only to named individual humans, not to services. Service accounts SHOULD hold `registrar` role only. This ensures break-glass calls (§3.2) always have a human accountable in the audit log.

**§9.4 — Storage.** Registries MUST store API keys as salted cryptographic hashes (the reference registry uses SHA-256). Plaintext key storage is non-conformant.

## §10 Conformance tests

**§10.1.** This section will be filled out when a conformance test suite exists. At v0.1, a registry operator self-attests that their implementation meets the requirements above.

**§10.2.** The reference registry implementation is at [github.com/MachinesOfDesire/axis-registry](https://github.com/MachinesOfDesire/axis-registry) (when published). Its test suite covers §1 authentication, §2.2 ownership scoping, §2.4 admin role gating, §3.2 break-glass audit ordering, and §4 domain verification happy paths. A future conformance suite will be derived from these tests plus additions.

**§10.3 — Test categories to develop:**

- Authentication: public endpoints reachable without auth; mutating endpoints reject unauthenticated
- Authorization: BOLA test matrix (Registrar A tries to touch Registrar B's resources across every mutating endpoint)
- Admin role gating: `/admin/*` rejects `registrar` role
- Break-glass: reason required, audit-before-mutation, audit-write-failure aborts mutation
- Domain verification: DNS TXT happy path, HTTP file happy path, token expiry, tier-bump-only-on-proof
- Audit: records produced for all mutations, admin role reads cross-tenant, registrar role reads scoped
- Retention: records older than 12 months still readable

---

## Appendix A — Relationship to the protocol spec

The protocol spec v0.1 defines:

- Record formats (operator, agent, delegation, AIT)
- Ed25519 signing semantics
- DID resolution (`did:axis:prime:<slug>`)
- AIT structure (JWT with `typ: AIT`, `alg: EdDSA`)
- Delegation envelope format and attenuation rules

The protocol spec does not define:

- How a registry authenticates its registrars
- How a registry stores records
- How a registry handles abuse, incidents, or outages
- How a registry evolves permissions over time

All of those belong to this document. A change to the wire format is a spec change (requires a spec version bump). A change to "admin role grants cross-tenant mutation" is a conformance change (requires a conformance version bump). Keeping them separate lets the wire stay stable while the operational rules evolve.

## Appendix B — Change log

- **v0.1, April 23, 2026** — Initial draft. Formalizes the three-role authz model implemented in the reference registry on April 22–23, 2026, and the associated audit-before-mutation semantics for break-glass endpoints.
