/**
 * §3 Audit — tests.
 *
 * §3.2 Break-glass endpoints require non-empty reason.
 * §3.2 Break-glass audit row is written BEFORE the mutation.
 * §3.5 Audit records readable by admin+.
 */

import { result } from "../runner.js";

export default [
  {
    id: "3.2.a",
    requirement: "POST /admin/force-deactivate-agent/:id without reason returns 400",
    async run(ctx) {
      const key = ctx.superAdminKey;
      if (!key) return result("skip", "Requires --super-admin-key");
      const resp = await fetch(`${ctx.registryUrl}/admin/force-deactivate-agent/any-id`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (resp.status === 400) return result("pass");
      return result("fail", `expected 400, got ${resp.status}`);
    },
  },

  {
    id: "3.2.b",
    requirement: "POST /admin/force-deactivate-agent/:id with empty reason returns 400",
    async run(ctx) {
      const key = ctx.superAdminKey;
      if (!key) return result("skip", "Requires --super-admin-key");
      const resp = await fetch(`${ctx.registryUrl}/admin/force-deactivate-agent/any-id`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "   " }),
      });
      if (resp.status === 400) return result("pass");
      return result("fail", `expected 400, got ${resp.status}`);
    },
  },

  {
    id: "3.2.c",
    requirement: "POST /admin/force-* with non-super_admin key returns 403",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a (non-super-admin)");
      if (ctx.apiKeyA === ctx.superAdminKey) return result("skip", "apiKeyA is super_admin; need a plain key");
      const resp = await fetch(`${ctx.registryUrl}/admin/force-deactivate-agent/any-id`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ctx.apiKeyA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "test" }),
      });
      if (resp.status === 403) return result("pass");
      return result("fail", `expected 403, got ${resp.status}`);
    },
  },

  {
    id: "3.5.a",
    requirement: "GET /admin/audit is readable by admin+",
    async run(ctx) {
      const key = ctx.superAdminKey || ctx.adminKey;
      if (!key) return result("skip", "Requires --admin-key or --super-admin-key");
      const resp = await fetch(`${ctx.registryUrl}/admin/audit?limit=1`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (resp.status === 200) return result("pass");
      return result("fail", `expected 200, got ${resp.status}`);
    },
  },

  {
    id: "3.5.b",
    requirement: "GET /audit (self-scoped) is readable by any valid registrar",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a");
      const resp = await fetch(`${ctx.registryUrl}/audit?limit=1`, {
        headers: { Authorization: `Bearer ${ctx.apiKeyA}` },
      });
      if (resp.status === 200) {
        const body = await resp.json();
        if (!Array.isArray(body.logs)) return result("fail", "response missing logs array");
        return result("pass");
      }
      // 404 is acceptable if the registry has not implemented the self-scoped
      // audit endpoint yet; note that the conformance doc treats it as
      // RECOMMENDED not MUST.
      if (resp.status === 404) return result("skip", "Self-scoped /audit endpoint not implemented (optional)");
      return result("fail", `expected 200 or 404, got ${resp.status}`);
    },
  },
];
