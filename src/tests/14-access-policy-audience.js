/**
 * §14 Access-policy advertisement — tests.
 *
 * v0.2 adds a REQUIRED `audience` field to /.well-known/axis-access. This
 * section is the most automatable of the v0.2 additions: the well-known
 * doc is a public GET with a structured body.
 */

import { result } from "../runner.js";

export default [
  {
    id: "14.1.a",
    requirement: "GET /.well-known/axis-access returns 200 (§14.1.1)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-access`);
      if (resp.status !== 200) {
        return result("fail", `expected 200, got ${resp.status}`);
      }
      return result("pass");
    },
  },

  {
    id: "14.1.b",
    requirement: "Response includes `audience` field (§14.1.1)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-access`);
      if (resp.status !== 200) return result("skip", `Well-known unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("fail", "Response is not JSON");
      // The `audience` field may live at top level or inside a signed envelope.
      const audience = body.audience ?? body.payload?.audience;
      if (audience === undefined) {
        return result("fail", "Response has no `audience` field at top level or inside payload");
      }
      return result("pass");
    },
  },

  {
    id: "14.1.c",
    requirement: "`audience` is a non-empty string (§14.1.2)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-access`);
      if (resp.status !== 200) return result("skip", `Well-known unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("skip", "Response is not JSON");
      const audience = body.audience ?? body.payload?.audience;
      if (audience === undefined) return result("skip", "No audience field (covered by 14.1.b)");
      if (typeof audience !== "string") {
        return result("fail", `audience must be string, got ${typeof audience}`);
      }
      if (audience.length === 0) {
        return result("fail", "audience is an empty string");
      }
      return result("pass", `audience = "${audience}"`);
    },
  },

  {
    id: "14.1.d",
    requirement: "`audience` is stable across multiple GETs (§14.1.3)",
    async run(ctx) {
      const fetches = await Promise.all([
        fetch(`${ctx.registryUrl}/.well-known/axis-access`),
        fetch(`${ctx.registryUrl}/.well-known/axis-access`),
        fetch(`${ctx.registryUrl}/.well-known/axis-access`),
      ]);
      const bodies = await Promise.all(fetches.map((r) => r.json().catch(() => null)));
      const audiences = bodies.map((b) => b?.audience ?? b?.payload?.audience);
      if (audiences.some((a) => a === undefined)) {
        return result("skip", "audience field absent on at least one GET");
      }
      const first = audiences[0];
      if (audiences.every((a) => a === first)) {
        return result("pass");
      }
      return result("fail", `audience varied across GETs: ${JSON.stringify(audiences)}`);
    },
  },

  {
    id: "14.3.a",
    requirement: "Response includes Cache-Control header (§14.3.1 SHOULD)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-access`);
      if (resp.status !== 200) return result("skip", `Well-known unreachable (status ${resp.status})`);
      const cc = resp.headers.get("cache-control");
      if (!cc) {
        return result("skip", "No Cache-Control header (SHOULD, not MUST — flagging as advisory)");
      }
      return result("pass", `Cache-Control: ${cc}`);
    },
  },
];
