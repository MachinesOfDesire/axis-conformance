#!/usr/bin/env node
/**
 * axis-conformance CLI.
 *
 * Usage:
 *   axis-conformance --registry-url https://registry.example.com \
 *     --registrar-key-a $KEY_A \
 *     [--registrar-key-b $KEY_B] \
 *     [--admin-key $ADMIN] \
 *     [--super-admin-key $SUPER] \
 *     [--known-operator-id my-operator-id] \
 *     [--known-agent-id axis:op:slug] \
 *     [--json] [--verbose]
 *
 * Exit codes:
 *   0  conformant (no fail / no error)
 *   1  non-conformant (at least one fail or error)
 *   2  invalid arguments
 */

import { runAll } from "./runner.js";
import { printHuman, printJson } from "./report.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    if (name === "json" || name === "verbose" || name === "help") {
      args[name] = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    args[name] = value;
    i++;
  }
  return args;
}

function helpText() {
  return `axis-conformance — probe an AXIS registry for Registry Conformance v0.1

Required:
  --registry-url URL            The registry to test

Optional (more args = more tests run):
  --registrar-key-a KEY         A valid registrar API key (plain 'registrar' role ideal)
  --registrar-key-b KEY         A second registrar key (enables BOLA matrix)
  --admin-key KEY               A key with role=admin
  --super-admin-key KEY         A key with role=super_admin
  --known-operator-id ID        An existing operator id (enables public-layer leak tests)
  --known-agent-id ID           An existing agent id (enables public-layer leak tests)

Output:
  --json                        Emit JSON instead of human-readable report
  --verbose                     Log each test as it runs to stderr

Exit code 0 = conformant; 1 = non-conformant; 2 = invalid args.
`;
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`${err.message}\n\n${helpText()}`);
    process.exit(2);
  }
  if (args.help) {
    process.stdout.write(helpText());
    return;
  }
  if (!args["registry-url"]) {
    process.stderr.write(`Missing --registry-url\n\n${helpText()}`);
    process.exit(2);
  }

  const ctx = {
    registryUrl: args["registry-url"].replace(/\/$/, ""),
    apiKeyA: args["registrar-key-a"],
    apiKeyB: args["registrar-key-b"],
    adminKey: args["admin-key"],
    superAdminKey: args["super-admin-key"],
    knownOperatorId: args["known-operator-id"],
    knownAgentId: args["known-agent-id"],
    options: { verbose: Boolean(args.verbose) },
  };

  if (ctx.options.verbose) {
    process.stderr.write(`probing ${ctx.registryUrl}\n`);
  }

  const results = await runAll(ctx);

  if (args.json) {
    process.stdout.write(printJson(results, ctx) + "\n");
  } else {
    process.stdout.write(printHuman(results, ctx) + "\n");
  }

  const failed = results.filter((r) => r.status === "fail" || r.status === "error").length;
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err.message}\n`);
  process.exit(2);
});
