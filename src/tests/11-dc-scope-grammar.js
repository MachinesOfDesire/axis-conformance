/**
 * §11 Delegation Credential scope grammar — tests.
 *
 * v0.2 stabilizes the formal scope grammar for DCs. Mint-time validation of
 * scope strings on POST /delegations is testable in principle, but requires
 * a valid issuer/subject key pair and signed delegation envelope to reach
 * the scope-validation code path (otherwise the call is rejected for an
 * earlier reason and we can't distinguish that from a scope-validation
 * rejection). Tests below cover what's probable without that machinery.
 */

import { result } from "../runner.js";

export default [
  {
    id: "11.1.a",
    requirement: "Empty scope strings are rejected at mint (§11.1.1)",
    async run() {
      return result(
        "skip",
        "Requires a valid signed delegation envelope to reach scope validation. Queued for stable v0.2 runner.",
      );
    },
  },

  {
    id: "11.1.b",
    requirement: "Scopes with invalid characters (e.g. `comments.post!`) are rejected at mint (§11.1.1)",
    async run() {
      return result(
        "skip",
        "Requires a valid signed delegation envelope. Queued for stable v0.2 runner.",
      );
    },
  },

  {
    id: "11.1.c",
    requirement: "Multi-segment wildcard `**` is rejected (§11.1.2)",
    async run() {
      return result(
        "skip",
        "Requires a valid signed delegation envelope. Queued for stable v0.2 runner.",
      );
    },
  },

  {
    id: "11.2.a",
    requirement: "Scope intersection across a chain is computed at /verify (§11.2.1)",
    async run() {
      return result(
        "skip",
        "Requires multi-credential chain + signed AIT. Manual verification per §15.4.",
      );
    },
  },

  {
    id: "11.3.a",
    requirement: "Scopes exceeding 256 chars are rejected (§11.1.4)",
    async run() {
      return result(
        "skip",
        "Requires a valid signed delegation envelope. Queued for stable v0.2 runner.",
      );
    },
  },
];
