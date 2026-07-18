/**
 * §18 Versioned discovery — tests.
 *
 * AXIS Protocol v0.3 makes each discovery document self-declare the protocol
 * version it speaks via a top-level `axis_version` field (protocol §4.3.2). A
 * consumer negotiates capabilities by reading these fields rather than assuming
 * a version. The three v0.3-introduced documents (self-manifest, root
 * directory, scopes) declare "0.3"; `/.well-known/axis-access` also carries a
 * version so consumers can tell which surface they are talking to.
 *
 * The dedicated `/.well-known/axis-versions` supported-versions endpoint
 * (protocol §6.16) is specified for a later release and is NOT required in
 * v0.3 — until it ships, version support is inferred from the `axis_version`
 * fields probed here. 18.2.a documents that deferral in a way that cannot fail
 * a compliant-but-honest registry.
 */

import { result } from "../runner.js";

const VERSION = /^\d+\.\d+$/;

const VERSIONED_DOCS = [
  { path: "/.well-known/axis-registry", label: "self-manifest" },
  { path: "/.well-known/axis-directory", label: "root directory" },
  { path: "/.well-known/axis-scopes", label: "scopes" },
];

async function fetchVersion(ctx, path) {
  const resp = await fetch(`${ctx.registryUrl}${path}`);
  if (resp.status !== 200) return { reachable: false, status: resp.status };
  const body = await resp.json().catch(() => null);
  if (!body) return { reachable: true, json: false };
  return { reachable: true, json: true, version: body.axis_version };
}

export default [
  {
    id: "18.1.a",
    requirement: "Every discovery document self-declares a machine-readable axis_version (§18.1.1)",
    async run(ctx) {
      const docs = [...VERSIONED_DOCS, { path: "/.well-known/axis-access", label: "access-policy" }];
      const seen = [];
      for (const d of docs) {
        const info = await fetchVersion(ctx, d.path);
        if (!info.reachable) return result("skip", `${d.label} unreachable (status ${info.status})`);
        if (!info.json) return result("fail", `${d.label} is not JSON`);
        if (typeof info.version !== "string" || !VERSION.test(info.version)) {
          return result("fail", `${d.label} has no valid axis_version (got ${JSON.stringify(info.version)})`);
        }
        seen.push(`${d.label}=${info.version}`);
      }
      return result("pass", seen.join(", "));
    },
  },

  {
    id: "18.1.b",
    requirement: "The v0.3-introduced documents declare axis_version \"0.3\" (§18.1.2)",
    async run(ctx) {
      const seen = [];
      for (const d of VERSIONED_DOCS) {
        const info = await fetchVersion(ctx, d.path);
        if (!info.reachable) return result("skip", `${d.label} unreachable (status ${info.status})`);
        if (info.version !== "0.3") {
          return result("fail", `${d.label} declares axis_version ${JSON.stringify(info.version)}, expected "0.3"`);
        }
        seen.push(d.label);
      }
      return result("pass", `0.3 declared by: ${seen.join(", ")}`);
    },
  },

  {
    id: "18.1.c",
    requirement: "/.well-known/axis-access self-declares its axis_version (§18.1.3)",
    async run(ctx) {
      const info = await fetchVersion(ctx, "/.well-known/axis-access");
      if (!info.reachable) return result("skip", `axis-access unreachable (status ${info.status})`);
      if (!info.json) return result("fail", "axis-access is not JSON");
      if (typeof info.version !== "string" || !VERSION.test(info.version)) {
        return result("fail", `axis-access has no valid axis_version (got ${JSON.stringify(info.version)})`);
      }
      return result("pass", `axis-access declares axis_version "${info.version}"`);
    },
  },

  {
    id: "18.2.a",
    requirement: "Version support is discoverable; /.well-known/axis-versions is optional in v0.3 (§18.2.1)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-versions`);
      if (resp.status === 404) {
        // Specified for a later release. Absence is conformant in v0.3: version
        // support is inferred from the per-document axis_version fields (§18.1).
        return result("pass", "axis-versions not served (v0.4 mechanism); version inferred from axis_version fields");
      }
      if (resp.status !== 200) {
        return result("skip", `axis-versions returned ${resp.status} (neither served nor cleanly absent)`);
      }
      const body = await resp.json().catch(() => null);
      if (!body) return result("fail", "axis-versions served but is not JSON");
      const versions = body.versions ?? body.supported ?? body.axis_versions;
      if (!Array.isArray(versions) || versions.length === 0) {
        return result("fail", "axis-versions served but has no non-empty versions array");
      }
      return result("pass", `axis-versions served: ${versions.join(", ")}`);
    },
  },
];
