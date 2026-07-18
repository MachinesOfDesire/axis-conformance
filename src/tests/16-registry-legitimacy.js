/**
 * §16 Registry-legitimacy artifacts — tests.
 *
 * AXIS Protocol v0.3 introduces the CA-trust legitimacy model (protocol §6.13,
 * §6.15, §8 Step 1): a registry publishes a signed self-manifest at
 * `/.well-known/axis-registry` and a signed root directory at
 * `/.well-known/axis-directory`. A verifier pins the root public key and walks
 * from the directory to the self-manifest to establish that a registry is a
 * legitimate member of the federation before trusting any identity it serves.
 *
 * These are all public GETs with structured bodies — the most automatable of
 * the v0.3 additions.
 */

import { result } from "../runner.js";

const HEX64 = /^[0-9a-f]{64}$/;

function b64urlToBytes(s) {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? norm : norm + "=".repeat(4 - (norm.length % 4));
  return new Uint8Array(Buffer.from(pad, "base64"));
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default [
  {
    id: "16.1.a",
    requirement: "GET /.well-known/axis-registry returns 200 JSON (§16.1.1)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-registry`);
      if (resp.status !== 200) return result("fail", `expected 200, got ${resp.status}`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("fail", "self-manifest is not JSON");
      return result("pass");
    },
  },

  {
    id: "16.1.b",
    requirement: "Self-manifest declares axis_version \"0.3\" and a registry_id (§16.1.2)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-registry`);
      if (resp.status !== 200) return result("skip", `self-manifest unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("skip", "self-manifest is not JSON (covered by 16.1.a)");
      if (body.axis_version !== "0.3") {
        return result("fail", `expected axis_version "0.3", got ${JSON.stringify(body.axis_version)}`);
      }
      const registryId = body.registry_id ?? body.registryId;
      if (typeof registryId !== "string" || registryId.length === 0) {
        return result("fail", "self-manifest has no non-empty registry_id");
      }
      return result("pass", `registry_id = "${registryId}"`);
    },
  },

  {
    id: "16.1.c",
    requirement: "Self-manifest carries a signing key with kid + public_key + alg (§16.1.3)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-registry`);
      if (resp.status !== 200) return result("skip", `self-manifest unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("skip", "self-manifest is not JSON (covered by 16.1.a)");
      const keys = Array.isArray(body.keys) ? body.keys : null;
      if (!keys || keys.length === 0) {
        return result("fail", "self-manifest has no non-empty keys[] array");
      }
      const bad = keys.find(
        (k) => !k || typeof k.kid !== "string" || typeof k.public_key !== "string" || typeof k.alg !== "string",
      );
      if (bad) {
        return result("fail", `a key entry is missing kid/public_key/alg: ${JSON.stringify(bad)}`);
      }
      const active = keys.find((k) => k.status === "active") || keys[0];
      return result("pass", `${keys.length} key(s); active kid = "${active.kid}" (${active.alg})`);
    },
  },

  {
    id: "16.1.d",
    requirement: "Self-manifest is signed (top-level signature field) (§16.1.4)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-registry`);
      if (resp.status !== 200) return result("skip", `self-manifest unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("skip", "self-manifest is not JSON (covered by 16.1.a)");
      const sig = body.signature ?? body.proof?.proofValue;
      if (typeof sig !== "string" || sig.length === 0) {
        return result("fail", "self-manifest has no non-empty signature field");
      }
      return result("pass", "signature present");
    },
  },

  {
    id: "16.2.a",
    requirement: "GET /.well-known/axis-directory returns 200 JSON (§16.2.1)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-directory`);
      if (resp.status !== 200) return result("fail", `expected 200, got ${resp.status}`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("fail", "root directory is not JSON");
      return result("pass");
    },
  },

  {
    id: "16.2.b",
    requirement: "Root directory declares axis_version \"0.3\" and lists registrars[] with key fingerprints (§16.2.2)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-directory`);
      if (resp.status !== 200) return result("skip", `root directory unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("skip", "root directory is not JSON (covered by 16.2.a)");
      if (body.axis_version !== "0.3") {
        return result("fail", `expected axis_version "0.3", got ${JSON.stringify(body.axis_version)}`);
      }
      const registrars = Array.isArray(body.registrars) ? body.registrars : null;
      if (!registrars || registrars.length === 0) {
        return result("fail", "root directory has no non-empty registrars[] array");
      }
      const bad = registrars.find(
        (r) => !r || typeof r.registry_id !== "string" || !Array.isArray(r.key_fingerprints) || r.key_fingerprints.length === 0,
      );
      if (bad) {
        return result("fail", `a registrar entry lacks registry_id or key_fingerprints: ${JSON.stringify(bad)}`);
      }
      return result("pass", `${registrars.length} registrar(s) listed`);
    },
  },

  {
    id: "16.2.c",
    requirement: "Root directory is signed (root_signature field) (§16.2.3)",
    async run(ctx) {
      const resp = await fetch(`${ctx.registryUrl}/.well-known/axis-directory`);
      if (resp.status !== 200) return result("skip", `root directory unreachable (status ${resp.status})`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("skip", "root directory is not JSON (covered by 16.2.a)");
      const sig = body.root_signature ?? body.signature;
      if (typeof sig !== "string" || sig.length === 0) {
        return result("fail", "root directory has no non-empty root_signature field");
      }
      return result("pass", "root_signature present");
    },
  },

  {
    id: "16.3.a",
    requirement: "Legitimacy chain: the self-manifest's signing key is fingerprinted in the root directory (§16.3.1)",
    async run(ctx) {
      const [manifestResp, dirResp] = await Promise.all([
        fetch(`${ctx.registryUrl}/.well-known/axis-registry`),
        fetch(`${ctx.registryUrl}/.well-known/axis-directory`),
      ]);
      if (manifestResp.status !== 200 || dirResp.status !== 200) {
        return result("skip", "self-manifest or root directory unreachable");
      }
      const manifest = await manifestResp.json().catch(() => null);
      const dir = await dirResp.json().catch(() => null);
      if (!manifest || !dir) return result("skip", "self-manifest or root directory not JSON");
      const keys = Array.isArray(manifest.keys) ? manifest.keys : [];
      const active = keys.find((k) => k.status === "active") || keys[0];
      if (!active || typeof active.public_key !== "string") {
        return result("skip", "self-manifest has no usable signing key (covered by 16.1.c)");
      }
      // Collect fingerprints advertised by the registry's own row in the directory.
      const registryId = manifest.registry_id ?? manifest.registryId;
      const rows = Array.isArray(dir.registrars) ? dir.registrars : [];
      const own = rows.find((r) => r.registry_id === registryId) || rows[0];
      const fingerprints = (own?.key_fingerprints || []).map((f) => String(f).toLowerCase());
      if (fingerprints.length === 0) {
        return result("skip", "root directory advertises no key_fingerprints for this registry");
      }
      // The reference registry fingerprints its Ed25519 key as sha256 over the
      // raw 32-byte public key. If the directory uses a different (opaque or
      // non-hex) canonicalization we cannot recompute it, so SKIP rather than
      // report a false failure.
      if (!fingerprints.every((f) => HEX64.test(f))) {
        return result("skip", `directory fingerprints are not sha256-hex (impl-defined canonicalization): ${fingerprints[0]}`);
      }
      let computed;
      try {
        computed = await sha256Hex(b64urlToBytes(active.public_key));
      } catch (err) {
        return result("skip", `could not decode/hash the self-manifest key: ${err.message}`);
      }
      if (fingerprints.includes(computed)) {
        return result("pass", `sha256(active key) ${computed.slice(0, 16)}… is in the directory`);
      }
      return result("fail", `active key fingerprint ${computed.slice(0, 16)}… not listed in the root directory`);
    },
  },
];
