/**
 * §9 Key management — tests.
 *
 * §9.2 Invalid or revoked keys are rejected.
 */

import { result } from "../runner.js";

export default [
  {
    id: "9.2.a",
    requirement: "Invalid Bearer key returns 401 on authenticated endpoints",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/admin/stats`, {
        headers: { Authorization: "Bearer definitely-not-a-real-key" },
      });
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },

  {
    id: "9.4.a",
    requirement: "Wrong-form Authorization header (no Bearer prefix) is rejected",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/admin/stats`, {
        headers: { Authorization: ctx.apiKeyA || "anything-without-bearer-prefix" },
      });
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },
];
