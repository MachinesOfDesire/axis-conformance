/**
 * §1 Authentication — tests.
 *
 * §1.1 Mutating requests require authentication.
 * §1.3 Public read endpoints are accessible without authentication.
 */

import { AxisClient } from "axis-protocol-sdk";
import { result } from "../runner.js";

export default [
  {
    id: "1.1.a",
    requirement: "POST /register without auth returns 401",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operator: { email: "a@b.com" }, publicKey: "x" }),
      });
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },

  {
    id: "1.1.b",
    requirement: "DELETE /agents/:id without auth returns 401",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/agents/nonexistent`, {
        method: "DELETE",
      });
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },

  {
    id: "1.1.c",
    requirement: "POST /delegations without auth returns 401",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/delegations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },

  {
    id: "1.3.a",
    requirement: "GET /.well-known/axis-access is publicly accessible",
    async run(ctx) {
      const client = new AxisClient({ registryUrl: ctx.registryUrl });
      try {
        const data = await client.getAccessPolicy();
        if (data && data.axis_version) return result("pass");
        return result("fail", "response missing axis_version");
      } catch (err) {
        return result("fail", `threw: ${err.message}`);
      }
    },
  },

  {
    id: "1.3.b",
    requirement: "GET /verify with a malformed token returns valid=false (not 401)",
    async run(ctx) {
      const client = new AxisClient({ registryUrl: ctx.registryUrl });
      const r = await client.verifyAIT("not-a-real-token.a.b");
      return r.valid === false
        ? result("pass")
        : result("fail", `expected valid=false, got ${JSON.stringify(r)}`);
    },
  },
];
