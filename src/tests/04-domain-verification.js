/**
 * §4 Domain verification — tests.
 *
 * Most §4 requirements involve DNS or HTTP lookups that conformance can't
 * easily automate without control of a real domain. We test what we can:
 * endpoint shape, method validation, token properties.
 */

import { result } from "../runner.js";

export default [
  {
    id: "4.1.a",
    requirement: "POST /operators/verify-domain accepts dns_txt method",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a");
      const resp = await fetch(`${ctx.registryUrl}/operators/verify-domain`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.apiKeyA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `conformance-${Date.now()}@example.invalid`,
          domain: `conformance-${Date.now()}.invalid`,
          method: "dns_txt",
        }),
      });
      // 200 or 403 (operator already exists / not yours) are acceptable shapes;
      // the key requirement is that the endpoint does NOT reject dns_txt as
      // an unknown method.
      if (resp.status === 400) {
        const body = await resp.json().catch(() => ({}));
        if (body?.error?.message?.includes("method")) {
          return result("fail", "rejected dns_txt as an invalid method");
        }
      }
      return result("pass");
    },
  },

  {
    id: "4.1.b",
    requirement: "POST /operators/verify-domain rejects unknown methods",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a");
      const resp = await fetch(`${ctx.registryUrl}/operators/verify-domain`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.apiKeyA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: `conformance-${Date.now()}@example.invalid`,
          domain: `conformance-${Date.now()}.invalid`,
          method: "carrier_pigeon",
        }),
      });
      if (resp.status === 400) return result("pass");
      return result("fail", `expected 400, got ${resp.status}`);
    },
  },

  {
    id: "4.5.a",
    requirement: "Initiating a domain claim does not bump tier (requires proof)",
    async run() {
      // This is a "structural" check; we cannot easily inspect tier state
      // without side effects. Flag as informational and recommend inspecting
      // D1 directly after a smoke test.
      return result(
        "skip",
        "Structural check: verify manually that /operators/verify-domain initiation leaves verification_tier unchanged (only /check should bump).",
      );
    },
  },
];
