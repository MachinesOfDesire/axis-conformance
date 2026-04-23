/**
 * §5 Tiered visibility — tests.
 *
 * §5.1 Public vs presentation layer on operator/agent records.
 * §5.2 Operator listing is admin+.
 * §5.3 Agent listing by operator requires owner or admin+.
 */

import { result } from "../runner.js";

export default [
  {
    id: "5.1.a",
    requirement: "GET /operators/:id unauthenticated returns public layer only (no email, no verification_tier)",
    async run(ctx) {
      if (!ctx.knownOperatorId) {
        return result("skip", "Requires ctx.knownOperatorId (set via --known-operator-id)");
      }
      const resp = await fetch(`${ctx.registryUrl}/operators/${encodeURIComponent(ctx.knownOperatorId)}`);
      if (!resp.ok) return result("fail", `expected 200, got ${resp.status}`);
      const body = await resp.json();
      const leaked = [];
      if (body.email) leaked.push("email");
      if (body.verification_tier) leaked.push("verification_tier");
      if (body.domain && !body.public_key) leaked.push("domain");
      if (body.registered_at) leaked.push("registered_at");
      if (leaked.length === 0) return result("pass");
      return result("fail", `public layer leaked presentation fields: ${leaked.join(", ")}`);
    },
  },

  {
    id: "5.1.b",
    requirement: "GET /agents/:id unauthenticated returns public layer only (no display_name, no tier)",
    async run(ctx) {
      if (!ctx.knownAgentId) {
        return result("skip", "Requires ctx.knownAgentId");
      }
      const resp = await fetch(`${ctx.registryUrl}/agents/${encodeURIComponent(ctx.knownAgentId)}`);
      if (!resp.ok) return result("fail", `expected 200, got ${resp.status}`);
      const body = await resp.json();
      const leaked = [];
      if (body.display_name) leaked.push("display_name");
      if (body.operator_verification_tier) leaked.push("operator_verification_tier");
      if (body.registered_at) leaked.push("registered_at");
      if (body.description) leaked.push("description");
      if (leaked.length === 0) return result("pass");
      return result("fail", `public layer leaked presentation fields: ${leaked.join(", ")}`);
    },
  },

  {
    id: "5.2.a",
    requirement: "GET /admin/operators without auth returns 401",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/admin/operators`);
      return resp.status === 401
        ? result("pass")
        : result("fail", `expected 401, got ${resp.status}`);
    },
  },

  {
    id: "5.3.a",
    requirement: "GET /agents?operator_id= as registrar with non-owned operator returns 403",
    async run(ctx) {
      if (!ctx.apiKeyA) return result("skip", "Requires --registrar-key-a");
      // Use an operator id that almost certainly doesn't belong to apiKeyA.
      const resp = await fetch(
        `${ctx.registryUrl}/agents?operator_id=definitely-not-your-operator-${Date.now()}`,
        { headers: { Authorization: `Bearer ${ctx.apiKeyA}` } },
      );
      // 404 "operator not found" is an acceptable shape for a nonexistent id;
      // 403 "not_your_resource" is the other acceptable shape if the id happens
      // to exist under a different registrar. 200 would indicate a BOLA.
      if (resp.status === 403 || resp.status === 404) return result("pass");
      return result("fail", `expected 403 or 404, got ${resp.status}`);
    },
  },
];
