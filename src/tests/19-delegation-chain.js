/**
 * §19 Delegation chain resolution by `dlg` — tests.
 *
 * AXIS Protocol v0.3 pins AIT authorization to a delegation credential by id:
 * an AIT carries a `dlg` claim and the verifier resolves the chain via
 * `GET /delegations/:id/chain` (protocol §6.9.1, §4.3), whose effective scope
 * authorizes the action.
 *
 * This section is deliberately defensive. The chain endpoint's existence is
 * probed with a bogus id (a routed endpoint returns a resource-level 404, not
 * the router's "no route" 404). The full verdict probe requires a real
 * delegation id and SKIPs unless `--known-delegation-id` is supplied — the
 * runner never mints or mutates state to satisfy it.
 */

import { result } from "../runner.js";

export default [
  {
    id: "19.1.a",
    requirement: "GET /delegations/:id/chain is a routed endpoint (§19.1.1)",
    async run(ctx) {
      const bogus = "conformance-probe-nonexistent-000";
      const resp = await fetch(`${ctx.registryUrl}/delegations/${bogus}/chain`);
      // A routed handler that ran and could not find the resource returns a
      // resource-level 404 (e.g. delegation_not_found / agent_not_found). An
      // UNrouted path returns the router's catch-all ("No route matches...").
      if (resp.status === 200) {
        return result("pass", "chain endpoint routed (unexpected 200 for a bogus id, but the route exists)");
      }
      const body = await resp.json().catch(() => null);
      if (resp.status === 404) {
        const code = body?.error?.code ?? body?.code;
        const message = body?.error?.message ?? body?.message ?? "";
        const isRouteMiss = code === "not_found" || /no route/i.test(String(message));
        if (isRouteMiss) {
          return result("fail", `chain endpoint appears unrouted: ${code} "${message}"`);
        }
        return result("pass", `chain endpoint routed (resource 404: ${code || "n/a"})`);
      }
      if (resp.status === 400) {
        return result("pass", `chain endpoint routed (rejected bogus id with 400)`);
      }
      return result("skip", `chain endpoint returned ${resp.status} for a bogus id; cannot classify`);
    },
  },

  {
    id: "19.1.b",
    requirement: "GET /delegations/:id/chain returns a chain verdict for a known credential (§19.1.2)",
    async run(ctx) {
      const dlg = ctx.knownDelegationId;
      if (!dlg) return result("skip", "Requires --known-delegation-id");
      const resp = await fetch(`${ctx.registryUrl}/delegations/${encodeURIComponent(dlg)}/chain`);
      if (resp.status === 404) {
        return result("fail", `known delegation ${dlg} did not resolve a chain (404)`);
      }
      if (resp.status !== 200) {
        return result("fail", `expected 200 for known delegation ${dlg}, got ${resp.status}`);
      }
      const body = await resp.json().catch(() => null);
      if (!body) return result("fail", "chain response is not JSON");
      // Accept any of the shapes a chain verdict may take: an explicit chain
      // array, an effective-scope result, or a boolean validity verdict.
      const hasVerdict =
        Array.isArray(body.chain) ||
        body.effective_scope !== undefined ||
        body.effectiveScope !== undefined ||
        typeof body.valid === "boolean";
      if (!hasVerdict) {
        return result("fail", `chain response has no recognizable verdict fields: ${JSON.stringify(Object.keys(body))}`);
      }
      const depth = Array.isArray(body.chain) ? body.chain.length : undefined;
      return result("pass", depth !== undefined ? `chain resolved, depth ${depth}` : "chain verdict returned");
    },
  },
];
