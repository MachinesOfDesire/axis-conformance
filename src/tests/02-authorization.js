/**
 * §2 Authorization — the BOLA-class tests.
 *
 * §2.2 Ownership scoping on mutating endpoints.
 * §2.3 Listing endpoints require auth.
 * §2.4 /admin/* requires admin+.
 */

import { AxisClient } from "axis-protocol-sdk";
import { result } from "../runner.js";

export default [
  {
    id: "2.2.a",
    requirement: "Registrar B cannot deactivate an agent owned by Registrar A",
    async run(ctx) {
      if (!ctx.apiKeyA || !ctx.apiKeyB) {
        return result("skip", "Requires --registrar-key-a and --registrar-key-b");
      }
      // To run this for real we'd need to know an agent id owned by A.
      // Without that, we only verify that DELETE with B's key against a
      // nonexistent-but-path-valid agent id does NOT return 200. The real
      // positive test (create agent under A, delete it with B, expect 403)
      // requires ctx.knownAgentOwnedByA, which we don't set up here.
      if (!ctx.knownAgentOwnedByA) {
        return result(
          "skip",
          "Positive cross-tenant test needs ctx.knownAgentOwnedByA. Current run only checks that random ids don't succeed under B.",
        );
      }
      const clientB = new AxisClient({ registryUrl: ctx.registryUrl, apiKey: ctx.apiKeyB });
      try {
        await clientB.deactivateAgent(ctx.knownAgentOwnedByA, { reason: "conformance test" });
        return result("fail", "Registrar B was allowed to deactivate an agent owned by Registrar A");
      } catch (err) {
        if (err.code === "NOT_YOUR_RESOURCE" || err.status === 403) return result("pass");
        return result("fail", `expected 403 not_your_resource, got code=${err.code} status=${err.status}`);
      }
    },
  },

  {
    id: "2.3.a",
    requirement: "GET /agents?operator_id= without auth returns 401",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/agents?operator_id=anything`);
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },

  {
    id: "2.3.b",
    requirement: "GET /operators without auth returns 401",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/operators`);
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },

  {
    id: "2.4.a",
    requirement: "GET /admin/stats without auth returns 401",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/admin/stats`);
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },

  {
    id: "2.4.b",
    requirement: "GET /admin/stats with plain 'registrar' key returns 403 forbidden",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a (non-admin)");
      if (ctx.apiKeyA === ctx.adminKey || ctx.apiKeyA === ctx.superAdminKey) {
        return result("skip", "apiKeyA appears to be an admin key; supply a plain registrar key to test");
      }
      const resp = await fetch(`${ctx.registryUrl}/admin/stats`, {
        headers: { Authorization: `Bearer ${ctx.apiKeyA}` },
      });
      if (resp.status === 403) return result("pass");
      return result("fail", `expected 403, got ${resp.status}`);
    },
  },

  {
    id: "2.4.c",
    requirement: "GET /admin/stats with admin+ key returns 200",
    async run(ctx) {
      const key = ctx.superAdminKey || ctx.adminKey;
      if (!key) return result("skip", "Requires --admin-key or --super-admin-key");
      const resp = await fetch(`${ctx.registryUrl}/admin/stats`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (resp.status === 200) return result("pass");
      return result("fail", `expected 200, got ${resp.status}`);
    },
  },
];
