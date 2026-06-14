/**
 * Runner — orchestrates conformance checks.
 *
 * Each test is an async function that receives a Context and returns
 * an array of Result objects: { id, section, requirement, status, detail? }.
 *
 * Status values:
 *   - "pass"   — requirement is met
 *   - "fail"   — requirement is violated
 *   - "skip"   — insufficient input to test (e.g., no second registrar key)
 *   - "error"  — the test itself threw (distinct from fail)
 */

import section01 from "./tests/01-authentication.js";
import section02 from "./tests/02-authorization.js";
import section03 from "./tests/03-audit.js";
import section04 from "./tests/04-domain-verification.js";
import section05 from "./tests/05-tiered-visibility.js";
import section09 from "./tests/09-key-management.js";
import section10 from "./tests/10-ait-verification.js";
import section11 from "./tests/11-dc-scope-grammar.js";
import section12 from "./tests/12-air-did-shape.js";
import section13 from "./tests/13-registration-proof.js";
import section14 from "./tests/14-access-policy-audience.js";

export const SECTIONS = [
  { id: "§1", title: "Authentication", tests: section01 },
  { id: "§2", title: "Authorization", tests: section02 },
  { id: "§3", title: "Audit", tests: section03 },
  { id: "§4", title: "Domain verification", tests: section04 },
  { id: "§5", title: "Tiered visibility", tests: section05 },
  { id: "§9", title: "Key management", tests: section09 },
  { id: "§10", title: "AIT verification semantics (v0.2)", tests: section10 },
  { id: "§11", title: "DC scope grammar (v0.2)", tests: section11 },
  { id: "§12", title: "AIR DID shape (v0.2)", tests: section12 },
  { id: "§13", title: "Registration proof format (v0.2)", tests: section13 },
  { id: "§14", title: "Access-policy advertisement (v0.2)", tests: section14 },
];

/**
 * @typedef {Object} Context
 * @property {string} registryUrl                — the registry under test
 * @property {string} [apiKeyA]                  — a valid registrar API key
 * @property {string} [apiKeyB]                  — second registrar key for BOLA tests
 * @property {string} [adminKey]                 — key with role=admin
 * @property {string} [superAdminKey]            — key with role=super_admin
 * @property {string} [knownOperatorId]          — an existing operator id (issuer for §11 mint probes)
 * @property {string} [knownOperatorEmail]       — email of an operator the registrar key owns (§13 register probes)
 * @property {string} [knownOperatorDomain]      — domain of an operator the registrar key owns (§13 register probes)
 * @property {string} [knownAgentId]             — an existing agent id
 * @property {{verbose: boolean}} options
 */

/**
 * @param {Context} ctx
 * @returns {Promise<Array<Result>>}
 */
export async function runAll(ctx) {
  const results = [];
  for (const section of SECTIONS) {
    for (const test of section.tests) {
      const testId = `${section.id}.${test.id}`;
      const base = {
        id: testId,
        section: section.id,
        sectionTitle: section.title,
        requirement: test.requirement,
      };
      if (ctx.options?.verbose) {
        process.stderr.write(`  running ${testId}  ${test.requirement}\n`);
      }
      try {
        const out = await test.run(ctx);
        if (Array.isArray(out)) {
          out.forEach((r) => results.push({ ...base, ...r }));
        } else {
          results.push({ ...base, ...out });
        }
      } catch (err) {
        results.push({
          ...base,
          status: "error",
          detail: `Test threw: ${err.message}`,
        });
      }
    }
  }
  return results;
}

/**
 * Helper so individual tests can emit consistent results.
 */
export function result(status, detail) {
  return detail === undefined ? { status } : { status, detail };
}
