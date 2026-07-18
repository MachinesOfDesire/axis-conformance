/**
 * Report formatters. Human-readable console summary + machine-readable JSON.
 */

const COLOR = process.stdout.isTTY
  ? {
      reset: "\x1b[0m",
      bold: "\x1b[1m",
      dim: "\x1b[2m",
      green: "\x1b[32m",
      red: "\x1b[31m",
      yellow: "\x1b[33m",
      cyan: "\x1b[36m",
      gray: "\x1b[90m",
    }
  : Object.fromEntries(
      ["reset", "bold", "dim", "green", "red", "yellow", "cyan", "gray"].map((k) => [k, ""]),
    );

const STATUS_STYLE = {
  pass: { icon: "✓", color: COLOR.green, label: "PASS" },
  fail: { icon: "✗", color: COLOR.red, label: "FAIL" },
  skip: { icon: "○", color: COLOR.gray, label: "SKIP" },
  error: { icon: "!", color: COLOR.yellow, label: "ERROR" },
};

export function printHuman(results, { registryUrl }) {
  let currentSection = null;
  const lines = [];
  lines.push(`${COLOR.bold}AXIS Registry Conformance v0.3${COLOR.reset}`);
  lines.push(`${COLOR.dim}target:${COLOR.reset} ${registryUrl}`);
  lines.push(`${COLOR.dim}time:${COLOR.reset}   ${new Date().toISOString()}`);
  lines.push("");

  for (const r of results) {
    if (r.section !== currentSection) {
      currentSection = r.section;
      lines.push(`${COLOR.bold}${r.section} ${r.sectionTitle}${COLOR.reset}`);
    }
    const s = STATUS_STYLE[r.status] || STATUS_STYLE.error;
    const idCell = `${COLOR.dim}${r.id.padEnd(7)}${COLOR.reset}`;
    const statusCell = `${s.color}${s.icon} ${s.label}${COLOR.reset}`.padEnd(22);
    lines.push(`  ${statusCell}  ${idCell}  ${r.requirement}`);
    if (r.detail) {
      lines.push(`          ${COLOR.dim}${r.detail}${COLOR.reset}`);
    }
  }

  const tally = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  lines.push("");
  lines.push(
    `${COLOR.bold}summary:${COLOR.reset} ` +
      `${COLOR.green}${tally.pass || 0} pass${COLOR.reset}` +
      `  ${COLOR.red}${tally.fail || 0} fail${COLOR.reset}` +
      `  ${COLOR.gray}${tally.skip || 0} skip${COLOR.reset}` +
      `  ${COLOR.yellow}${tally.error || 0} error${COLOR.reset}`,
  );

  const verdict = (tally.fail || 0) + (tally.error || 0) === 0
    ? `${COLOR.green}${COLOR.bold}CONFORMANT${COLOR.reset} (at the level covered by v0.3 automation; skipped tests need manual verification)`
    : `${COLOR.red}${COLOR.bold}NON-CONFORMANT${COLOR.reset}`;
  lines.push(`${COLOR.bold}verdict:${COLOR.reset} ${verdict}`);

  return lines.join("\n");
}

export function printJson(results, ctx) {
  const tally = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  return JSON.stringify(
    {
      suite: "axis-conformance",
      version: "0.3.0-alpha.1",
      target: ctx.registryUrl,
      timestamp: new Date().toISOString(),
      tally: {
        pass: tally.pass || 0,
        fail: tally.fail || 0,
        skip: tally.skip || 0,
        error: tally.error || 0,
      },
      verdict: (tally.fail || 0) + (tally.error || 0) === 0 ? "conformant" : "non_conformant",
      results,
    },
    null,
    2,
  );
}
