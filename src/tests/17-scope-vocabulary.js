/**
 * §17 Scope-vocabulary discovery — tests.
 *
 * AXIS Protocol v0.3 publishes the standard scope vocabulary at
 * `/.well-known/axis-scopes` (protocol §6.14, §4.4.1, Appendix B). The
 * vocabulary is two-layer: `namespace:action` (e.g. `content:read`,
 * `commerce:purchase`), with vendor extensions carrying an `x-<vendor>:`
 * prefix. Each entry declares whether it is `standard` (from the shared
 * vocabulary) and carries a human-readable `description`.
 *
 * NOTE (honesty): this section probes DISCOVERY of the vocabulary only, which
 * ships and is Live. Mint-time enforcement of the vocabulary on
 * `POST /delegations` is specified but not yet default-on in the reference
 * registry (see the v0.3 spec doc, "Manual-verification / deferred"), so no
 * pass/fail probe is written for it here.
 */

import { result } from "../runner.js";

// Two-layer vocabulary grammar: namespace:action, each segment [a-z0-9-]+.
// Vendor extensions use an x-<vendor>: namespace prefix, still two-layer.
const SCOPE_GRAMMAR = /^(x-[a-z0-9-]+|[a-z0-9-]+):[a-z0-9-]+$/;

export default [
  {
    id: "17.1.a",
    requirement: "GET /.well-known/axis-scopes returns 200 JSON (§17.1.1)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-scopes`);
      if (resp.status !== 200) return result("fail", `expected 200, got ${resp.status}`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("fail", "scopes manifest is not JSON");
      return result("pass");
    },
  },

  {
    id: "17.1.b",
    requirement: "Scopes manifest declares axis_version \"0.3\" and a scopes[] array (§17.1.2)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-scopes`);
      if (resp.status !== 200) return result("skip", `scopes manifest unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("skip", "scopes manifest is not JSON (covered by 17.1.a)");
      if (body.axis_version !== "0.3") {
        return result("fail", `expected axis_version "0.3", got ${JSON.stringify(body.axis_version)}`);
      }
      if (!Array.isArray(body.scopes) || body.scopes.length === 0) {
        return result("fail", "scopes manifest has no non-empty scopes[] array");
      }
      return result("pass", `${body.scopes.length} scope(s) published`);
    },
  },

  {
    id: "17.1.c",
    requirement: "Each scope entry carries scope + standard + description (§17.1.3)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-scopes`);
      if (resp.status !== 200) return result("skip", `scopes manifest unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body || !Array.isArray(body.scopes)) return result("skip", "no scopes[] array (covered by 17.1.b)");
      const bad = body.scopes.find(
        (s) => !s || typeof s.scope !== "string" || typeof s.standard !== "boolean" || typeof s.description !== "string",
      );
      if (bad) {
        return result("fail", `a scope entry is missing scope/standard/description: ${JSON.stringify(bad)}`);
      }
      return result("pass", `all ${body.scopes.length} entries well-formed`);
    },
  },

  {
    id: "17.1.d",
    requirement: "Standard scopes follow the two-layer namespace:action grammar (§17.1.4)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-scopes`);
      if (resp.status !== 200) return result("skip", `scopes manifest unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body || !Array.isArray(body.scopes)) return result("skip", "no scopes[] array (covered by 17.1.b)");
      const standard = body.scopes.filter((s) => s && s.standard === true);
      if (standard.length === 0) return result("skip", "no scopes marked standard=true");
      const offender = standard.find((s) => !SCOPE_GRAMMAR.test(s.scope));
      if (offender) {
        return result("fail", `standard scope does not match namespace:action grammar: "${offender.scope}"`);
      }
      const namespaces = [...new Set(standard.map((s) => s.scope.split(":")[0]))];
      return result("pass", `${standard.length} standard scopes across namespaces: ${namespaces.join(", ")}`);
    },
  },

  {
    id: "17.1.e",
    requirement: "Standard vocabulary includes the core content namespace (§17.1.5)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-scopes`);
      if (resp.status !== 200) return result("skip", `scopes manifest unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body || !Array.isArray(body.scopes)) return result("skip", "no scopes[] array (covered by 17.1.b)");
      const standardScopes = new Set(body.scopes.filter((s) => s && s.standard === true).map((s) => s.scope));
      // content:comment is the load-bearing engagement scope AXIS launched on;
      // its presence in the standard set is the floor for the vocabulary.
      if (!standardScopes.has("content:comment")) {
        return result("fail", `standard vocabulary is missing content:comment (present: ${[...standardScopes].slice(0, 8).join(", ")}…)`);
      }
      const contentScopes = [...standardScopes].filter((s) => s.startsWith("content:"));
      return result("pass", `content namespace present: ${contentScopes.join(", ")}`);
    },
  },
];
