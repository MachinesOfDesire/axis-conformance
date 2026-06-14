/**
 * Self-test for the signed-artifact fixtures (src/fixtures.js).
 *
 * Network-free. Proves the fixtures construct VALID artifacts — i.e. that what
 * we will present to a live registry actually re-verifies locally against the
 * signing key, using the SAME SDK primitives the registry uses. If these pass,
 * a rejection from a live registry is about registry behaviour, not a broken
 * fixture.
 *
 * Exits 0 on success, non-zero on any failure (node --test convention).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  importPublicKey,
  jcsCanonicalize,
  verifyAITLocally,
  b64urlDecode,
} from "axis-protocol-sdk";
import {
  generateFixtureKeypair,
  buildSignedRegisterBody,
  buildLegacyRegisterBody,
  mintAIT,
  buildSignedDelegation,
  verifyDelegationLocally,
  operatorFromCtx,
} from "./fixtures.js";

test("generateFixtureKeypair returns a usable Ed25519 keypair", async () => {
  const kp = await generateFixtureKeypair();
  assert.ok(kp.publicKey && kp.privateKey, "must expose CryptoKey handles");
  assert.equal(typeof kp.publicKeyB64, "string");
  assert.equal(b64urlDecode(kp.publicKeyB64).length, 32, "public key must be 32 raw bytes");
});

test("buildSignedRegisterBody: proof verifies over the JCS body minus proof", async () => {
  const { body, keypair } = await buildSignedRegisterBody({
    operator: { email: "ops@example.com" },
    metadata: { name: "probe", description: "d" },
  });
  assert.equal(body.proof.proofType, "jcs-eddsa-2026");
  const { proof, ...signedPortion } = body;
  const canonical = jcsCanonicalize(signedPortion);
  const key = await importPublicKey(keypair.publicKeyB64);
  const ok = await crypto.subtle.verify(
    "Ed25519",
    key,
    b64urlDecode(proof.proofValue),
    new TextEncoder().encode(canonical),
  );
  assert.ok(ok, "registration proofValue must verify over JCS(body − proof)");
});

test("buildLegacyRegisterBody: proofType absent, proofValue still verifies (JCS-first)", async () => {
  const { body, keypair } = await buildLegacyRegisterBody({
    operator: { domain: "example.com" },
  });
  assert.ok(!("proofType" in body.proof), "legacy form must omit proofType");
  assert.equal(typeof body.proof.proofValue, "string");
  const { proof, ...signedPortion } = body;
  const canonical = jcsCanonicalize(signedPortion);
  const key = await importPublicKey(keypair.publicKeyB64);
  const ok = await crypto.subtle.verify(
    "Ed25519",
    key,
    b64urlDecode(proof.proofValue),
    new TextEncoder().encode(canonical),
  );
  assert.ok(ok, "legacy-form proofValue must verify over JCS(body − proof)");
});

test("JCS proof is invariant under deep key reordering (the §13.2.1 property)", async () => {
  const kp = await generateFixtureKeypair();
  const a = await buildSignedRegisterBody({
    operator: { domain: "example.com", email: "ops@example.com" },
    keypair: kp,
    metadata: { name: "p", nested: { x: 1, y: 2, z: { a: 1, b: 2 } } },
  });
  const b = await buildSignedRegisterBody({
    operator: { email: "ops@example.com", domain: "example.com" },
    keypair: kp,
    metadata: { nested: { z: { b: 2, a: 1 }, y: 2, x: 1 }, name: "p" },
  });
  assert.equal(a.proofValue, b.proofValue, "reordered-but-equal bodies must yield identical proofs");
});

test("mintAIT produces a token that re-verifies locally against the signing key", async () => {
  const kp = await generateFixtureKeypair();
  const token = await mintAIT({
    privateKey: kp.privateKey,
    agentId: "axis:probe:agent",
    claims: { aud: "https://example.com" },
  });
  const res = await verifyAITLocally(token, kp.publicKeyB64, { audience: "https://example.com" });
  assert.equal(res.valid, true, "minted AIT must verify against its own public key");
  assert.equal(res.payload.aud, "https://example.com");
  assert.equal(res.header.typ, "AIT");
});

test("mintAIT can omit aud (for the §10.1.1 missing-aud probe)", async () => {
  const kp = await generateFixtureKeypair();
  const token = await mintAIT({ privateKey: kp.privateKey, agentId: "axis:probe:agent" });
  // Verifies as a signature, but carries no aud claim — exactly the probe input.
  const res = await verifyAITLocally(token, kp.publicKeyB64);
  assert.equal(res.valid, true);
  assert.equal(res.payload.aud, undefined, "missing-aud probe token must carry no aud");
});

test("buildSignedDelegation: envelope re-verifies locally over JCS(dc − proof)", async () => {
  const kp = await generateFixtureKeypair();
  const signedDc = await buildSignedDelegation({
    issuerPrivateKey: kp.privateKey,
    issued_by: "axis:probe:operator",
    issued_to: "axis:probe:operator",
    scope: ["comments.post", "comments.read"],
  });
  assert.ok(signedDc.proof, "signed DC must carry a proof envelope");
  assert.equal(signedDc.proof.proofType, "jcs-eddsa-2026");
  const ok = await verifyDelegationLocally(signedDc, kp.publicKeyB64);
  assert.ok(ok, "delegation proofValue must verify over JCS(dc − proof)");
});

test("buildSignedDelegation tolerates deliberately-invalid scopes (for §11 mint probes)", async () => {
  const kp = await generateFixtureKeypair();
  // The fixture must SIGN whatever scope it's given — invalidity is the
  // registry's job to reject; the envelope itself must still be well-formed.
  const signedDc = await buildSignedDelegation({
    issuerPrivateKey: kp.privateKey,
    issued_by: "axis:probe:operator",
    issued_to: "axis:probe:operator",
    scope: ["comments.post!"],
  });
  const ok = await verifyDelegationLocally(signedDc, kp.publicKeyB64);
  assert.ok(ok, "an invalid-scope envelope must still be a validly-signed envelope");
});

test("operatorFromCtx prefers email, falls back to domain, else null", () => {
  assert.deepEqual(operatorFromCtx({ knownOperatorEmail: "a@b.com" }), { email: "a@b.com" });
  assert.deepEqual(operatorFromCtx({ knownOperatorDomain: "b.com" }), { domain: "b.com" });
  assert.equal(operatorFromCtx({}), null);
  assert.equal(operatorFromCtx(undefined), null);
});
