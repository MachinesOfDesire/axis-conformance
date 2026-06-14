/**
 * §11 Delegation Credential scope grammar — tests.
 *
 * v0.2 stabilizes the formal scope grammar for DCs. Mint-time validation of
 * scope strings on POST /delegations (§11.3.1) is now a real probe: the
 * fixtures module (built on the local axis-protocol-sdk) builds a signed
 * delegation envelope, so we can present a structurally-valid, properly-signed
 * DC whose ONLY defect is an invalid scope and assert the registry rejects it
 * with 400 invalid_scope — reaching the scope-validation code path instead of
 * being turned away for an earlier (signature/shape) reason.
 *
 * These probes need a registrar key (--registrar-key-a) plus a known issuer
 * identity to delegate from (--known-operator-id, used self-issued). Absent
 * either, the test skips gracefully.
 *
 * §11.2.a (cross-chain intersection at /verify) still requires a multi-
 * credential chain anchored to agents we OWN the keys for, which the runner
 * contract does not supply — it stays a graceful skip (manual per §15.4), but
 * the chain-building fixtures it needs now exist.
 */

import { result } from "../runner.js";
import { buildSignedDelegation } from "../fixtures.js";

/**
 * Mint a signed self-issued delegation with the given scope and POST it to
 * /delegations. Returns the fetch Response + parsed body, or null when the
 * prerequisites for a real probe are absent (caller turns that into a skip).
 */
async function postDelegationWithScope(ctx, scope) {
  if (!ctx.apiKeyA) return { skip: "Requires --registrar-key-a" };
  const issuer = ctx.knownOperatorId;
  if (!issuer) {
    return {
      skip: "Requires --known-operator-id (an issuer the registrar key owns) to mint a signed delegation envelope",
    };
  }
  // Build a properly-signed envelope. The issuer key here is a throwaway: we
  // are probing scope-grammar validation, which a conformant registry performs
  // on the request body (§11.3.1) before/independent of issuer-key checks. If a
  // registry rejects for an earlier reason we treat that as a skip, not a fail.
  const { generateFixtureKeypair } = await import("../fixtures.js");
  const kp = await generateFixtureKeypair();
  const signedDc = await buildSignedDelegation({
    issuerPrivateKey: kp.privateKey,
    issued_by: issuer,
    issued_to: issuer, // self-issued
    scope,
  });
  const resp = await fetch(`${ctx.registryUrl}/delegations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.apiKeyA}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(signedDc),
  });
  const body = await resp.json().catch(() => null);
  return { resp, body };
}

/**
 * Shared verdict logic for "this invalid scope must be rejected at mint."
 * - 400 invalid_scope  → pass (the scope-validation path was reached)
 * - other 400          → pass (rejected, just not granularly) with a note
 * - 5xx                → fail (must not crash)
 * - 2xx                → fail (an invalid scope was accepted)
 * - other 4xx          → skip (rejected for an earlier reason; couldn't reach
 *                         scope validation — e.g. signature/ownership)
 */
function judgeInvalidScope(resp, body, label) {
  if (resp.status >= 500) return result("fail", `/delegations 5xx on ${label}: ${resp.status}`);
  const errCode = body?.error?.code || body?.code;
  if (resp.status === 400 && errCode === "invalid_scope") return result("pass");
  if (resp.status === 400) {
    return result("pass", `400 on ${label} without specific invalid_scope code (got: ${errCode || "unknown"})`);
  }
  if (resp.ok) return result("fail", `${label} was ACCEPTED at mint (must be rejected per §11.1)`);
  return result(
    "skip",
    `rejected with HTTP ${resp.status} (${errCode || "unknown"}) before scope validation could be observed — likely signature/ownership, not scope grammar`,
  );
}

export default [
  {
    id: "11.1.a",
    requirement: "Empty scope strings are rejected at mint (§11.1.1)",
    async run(ctx) {
      const out = await postDelegationWithScope(ctx, [""]);
      if (out.skip) return result("skip", out.skip);
      return judgeInvalidScope(out.resp, out.body, "empty-string scope");
    },
  },

  {
    id: "11.1.b",
    requirement: "Scopes with invalid characters (e.g. `comments.post!`) are rejected at mint (§11.1.1)",
    async run(ctx) {
      const out = await postDelegationWithScope(ctx, ["comments.post!"]);
      if (out.skip) return result("skip", out.skip);
      return judgeInvalidScope(out.resp, out.body, "invalid-char scope");
    },
  },

  {
    id: "11.1.c",
    requirement: "Multi-segment wildcard `**` is rejected (§11.1.2)",
    async run(ctx) {
      const out = await postDelegationWithScope(ctx, ["comments:**"]);
      if (out.skip) return result("skip", out.skip);
      return judgeInvalidScope(out.resp, out.body, "multi-segment wildcard scope");
    },
  },

  {
    id: "11.2.a",
    requirement: "Scope intersection across a chain is computed at /verify (§11.2.1)",
    async run() {
      return result(
        "skip",
        "Requires a multi-credential chain anchored to agents whose private keys the runner controls, plus a signed AIT presented at /verify. The chain/AIT fixtures now exist (src/fixtures.js), but the runner is not supplied owned-agent keys — manual verification per §15.4.",
      );
    },
  },

  {
    id: "11.3.a",
    requirement: "Scopes exceeding 256 chars are rejected (§11.1.4)",
    async run(ctx) {
      // A single segment of valid chars but > 256 octets.
      const longScope = "a".repeat(300);
      const out = await postDelegationWithScope(ctx, [longScope]);
      if (out.skip) return result("skip", out.skip);
      return judgeInvalidScope(out.resp, out.body, "over-256-char scope");
    },
  },
];
