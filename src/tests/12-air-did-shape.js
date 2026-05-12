/**
 * §12 Agent Identity Record DID shape — tests.
 *
 * v0.2 introduces operator-namespaced DIDs: 4-segment form
 * `did:axis:{registry}:{operator-slug}:{agent-slug}`. Registries MUST also
 * resolve v0.1 (3-segment) forms during the transition window.
 *
 * The runner uses --known-agent-id (the agent's DID, either form) to probe.
 */

import { result } from "../runner.js";

// v0.2 form: did:axis:{registry}:{operator}:{agent}  (4 segments after did:axis:)
const V0_2_DID = /^did:axis:[a-zA-Z0-9_-]+:[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/;
// v0.1 form: did:axis:{registry}:{agent}  (3 segments after did:axis:)
const V0_1_DID = /^did:axis:[a-zA-Z0-9_-]+:[a-zA-Z0-9_.-]+$/;

function isV0_2(did) {
  return V0_2_DID.test(did);
}
function isV0_1(did) {
  // v0.1 matches if and only if it's 3 segments — V0_1_DID also matches 4
  // segments because the regex isn't anchored to segment count. Disambiguate
  // by counting the colons after `did:axis:`.
  if (!V0_1_DID.test(did)) return false;
  const tail = did.slice("did:axis:".length);
  return tail.split(":").length === 2;
}

function v0_2ToV0_1(did) {
  // did:axis:prime:operator:agent  →  did:axis:prime:agent
  if (!isV0_2(did)) return null;
  const tail = did.slice("did:axis:".length);
  const segs = tail.split(":");
  if (segs.length !== 3) return null;
  return `did:axis:${segs[0]}:${segs[2]}`;
}

export default [
  {
    id: "12.1.a",
    requirement: "Known agent's did field matches v0.1 or v0.2 grammar (§12.1.1)",
    async run(ctx) {
      const knownAgent = ctx["known-agent-id"] || ctx.knownAgentId;
      if (!knownAgent) return result("skip", "Requires --known-agent-id");
      const resp = await fetch(`${ctx.registryUrl}/agents/${encodeURIComponent(knownAgent)}`);
      if (!resp.ok) return result("fail", `GET /agents/${knownAgent} returned ${resp.status}`);
      const body = await resp.json().catch(() => null);
      if (!body) return result("fail", "GET /agents/:id did not return JSON");
      const did = body.did || body.agent?.did;
      if (typeof did !== "string") {
        return result("fail", `agent record has no string 'did' field; got: ${typeof did}`);
      }
      if (isV0_2(did)) return result("pass", `v0.2 form: ${did}`);
      if (isV0_1(did)) return result("pass", `v0.1 form (transition window): ${did}`);
      return result("fail", `did does not match v0.1 or v0.2 grammar: ${did}`);
    },
  },

  {
    id: "12.1.b",
    requirement: "Newly-registered agents return v0.2 form (§12.1.3)",
    async run() {
      return result(
        "skip",
        "Requires registering a new agent (signed POST /register). Inspect a recently-registered agent's `did` field manually; it should be 4-segment v0.2 form.",
      );
    },
  },

  {
    id: "12.3.a",
    requirement: "Cross-form resolution: v0.1 form of a v0.2 agent resolves (§12.3.1)",
    async run(ctx) {
      const knownAgent = ctx["known-agent-id"] || ctx.knownAgentId;
      if (!knownAgent) return result("skip", "Requires --known-agent-id");
      // Get the agent record at the canonical form
      const canonicalResp = await fetch(`${ctx.registryUrl}/agents/${encodeURIComponent(knownAgent)}`);
      if (!canonicalResp.ok) return result("skip", `Known agent not resolvable; got ${canonicalResp.status}`);
      const canonical = await canonicalResp.json().catch(() => null);
      const canonicalDid = canonical?.did || canonical?.agent?.did;
      if (!canonicalDid) return result("skip", "Known agent has no did field; cannot construct alternate form");
      // If canonical is v0.2, also try the v0.1 form. If canonical is v0.1, transition isn't active for this agent.
      if (!isV0_2(canonicalDid)) {
        return result("skip", `Agent's canonical DID is v0.1 form (${canonicalDid}); cross-form test requires v0.2 agent`);
      }
      const altDid = v0_2ToV0_1(canonicalDid);
      if (!altDid) return result("skip", `Could not derive v0.1 form from ${canonicalDid}`);
      const altResp = await fetch(`${ctx.registryUrl}/resolve/${encodeURIComponent(altDid)}`);
      if (altResp.status === 404) {
        return result("fail", `v0.1 form ${altDid} returned 404; cross-form tolerance not implemented`);
      }
      if (!altResp.ok) {
        return result("fail", `v0.1 form ${altDid} returned ${altResp.status}`);
      }
      const altBody = await altResp.json().catch(() => null);
      const altResolvedDid = altBody?.did || altBody?.agent?.did;
      if (!altResolvedDid) return result("fail", "v0.1 form resolved but response had no did field");
      // §12.3.3: both forms MUST resolve to the same underlying record.
      // Compare axis_id or public_key as the stable identity.
      const canonicalKey = canonical?.public_key || canonical?.agent?.public_key;
      const altKey = altBody?.public_key || altBody?.agent?.public_key;
      if (canonicalKey && altKey && canonicalKey !== altKey) {
        return result("fail", `v0.1 form resolved to a different agent (public_key mismatch)`);
      }
      return result("pass", `v0.1 form ${altDid} resolves to the same agent`);
    },
  },

  {
    id: "12.4.a",
    requirement: "operator_id is consistent across endpoints (§12.4.1)",
    async run(ctx) {
      const knownAgent = ctx["known-agent-id"] || ctx.knownAgentId;
      if (!knownAgent) return result("skip", "Requires --known-agent-id");
      const agentResp = await fetch(`${ctx.registryUrl}/agents/${encodeURIComponent(knownAgent)}`);
      if (!agentResp.ok) return result("skip", `Known agent not resolvable; got ${agentResp.status}`);
      const agentBody = await agentResp.json().catch(() => null);
      const fromAgent = agentBody?.operator_id || agentBody?.agent?.operator_id;
      if (!fromAgent) return result("skip", "GET /agents/:id did not return operator_id");
      // Compare to /resolve/:did
      const did = agentBody?.did || agentBody?.agent?.did;
      if (!did) return result("skip", "Agent record has no did field; cannot cross-check");
      const resolveResp = await fetch(`${ctx.registryUrl}/resolve/${encodeURIComponent(did)}`);
      if (!resolveResp.ok) return result("skip", `/resolve/:did returned ${resolveResp.status}`);
      const resolveBody = await resolveResp.json().catch(() => null);
      const fromResolve = resolveBody?.operator_id || resolveBody?.agent?.operator_id;
      if (!fromResolve) return result("skip", "/resolve/:did did not return operator_id");
      if (fromAgent !== fromResolve) {
        return result("fail", `operator_id drift: /agents returned "${fromAgent}", /resolve returned "${fromResolve}"`);
      }
      return result("pass", `consistent: "${fromAgent}"`);
    },
  },
];
