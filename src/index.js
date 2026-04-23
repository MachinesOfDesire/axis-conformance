/**
 * axis-conformance — programmatic entry.
 *
 *   import { runAll } from "axis-conformance";
 *   const results = await runAll({ registryUrl: "https://...", apiKeyA: "..." });
 */

export { runAll, SECTIONS, result } from "./runner.js";
export { printHuman, printJson } from "./report.js";

export const SUITE_VERSION = "0.1.0-alpha.1";
export const CONFORMANCE_VERSION = "0.1";
