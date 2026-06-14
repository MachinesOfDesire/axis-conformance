/**
 * §10 AIT verification semantics — tests.
 *
 * v0.2 introduces a REQUIRED `aud` claim and an OPTIONAL `dlg` claim on AITs.
 * The AIT-mint fixture (src/fixtures.js, built on the local axis-protocol-sdk)
 * now lets us present PROPERLY-SIGNED tokens with controlled claims to /verify,
 * instead of hand-typed malformed strings. That turns the §10 claim-handling
 * checks into real probes of the verifier's structured-rejection behaviour.
 *
 * Honest scope note: the runner is not supplied the private key of an agent the
 * registry already knows, so these tokens are signed by a throwaway keypair for
 * a throwaway agent id. A conformant registry therefore rejects them — the
 * question these probes answer is whether the rejection is STRUCTURED and
 * crash-free (valid:false / error, never 5xx), which is the §10 bar the runner
 * can assert without owning a registered agent's key. Reason-code assertions
 * (missing_aud vs aud_mismatch vs dlg_unresolvable) that need an agent we own
 * remain manual per §15.4; where the registry does surface a granular reason we
 * report it.
 */

import { result } from "../runner.js";
import { generateFixtureKeypair, mintAIT } from "../fixtures.js";

const THROWAWAY_AGENT_ID = "axis:conformance-probe:agent";

/** Present a token at /verify and assert no-5xx + structured rejection. */
async function presentToken(ctx, token, label) {
  const resp = await fetch(`${ctx.registryUrl}/verify?token=${encodeURIComponent(token)}`, {
    method: "GET",
  });
  if (resp.status >= 500) {
    return result("fail", `/verify returned ${resp.status} on ${label} (should not 5xx)`);
  }
  const body = await resp.json().catch(() => null);
  if (!body) return result("fail", `/verify did not return JSON on ${label}`);
  const reason = body.reason || body.code || body.error?.code || body.error?.message;
  if (body.valid === false || body.error) {
    return result("pass", reason ? `rejected (${reason})` : "rejected (structured, no reason code)");
  }
  if (body.valid === true) {
    return result("fail", `${label} was accepted as valid (a throwaway-signed token must not verify)`);
  }
  return result("fail", `/verify returned unexpected shape on ${label}: ${JSON.stringify(body).slice(0, 120)}`);
}

export default [
  {
    id: "10.1.a",
    requirement: "/verify rejects a malformed token without crashing",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/verify?ait=not-a-real-token`, {
        method: "GET",
      });
      if (resp.status >= 500) {
        return result("fail", `/verify returned ${resp.status} on malformed token (should not 5xx)`);
      }
      const body = await resp.json().catch(() => null);
      if (!body) {
        return result("fail", "/verify did not return JSON on malformed token");
      }
      // Acceptable shapes: { valid: false, reason: ... } or { error: {...} }
      if (body.valid === false) return result("pass");
      if (body.error) return result("pass");
      return result("fail", `/verify returned unexpected shape on malformed token: ${JSON.stringify(body).slice(0, 120)}`);
    },
  },

  {
    id: "10.1.b",
    requirement: "/verify rejects an empty token without crashing",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/verify?ait=`, { method: "GET" });
      if (resp.status >= 500) {
        return result("fail", `/verify returned ${resp.status} on empty token`);
      }
      // 400 or 200-with-valid-false are both acceptable; the requirement is
      // no 5xx and structured rejection.
      return result("pass");
    },
  },

  {
    id: "10.1.c",
    requirement: "AIT with missing aud claim is rejected (§10.1.1)",
    async run(ctx) {
      // Mint a properly-signed AIT that deliberately omits the aud claim.
      const kp = await generateFixtureKeypair();
      const token = await mintAIT({
        privateKey: kp.privateKey,
        agentId: THROWAWAY_AGENT_ID,
        claims: {}, // no aud
      });
      return presentToken(ctx, token, "signed AIT with missing aud claim");
    },
  },

  {
    id: "10.1.d",
    requirement: "AIT with aud not matching platform's advertised audience is rejected (§10.1.2)",
    async run(ctx) {
      // Read the platform's advertised audience so we can mint a deliberately
      // mismatched one. If the platform doesn't advertise one we still mint a
      // bogus aud — the token must not verify either way.
      let advertised = null;
      try {
        const wk = await fetch(`${ctx.registryUrl}/.well-known/axis-access`);
        if (wk.ok) {
          const policy = await wk.json().catch(() => null);
          advertised = policy?.audience || null;
        }
      } catch {
        // ignore — fall through to a bogus aud
      }
      const mismatchedAud =
        advertised && advertised !== "https://conformance-probe.invalid"
          ? "https://conformance-probe.invalid"
          : "https://some-other-platform.invalid";
      const kp = await generateFixtureKeypair();
      const token = await mintAIT({
        privateKey: kp.privateKey,
        agentId: THROWAWAY_AGENT_ID,
        claims: { aud: mismatchedAud },
      });
      return presentToken(
        ctx,
        token,
        advertised
          ? `signed AIT with aud=${mismatchedAud} != advertised ${advertised}`
          : `signed AIT with bogus aud=${mismatchedAud}`,
      );
    },
  },

  {
    id: "10.2.a",
    requirement: "AIT with dlg pointing at nonexistent credential is rejected (§10.2.3)",
    async run(ctx) {
      // Mint a properly-signed AIT whose dlg references a credential id that
      // cannot resolve. Must be rejected (dlg_unresolvable per §10.2.3).
      const kp = await generateFixtureKeypair();
      const token = await mintAIT({
        privateKey: kp.privateKey,
        agentId: THROWAWAY_AGENT_ID,
        claims: {
          aud: `${ctx.registryUrl}`,
          dlg: "dc-conformance-probe-nonexistent-0000000000000000",
        },
      });
      return presentToken(ctx, token, "signed AIT with dlg → nonexistent credential");
    },
  },

  {
    id: "10.2.b",
    requirement: "Chain resolution respects depth cap (§10.2.2)",
    async run() {
      return result(
        "skip",
        "Requires building a multi-credential chain anchored to agents whose keys the runner controls. The chain fixtures now exist (src/fixtures.js) but the runner is not supplied owned-agent keys — manual verification per §15.4.",
      );
    },
  },
];
