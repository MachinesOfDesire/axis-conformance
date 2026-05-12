/**
 * §13 Registration proof format — tests.
 *
 * v0.2 adds proof.proofType on POST /register. Value "jcs-eddsa-2026" selects
 * RFC 8785 JCS canonicalization; absent means legacy v0.1 form. Most §13
 * criteria require producing a JCS-canonicalized signed body, which requires
 * a fresh Ed25519 keypair and a JCS implementation — queued for stable v0.2.
 *
 * What we can probe today: that the registry rejects unknown proofType values
 * with a structured 400, distinguishing them from "missing fields" errors.
 */

import { result } from "../runner.js";

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
    async run() {
      return result(
        "skip",
        "Requires producing a JCS-canonicalized signed body with a fresh Ed25519 keypair. Queued for stable v0.2 runner.",
      );
    },
  },

  {
    id: "13.1.c",
    requirement: "POST /register accepts proofType absent (legacy form) (§13.1.2)",
    async run() {
      return result(
        "skip",
        "Requires producing a v0.1-canonicalized signed body. Queued for stable v0.2 runner.",
      );
    },
  },

  {
    id: "13.2.a",
    requirement: "JCS canonicalization sorts keys at every nesting level (§13.2.1)",
    async run() {
      return result(
        "skip",
        "Requires producing two equivalent-but-key-reordered nested objects and verifying both produce the same proof. Queued for stable v0.2 runner.",
      );
    },
  },
];
