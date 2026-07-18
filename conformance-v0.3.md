# AXIS Registry Conformance v0.3

**Status:** Draft, 2026-07-18.
**Covers protocol version:** AXIS Protocol v0.3 (SPEC.md v0.3.1).
**Relationship to spec:** The AXIS Protocol spec defines what goes on the wire: record formats, resolution semantics, delegation envelopes, AIT format, and the v0.3 registry-legitimacy trust model. This document defines how a registry implementation MUST behave at runtime. The protocol spec is the data contract; this is the operational contract. A registry that calls itself AXIS-conformant satisfies both documents.
**Audience:** anyone implementing an AXIS-conformant registry. The reference implementation is [AXIS Prime](https://registry.axisprime.ai), built from [`axis-registry`](https://github.com/MachinesOfDesire/axis-registry). When a second registry appears, this is the document it conforms against.

The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in this document are to be interpreted as in [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) and [RFC 8174](https://datatracker.ietf.org/doc/html/rfc8174).

---

## What changed from v0.2

§1 through §15 carry forward from [Registry Conformance v0.2](./conformance-v0.2.md) unchanged, **except for the single amendment to §11.3.2 recorded below.** §16 through §19 are new operational requirements arising from the v0.3 protocol additions that are **implemented and serving** in the reference registry. §15 remains the meta-conformance section; its runner-coverage enumeration is extended to include the v0.3 sections.

AXIS Protocol v0.3 is *additive* over v0.2 and deliberately ships ahead of its own enforcement in several places — some v0.3 mechanisms are **specified now, enforced later**. This conformance document writes **automated MUST/SHOULD criteria only for the v0.3 mechanisms that are live and verifiable against a deployed registry via public reads.** The specified-but-not-yet-enforced mechanisms are listed under "Manual-verification / deferred" (§15.5); writing pass/fail criteria for them would penalize a registry that is honestly conformant with v0.3's own staged-rollout intent.

The v0.3 protocol additions covered by §16–§19 are:

| Protocol change | Conformance section |
|---|---|
| Registry-legitimacy artifacts — signed self-manifest `/.well-known/axis-registry` + signed root directory `/.well-known/axis-directory` (protocol §6.13, §6.15, §8 Step 1) | §16 |
| Standard scope-vocabulary discovery — `/.well-known/axis-scopes` (protocol §6.14, §4.4.1, Appendix B) | §17 |
| Versioned discovery — per-document `axis_version` self-declaration (protocol §4.3.2) | §18 |
| Chain-by-`dlg` resolution — `GET /delegations/:id/chain` (protocol §6.9.1, §4.3) | §19 |

A registry that meets v0.2 but does not yet serve §16–§19 is **v0.2-conformant** and is permitted to call itself "AXIS Registry Conformance v0.2." It is NOT permitted to claim v0.3 conformance. Per the protocol transition rules, v0.3-conformant registries continue to satisfy every v0.2 requirement (including v0.1-DID cross-form resolution).

### Amendment to carried-forward §11.3.2 (SHOULD → MUST)

[Registry Conformance v0.2 §11.3.2](./conformance-v0.2.md) required monotonic-attenuation validation at mint time as a **SHOULD**, and flagged that "v0.3 will promote to MUST." This document makes that promotion:

**§11.3.2 (v0.3).** Registries that accept scope strings on `POST /delegations` **MUST** perform monotonic-attenuation validation at mint time: every scope in the new delegation MUST be implied by the issuer's own scope (or, if the issuer is acting under a parent delegation, by that parent's effective scope). A delegation that attempts to broaden scope beyond the issuer's authority MUST be rejected with HTTP 400. This closes the privilege-escalation class at write time rather than relying solely on verify-time intersection (§11.2).

All other clauses of §11 are unchanged from v0.2.

---

## §1–§15 (carried forward from v0.2)

Sections §1 (Authentication), §2 (Authorization), §3 (Audit), §4 (Domain verification), §5 (Operator tier visibility), §6 (Rate limiting and abuse), §7 (Availability), §8 (Data handling), §9 (Registrar key management), §10 (AIT verification semantics), §11 (DC scope grammar — with the §11.3.2 amendment above), §12 (AIR DID shape), §13 (Registration proof format), §14 (Access-policy advertisement), and §15 (Conformance tests) are reproduced verbatim from [`conformance-v0.2.md`](./conformance-v0.2.md) and are not restated here. A v0.3-conformant registry MUST satisfy all of them.

The runner-coverage enumeration in §15.3 and the manual-verification list in §15.4 are extended by §15.5 below.

---

## §16 Registry-legitimacy artifacts

AXIS Protocol v0.3 introduces a CA-trust legitimacy model (protocol §6.13, §6.15, §8 Step 1). A registry publishes a **signed self-manifest** describing its own identity and signing keys, and a **signed root directory** listing the registries the root trusts. A verifier pins the root public key, reads the directory, and confirms that a registry's self-manifest key is among the fingerprints the directory certifies — establishing that a registry is a legitimate federation member before any identity it serves is trusted.

Both documents are public GETs with structured JSON bodies.

### §16.1 — Registry self-manifest

**§16.1.1.** A v0.3-conformant registry MUST serve `GET /.well-known/axis-registry` returning HTTP 200 with a JSON body.

**§16.1.2.** The self-manifest MUST declare `axis_version` (the protocol version it speaks; `"0.3"` for a v0.3 registry) and a non-empty `registry_id`.

**§16.1.3.** The self-manifest MUST carry a `keys[]` array of the registry's signing keys. Each entry MUST include a key id (`kid`), the public key (`public_key`), and the algorithm (`alg`). Entries SHOULD carry a `status` (`active` / retired) and validity window (`not_before` / `not_after`).

**§16.1.4.** The self-manifest MUST be signed. The signature (top-level `signature` field, Ed25519 / EdDSA per RFC 8037) covers the manifest so a consumer can detect tampering. The signing key MUST be the registry's own registry-signing key advertised in `keys[]`.

### §16.2 — Root directory

**§16.2.1.** A v0.3-conformant registry MUST serve `GET /.well-known/axis-directory` returning HTTP 200 with a JSON body.

**§16.2.2.** The root directory MUST declare `axis_version` and MUST carry a `registrars[]` array. Each entry MUST include a `registry_id` and a non-empty `key_fingerprints[]` array. Entries SHOULD carry a `status` (e.g. `certified`) and `certified_at`.

**§16.2.3.** The root directory MUST be signed by the root key (top-level `root_signature`, Ed25519 / EdDSA). Verifiers pin the root public key out of band and reject a directory whose `root_signature` does not verify against the pinned key.

### §16.3 — Legitimacy chain

**§16.3.1.** The self-manifest's active signing key MUST be certified by the root directory: the fingerprint of the registry's active `public_key` MUST appear in the `key_fingerprints[]` of that registry's `registrars[]` entry. This is the load-bearing link that lets a verifier walk from a pinned root to a specific registry's signing key. The reference registry fingerprints an Ed25519 key as the SHA-256 of the raw 32-byte public key; the fingerprint canonicalization is otherwise implementation-defined and MUST be documented by the registry.

**§16.3.2.** Fingerprints MUST be stable for the lifetime of the key. A key rotation MUST update both the self-manifest `keys[]` and the directory `key_fingerprints[]` so the chain stays intact across the rotation window.

---

## §17 Scope-vocabulary discovery

AXIS Protocol v0.3 publishes a **standard scope vocabulary** and a discovery manifest for it (protocol §6.14, §4.4.1, Appendix B). Scopes are two-layer: `namespace:action` (e.g. `content:read`, `commerce:purchase`, `data:export`). Vendor-specific extensions use an `x-<vendor>:` namespace prefix. Each published entry declares whether it belongs to the shared standard vocabulary and carries a human-readable description so operators and agents can reason about what a scope grants.

### §17.1 — Scopes manifest

**§17.1.1.** A v0.3-conformant registry MUST serve `GET /.well-known/axis-scopes` returning HTTP 200 with a JSON body.

**§17.1.2.** The manifest MUST declare `axis_version` and MUST carry a non-empty `scopes[]` array.

**§17.1.3.** Each entry in `scopes[]` MUST include `scope` (the string), `standard` (a boolean: `true` for entries from the shared vocabulary, `false` for platform/vendor extensions), and `description` (a non-empty human-readable string).

**§17.1.4.** Every scope marked `standard: true` MUST conform to the two-layer `namespace:action` grammar, where each layer matches `[a-z0-9-]+` and vendor namespaces carry the `x-<vendor>:` prefix. A standard scope that does not parse as `namespace:action` is non-conformant.

**§17.1.5.** The standard vocabulary MUST include the core `content` namespace (at minimum `content:comment`, the load-bearing engagement scope AXIS launched on). Registries MAY publish additional standard namespaces (the reference registry ships `social`, `commerce`, `data`, `comms`, `account`, `scheduling`, `compute`).

> **Enforcement note (deferred).** Publishing the vocabulary is a v0.3 requirement (above). *Enforcing* the vocabulary at delegation-mint time — rejecting a grammar-valid but non-standard, non-`x-`-prefixed scope on `POST /delegations` — is specified but staged for a later release and is NOT a v0.3 automated criterion. See §15.5.

---

## §18 Versioned discovery

AXIS Protocol v0.3 makes each discovery document **self-declare the protocol version it speaks** via a top-level `axis_version` field (protocol §4.3.2). A consumer negotiates capability by reading these fields rather than assuming a version, so the federation can carry mixed-version registries.

### §18.1 — Per-document version self-declaration

**§18.1.1.** Every discovery document a v0.3 registry serves — `/.well-known/axis-registry`, `/.well-known/axis-directory`, `/.well-known/axis-scopes`, and `/.well-known/axis-access` — MUST carry a top-level `axis_version` field whose value is a machine-readable version string of the form `MAJOR.MINOR`.

**§18.1.2.** The v0.3-introduced documents (self-manifest, root directory, scopes manifest) MUST declare `axis_version: "0.3"`.

**§18.1.3.** `/.well-known/axis-access` MUST carry an `axis_version` field so consumers can tell which protocol surface they are talking to. Its value tracks the version the platform serves (the reference registry-as-platform serves `"0.3"`).

### §18.2 — Supported-versions endpoint (optional in v0.3)

**§18.2.1.** The dedicated supported-versions endpoint `GET /.well-known/axis-versions` (protocol §6.16) is **OPTIONAL** in v0.3. A registry MAY omit it; when it is absent, version support MUST be inferable from the per-document `axis_version` fields (§18.1) and the registry's published change log. When a registry DOES serve it, the response MUST be JSON carrying a non-empty list of supported version strings. This endpoint becomes a SHOULD in a later release (see §15.5).

---

## §19 Delegation chain resolution by `dlg`

AXIS Protocol v0.3 pins AIT authorization to a delegation credential by id (protocol §6.9.1, §4.3): an AIT carries a `dlg` claim naming a Delegation Credential, and the verifier resolves the credential's chain via `GET /delegations/:id/chain`. The chain's effective scope (the intersection walked per §11.2) is what authorizes the agent's action.

### §19.1 — Chain endpoint

**§19.1.1.** A v0.3-conformant registry MUST route `GET /delegations/:id/chain`. A request for a non-existent credential MUST return a resource-level 404 (a structured error such as `delegation_not_found`), distinguishable from the router's "no route" 404 — i.e. the endpoint exists and executed.

**§19.1.2.** For a resolvable delegation id, `GET /delegations/:id/chain` MUST return HTTP 200 with a chain verdict: the resolved chain (an ordered list of the credentials from the named DC to its root operator) and/or the effective scope and/or a boolean validity verdict. The verdict MUST be deterministic for a given credential id (same input → same verdict, modulo revocation/expiry state changes).

**§19.1.3.** A chain that resolves deeper than the registry's published depth limit (the reference registry uses 16; protocol §4.4), or that references a revoked or expired credential, MUST surface as a non-authorizing verdict, not a 5xx. Verify-time enforcement of the effective scope is covered by the carried-forward §10.2 and §11.2.

---

## §15.5 — Manual-verification / deferred items (v0.3)

The following v0.3 mechanisms are **specified in the protocol but not yet enforced/served** in the reference stack, matching the protocol's own staged-rollout status (see `axis-protocol` `docs/IMPLEMENTATION-STATUS.md`). This document does **not** define automated pass/fail criteria for them, because a registry that is honestly v0.3-conformant with the staged rollout would fail such probes. A registry claiming v0.3 conformance self-attests to its position on each of these as it ships:

- **Mint-time scope-vocabulary enforcement (protocol §4.4.1).** The standard vocabulary is *published* (§17, automated) but not *enforced* at `POST /delegations`; a grammar-valid non-standard scope is accepted today. Enforcement is tracked for a later release.
- **Sender-constrained AITs — `cnf.jkt` proof-of-possession + DPoP + the RFC 9421 message-signature profile + `proof_of_possession: "required"` advertisement (protocol §4.3.1, §7, §8).** Specified; enforcement not shipped. Today's `/verify` and `/.well-known/axis-access` present the v0.2 bearer surface; a v0.3 `cnf` AIT degrades to a bearer token at current verifiers.
- **Ephemeral within-runtime sub-agent delegates — `issued_to_public_key`, `task_spec_hash` (protocol §4.4.2, §8 Step 3).** Inline-only by design (never registry-served); the reference platform's verification path exists but is not enabled by default.
- **AIT `axis_version` claim (protocol §4.3.2).** No shipped issuer emits it and no shipped verifier checks it; becomes a SHOULD-emit in a later release. (Note: this is the *AIT* version claim, distinct from the *discovery-document* `axis_version` fields, which ARE required and covered by §18.)
- **`GET /.well-known/axis-versions` supported-versions endpoint (protocol §6.16).** OPTIONAL in v0.3 (§18.2); becomes a SHOULD in a later release. Until it ships, version support is inferred from the per-document `axis_version` fields.

These items are the v0.3 analogue of the v0.2 §15.4 manual-verification list and are additive to it.

---

## Appendix A — Relationship to the protocol spec

The division of labor is unchanged from v0.2: the AXIS Protocol spec defines the wire format (record formats, signing semantics, DID resolution, AIT structure, delegation envelopes, the registry-legitimacy artifact schemas, the standard scope vocabulary); this document defines the registry's runtime behavior (which endpoints MUST be served, what shape they MUST return, which links MUST hold). A change to a wire format is a spec change (protocol version bump); a change to "the self-manifest MUST be signed by a key the root directory certifies" is an operational rule that follows from the spec and is enforced here.

The protocol spec's inline status paragraphs are authoritative on what is enforced-now versus specified-later; this document's §15.5 is a convenience index over them scoped to conformance.

## Appendix B — Change log

- **v0.3, 2026-07-18** — Adds §16–§19 covering the v0.3 protocol additions that are live on the reference registry (signed registry-legitimacy self-manifest + root directory; standard scope-vocabulary discovery manifest; per-document `axis_version` self-declaration; chain-by-`dlg` resolution). Promotes carried-forward §11.3.2 monotonic-attenuation validation from SHOULD to MUST. §1–§10, §12–§15 unchanged from v0.2. Records the specified-but-not-yet-enforced v0.3 mechanisms (sender-constrained AITs / DPoP, ephemeral delegates, mint-time vocabulary enforcement, AIT `axis_version` claim, `/.well-known/axis-versions`) as manual-verification / deferred items (§15.5) rather than automated criteria.
- **v0.2, 2026-05-12** — Added §10–§14 for the six AXIS Protocol v0.2.0 normative changes. §1–§9 unchanged from v0.1. §10 of v0.1 renumbered to §15.
- **v0.1, 2026-04-23** — Initial draft. Formalized the three-role authz model and audit-before-mutation semantics for break-glass endpoints.
