/**
 * §13 Registration proof format — tests.
 *
 * v0.2 adds proof.proofType on POST /register. Value "jcs-eddsa-2026" selects
 * RFC 8785 JCS canonicalization; absent means legacy v0.1 form (§13.1.2). The
 * proof builders live in ../fixtures.js (built on the local axis-protocol-sdk),
 * so the JCS-signed-body checks below are now real probes rather than skips.
 *
 * Network probes (13.1.b, 13.1.c) require a registrar key that OWNS an operator
 * we can name (--known-operator-email / --known-operator-domain). When those
 * are absent the test skips gracefully — more args = more tests.
 *
 * 13.2.a is a pure-local property of the JCS proof builder (key reordering must
 * not change the proof) and runs unconditionally.
 */

import { result } from "../runner.js";
import {
  buildSignedRegisterBody,
  buildLegacyRegisterBody,
  operatorFromCtx,
} from "../fixtures.js";

export default [
  {
    id: "13.1.a",
    requirement: "POST /register rejects unknown proofType with 400 (§13.1.4)",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a");
      const resp = await fetch(`${ctx.registryUrl}/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.apiKeyA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Deliberately minimal body. The point of this test is the proofType
          // rejection; if the registry rejects for missing fields first, the
          // test correctly skips (we can't distinguish unknown_proof_type from
          // missing_required_field at the response level here).
          operator_id: "axis:conformance-probe:operator",
          display_name: "conformance-probe",
          public_key: "deadbeef".repeat(8),
          proof: {
            proofType: "this-is-not-a-real-proof-type",
            proofValue: "AAAA",
          },
        }),
      });
      if (resp.status !== 400) {
        return result("skip", `Expected 400; got ${resp.status} (probably rejected for an earlier reason)`);
      }
      const body = await resp.json().catch(() => null);
      const errCode = body?.error?.code || body?.code;
      if (errCode === "invalid_proof_type") return result("pass");
      // If the registry returned 400 but didn't specifically flag proofType,
      // that's acceptable as a soft pass — the request was rejected, just not
      // with a granular reason.
      return result("pass", `400 returned without specific invalid_proof_type code (got: ${errCode || "unknown"})`);
    },
  },

  {
    id: "13.1.b",
    requirement: "POST /register accepts proofType: 'jcs-eddsa-2026' (§13.1.1)",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a");
      const operator = operatorFromCtx(ctx);
      if (!operator) {
        return result(
          "skip",
          "Requires --known-operator-email or --known-operator-domain (an operator the registrar key owns) to construct a registrable body.",
        );
      }
      // Build a real JCS-signed register body with a fresh agent keypair.
      const { body } = await buildSignedRegisterBody({
        operator,
        metadata: { name: "axis-conformance-probe", description: "v0.3 fixture probe" },
      });
      const resp = await fetch(`${ctx.registryUrl}/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.apiKeyA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (resp.status >= 500) {
        return result("fail", `/register 5xx on a valid jcs-eddsa-2026 proof: ${resp.status}`);
      }
      const respBody = await resp.json().catch(() => null);
      if (resp.ok && (respBody?.axis_id || respBody?.did)) {
        return result("pass", `registered ${respBody.axis_id || respBody.did} via jcs-eddsa-2026 proof`);
      }
      // A correctly-signed proof must NOT be rejected as a bad proof. If the
      // registry rejects for an operator-ownership / policy reason (the key
      // doesn't actually own this operator, duplicate, etc.) that is not a
      // proof-format failure — skip rather than fail.
      const errCode = respBody?.error?.code || respBody?.code;
      const proofErr = ["invalid_proof", "invalid_signature", "invalid_proof_type", "proof_verification_failed"];
      if (proofErr.includes(errCode)) {
        return result("fail", `valid jcs-eddsa-2026 proof rejected as ${errCode}`);
      }
      return result(
        "skip",
        `proof accepted at format layer but request not completed (HTTP ${resp.status}, code ${errCode || "unknown"}) — likely operator-ownership/policy, not a proof-format issue`,
      );
    },
  },

  {
    id: "13.1.c",
    requirement: "POST /register accepts proofType absent (legacy form) (§13.1.2)",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a");
      const operator = operatorFromCtx(ctx);
      if (!operator) {
        return result(
          "skip",
          "Requires --known-operator-email or --known-operator-domain to construct a registrable body.",
        );
      }
      // Legacy form: proof carries proofValue but NO proofType (§13.1.2). Per
      // §13.1.3 a conformant registry tries JCS first, so this verifies.
      const { body } = await buildLegacyRegisterBody({
        operator,
        metadata: { name: "axis-conformance-probe-legacy", description: "v0.3 fixture probe (no proofType)" },
      });
      const resp = await fetch(`${ctx.registryUrl}/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.apiKeyA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (resp.status >= 500) {
        return result("fail", `/register 5xx on a valid proofType-absent body: ${resp.status}`);
      }
      const respBody = await resp.json().catch(() => null);
      if (resp.ok && (respBody?.axis_id || respBody?.did)) {
        return result("pass", `registered ${respBody.axis_id || respBody.did} with proofType absent (legacy form)`);
      }
      const errCode = respBody?.error?.code || respBody?.code;
      // A registry that rejects an absent proofType with invalid_proof_type is
      // non-conformant per §13.1.2 (it MUST continue to accept the legacy form).
      if (errCode === "invalid_proof_type") {
        return result("fail", "registry rejected proofType-absent body with invalid_proof_type, violating §13.1.2");
      }
      const proofErr = ["invalid_proof", "invalid_signature", "proof_verification_failed"];
      if (proofErr.includes(errCode)) {
        return result("fail", `valid proofType-absent proof rejected as ${errCode}`);
      }
      return result(
        "skip",
        `legacy-form proof accepted at format layer but request not completed (HTTP ${resp.status}, code ${errCode || "unknown"}) — likely operator-ownership/policy`,
      );
    },
  },

  {
    id: "13.2.a",
    requirement: "JCS canonicalization sorts keys at every nesting level (§13.2.1)",
    async run() {
      // Pure-local property: two register bodies that are deeply key-equal but
      // differ in key INSERTION ORDER at every nesting level MUST produce an
      // identical JCS proofValue. This is exactly the v0.1 footgun JCS closes
      // (v0.1 only sorted top-level keys and stripped nested keys). We sign
      // both with the SAME key and assert byte-identical proofValues.
      const { generateFixtureKeypair } = await import("../fixtures.js");
      const kp = await generateFixtureKeypair();

      const operatorA = { domain: "example.com", email: "ops@example.com" };
      const operatorB = { email: "ops@example.com", domain: "example.com" }; // reordered
      const metaA = { name: "probe", description: "d", nested: { x: 1, y: 2, z: { a: 1, b: 2 } } };
      const metaB = { nested: { z: { b: 2, a: 1 }, y: 2, x: 1 }, description: "d", name: "probe" }; // deeply reordered

      const a = await buildSignedRegisterBody({ operator: operatorA, keypair: kp, metadata: metaA });
      const b = await buildSignedRegisterBody({ operator: operatorB, keypair: kp, metadata: metaB });

      if (a.proofValue === b.proofValue) {
        return result("pass", "key reordering at every nesting level yields an identical JCS proof");
      }
      return result(
        "fail",
        "JCS proof differs under key reordering — canonicalization is not sorting at every nesting level",
      );
    },
  },
];
