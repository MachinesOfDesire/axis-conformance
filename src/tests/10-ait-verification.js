/**
 * §10 AIT verification semantics — tests.
 *
 * v0.2 introduces a REQUIRED `aud` claim and an OPTIONAL `dlg` claim on AITs.
 * Most §10 conformance criteria require minting a properly-signed test AIT
 * (with a known agent's private key) and presenting it to /verify. That
 * machinery is not yet in the runner. The tests below cover what we can
 * probe without an AIT-mint helper, and flag the rest as skips for the
 * stable v0.2 runner.
 */

import { result } from "../runner.js";

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
    async run() {
      return result(
        "skip",
        "Requires minting a signed test AIT with controlled claims. Queued for the stable v0.2 runner; see §15.4 manual-verification list.",
      );
    },
  },

  {
    id: "10.1.d",
    requirement: "AIT with aud not matching platform's advertised audience is rejected (§10.1.2)",
    async run() {
      return result(
        "skip",
        "Requires minting a signed test AIT plus comparing against /.well-known/axis-access audience. Queued for stable v0.2 runner.",
      );
    },
  },

  {
    id: "10.2.a",
    requirement: "AIT with dlg pointing at nonexistent credential is rejected (§10.2.3)",
    async run() {
      return result(
        "skip",
        "Requires minting a signed test AIT with controlled dlg. Queued for stable v0.2 runner.",
      );
    },
  },

  {
    id: "10.2.b",
    requirement: "Chain resolution respects depth cap (§10.2.2)",
    async run() {
      return result(
        "skip",
        "Requires building a multi-credential chain. Queued for stable v0.2 runner.",
      );
    },
  },
];
