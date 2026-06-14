/**
 * Signed-artifact fixtures for the v0.2/v0.3 conformance runner.
 *
 * These are the "AIT mint / signed delegation envelope / JCS registration
 * proof builder" the §10/§11/§13 skip messages referenced as "queued for the
 * stable v0.2 runner." They are now unblocked because the runner links the
 * local `axis-protocol-sdk` (file:../axis-protocol-sdk), whose v0.3 keystone
 * exports the signing primitives below.
 *
 * Everything here REUSES the SDK — we do not reimplement JCS canonicalization
 * or Ed25519 signing. The SDK is the single source of truth so the bytes we
 * sign match byte-for-byte what the registry recomputes when it verifies:
 *
 *   - signCanonical  → JCS-canonicalizes the register body (minus proof) and
 *                       signs it; the proofValue verifies against the registry's
 *                       verifyCanonicalProof (JCS-first per §13.1.3).
 *   - signDelegation → JCS-canonicalizes a DC document (minus proof) and signs
 *                       it, returning the DC with a Data-Integrity proof
 *                       envelope (§13.1.1 / protocol §4.4, §8).
 *   - signAIT        → produces a compact-JWT AIT (alg EdDSA, typ AIT) with
 *                       controlled claims (aud, dlg, ...).
 *   - jcsCanonicalize / importPublicKey / verifyAITLocally → used by the
 *                       self-test to prove the artifacts are VALID locally
 *                       before the parent session runs them against a live
 *                       registry.
 *
 * Design contract (matches the runner's "more args = more tests" rule):
 *   - These builders never touch the network. They only construct artifacts.
 *   - The tests that call them decide whether prerequisites (registrar key,
 *     known operator/agent identity) are present and SKIP gracefully if not.
 */

import {
  generateKeypair,
  signCanonical,
  signDelegation,
  signAIT,
  jcsCanonicalize,
  importPublicKey,
  b64urlDecode,
} from "axis-protocol-sdk";

/**
 * Generate a fresh Ed25519 keypair (registrar/operator/agent — caller decides
 * the role). Thin pass-through to the SDK so call sites read clearly.
 *
 * @returns {Promise<{publicKey, privateKey, publicKeyB64: string, privateKeyJwk: object}>}
 */
export async function generateFixtureKeypair() {
  return generateKeypair();
}

/**
 * Build a POST /register body carrying a JCS-canonicalized Ed25519 proof of
 * key ownership — the `proof: { proofType: 'jcs-eddsa-2026', proofValue }`
 * shape from §13.1.1. proofValue is signCanonical (JCS) over the register body
 * with the `proof` field absent.
 *
 * Mirrors AxisClient.createAgent's proof construction exactly, so a body built
 * here verifies on the registry's JCS path the same way the SDK's own
 * registrations do.
 *
 * @param {object} opts
 * @param {{email?: string, domain?: string}} opts.operator  Operator identity (one required).
 * @param {object} [opts.keypair]   Pre-generated keypair; one is minted if absent.
 * @param {object} [opts.metadata]  Optional agent metadata.
 * @param {object} [opts.service]   Optional service endpoint spec.
 * @returns {Promise<{body: object, keypair: object, proofValue: string}>}
 */
export async function buildSignedRegisterBody({ operator, keypair, metadata, service } = {}) {
  if (!operator || (!operator.email && !operator.domain)) {
    throw new Error("buildSignedRegisterBody: operator.email or operator.domain is required");
  }
  const kp = keypair || (await generateKeypair());
  // The signed body is the request body MINUS proof (§13.1.1).
  const proofBody = { operator, publicKey: kp.publicKeyB64 };
  if (metadata) proofBody.metadata = metadata;
  if (service) proofBody.service = service;
  const proofValue = await signCanonical(kp.privateKey, proofBody);
  const body = {
    ...proofBody,
    proof: { proofType: "jcs-eddsa-2026", proofValue },
  };
  return { body, keypair: kp, proofValue };
}

/**
 * Build a POST /register body whose proof OMITS proofType — the legacy v0.1
 * regime (§13.1.2). The proofValue itself is still produced by signCanonical,
 * which as of SDK v0.3 is JCS; per §13.1.3 a conformant registry tries JCS
 * first when proofType is absent, so this body verifies on a v0.2 registry
 * without advertising the proofType.
 *
 * @param {object} opts  Same shape as buildSignedRegisterBody.
 * @returns {Promise<{body: object, keypair: object, proofValue: string}>}
 */
export async function buildLegacyRegisterBody({ operator, keypair, metadata, service } = {}) {
  const { body, keypair: kp, proofValue } = await buildSignedRegisterBody({
    operator,
    keypair,
    metadata,
    service,
  });
  // Drop the proofType — keep proofValue. This is the "proofType absent" form.
  return {
    body: { ...body, proof: { proofValue } },
    keypair: kp,
    proofValue,
  };
}

/**
 * Mint a signed AIT with controlled claims (§10). Wraps SDK signAIT.
 *
 * @param {object} opts
 * @param {object|CryptoKey} opts.privateKey  Agent's Ed25519 private key (JWK or CryptoKey).
 * @param {string} opts.agentId               Full AXIS agent id (becomes iss + kid).
 * @param {number} [opts.ttl=300]             Lifetime in seconds.
 * @param {object} [opts.claims]              Extra claims to merge (aud, dlg, ...).
 * @returns {Promise<string>}                 Compact-JWT AIT.
 */
export async function mintAIT({ privateKey, agentId, ttl = 300, claims = {} }) {
  return signAIT({ privateKey, agentId, ttl, claims });
}

/**
 * Build a signed DelegationCredential (DC) envelope (§11 / protocol §4.4, §8)
 * via SDK signDelegation. The issuer signs the JCS canonicalization of the DC
 * document MINUS proof; the returned DC carries the Data-Integrity proof
 * envelope the registry's verifyDelegationProof recomputes.
 *
 * @param {object} opts
 * @param {object|CryptoKey} opts.issuerPrivateKey  Issuer's Ed25519 private key.
 * @param {string} opts.issued_by                   Full axis id of the issuer.
 * @param {string} opts.issued_to                   Full axis id of the recipient.
 * @param {string[]} opts.scope                      Scope token array (may be deliberately invalid for §11 probes).
 * @param {string} [opts.root_operator]              Chain root; defaults to issued_by (self-issued).
 * @param {string} [opts.expires]                    ISO-8601 expiry; defaults to +1h.
 * @param {object} [opts.constraints]                Optional constraints.
 * @param {string} [opts.parent_credential_id]       Optional parent for attenuation/chains.
 * @returns {Promise<object>}                         Signed DC document (with proof).
 */
export async function buildSignedDelegation({
  issuerPrivateKey,
  issued_by,
  issued_to,
  scope,
  root_operator,
  expires,
  constraints,
  parent_credential_id,
} = {}) {
  if (!issuerPrivateKey) throw new Error("buildSignedDelegation: issuerPrivateKey is required");
  if (!issued_by) throw new Error("buildSignedDelegation: issued_by is required");
  if (!issued_to) throw new Error("buildSignedDelegation: issued_to is required");
  const dc = {
    issued_by,
    issued_to,
    root_operator: root_operator || issued_by,
    scope,
    created: new Date().toISOString(),
    expires: expires || new Date(Date.now() + 3600_000).toISOString(),
  };
  if (constraints) dc.constraints = constraints;
  if (parent_credential_id) dc.parent_credential_id = parent_credential_id;
  return signDelegation(issuerPrivateKey, dc);
}

/**
 * Locally verify a signed DC's proofValue against the issuer's public key, the
 * same way a conformant registry's verifyDelegationProof does: strip `proof`,
 * JCS-canonicalize, Ed25519-verify. Used by the self-test to prove the
 * fixtures construct VALID artifacts (deliverable #3) without a network call.
 *
 * @param {object} signedDc                The output of buildSignedDelegation.
 * @param {string} issuerPublicKeyB64      Issuer's base64url raw public key.
 * @returns {Promise<boolean>}
 */
export async function verifyDelegationLocally(signedDc, issuerPublicKeyB64) {
  if (!signedDc || typeof signedDc !== "object" || !signedDc.proof) {
    throw new Error("verifyDelegationLocally: expected a signed DC with a proof field");
  }
  const { proof, ...doc } = signedDc;
  const canonical = jcsCanonicalize(doc);
  const key = await importPublicKey(issuerPublicKeyB64);
  const sig = b64urlDecode(proof.proofValue);
  return crypto.subtle.verify("Ed25519", key, sig, new TextEncoder().encode(canonical));
}

/**
 * Resolve an operator identity for the register fixtures from the runner
 * context. The register path needs an operator the registrar key owns; the
 * runner supplies it via --known-operator-email / --known-operator-domain.
 * Returns null when neither is present so callers can SKIP gracefully.
 *
 * @param {object} ctx
 * @returns {{email?: string, domain?: string}|null}
 */
export function operatorFromCtx(ctx) {
  if (ctx?.knownOperatorEmail) return { email: ctx.knownOperatorEmail };
  if (ctx?.knownOperatorDomain) return { domain: ctx.knownOperatorDomain };
  return null;
}
