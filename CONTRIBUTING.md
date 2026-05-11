# Contributing to AXIS Conformance

Thank you for your interest in contributing to AXIS Conformance — the normative conformance criteria for AXIS-conformant registries and the reference test runner that automates the parts of those criteria that can be automated.

## Before you contribute

Contributions are welcome — issues, pull requests, additional automated test cases, refinements to the spec language, third-party registries to add as verification targets, CI integrations.

We ask contributors to sign a Contributor License Agreement (CLA) before submitting a pull request. The CLA keeps the project legally clean and lets us transition stewardship to an independent foundation in the future without having to re-negotiate rights with every past contributor.

## Contributor License Agreement (CLA)

By submitting a pull request or other contribution to this repository, you agree to the following terms:

1. **You grant us a license.** You grant Kipple Labs, Inc. (current owner of AXIS Conformance) and any future foundation or successor organization that inherits stewardship of AXIS Conformance a perpetual, worldwide, non-exclusive, royalty-free, irrevocable license to use, reproduce, modify, distribute, and sublicense your contribution as part of AXIS Conformance, under the Apache 2.0 license or any future license the project adopts.

2. **You retain your copyright.** Signing this CLA does not transfer ownership of your contribution. You keep your copyright. We just need the right to use it.

3. **Your contribution is your own work.** You represent that you have the right to submit the contribution — it is your original work, or you have permission from the original author, and it does not infringe any third party's rights.

4. **No warranty.** You provide your contribution as-is, without warranties of any kind.

5. **Relicensing optionality.** The license granted above includes the right to relicense your contribution under a different open source license if the project's governance determines relicensing is appropriate (for example, transitioning to an OSI-approved license better suited to the eventual foundation's stewardship model).

To indicate your agreement, add your name to the `CONTRIBUTORS.md` file as part of your pull request, with the following format:

```
Your Name <your@email.com> — agreed to CLA on YYYY-MM-DD
```

If you are contributing on behalf of an organization, contact us at `contrib@axisprime.ai` before submitting so we can arrange an entity-level CLA if needed.

## How to contribute

### Proposing a change to the conformance spec

The normative spec lives in `conformance-v0.1.md`. Changes to it affect what every implementer must do to call themselves AXIS-conformant — open a discussion before writing a PR.

1. **Open an issue** describing the requirement you want to add, clarify, or remove, with the rationale (real-world implementer issue, ambiguity discovered, drift from AXIS Protocol, etc.).
2. **Wait for discussion.** Spec changes benefit from review before implementation, and we may flag whether your change belongs in the current spec version as a clarification, or in the next version as a new normative requirement.
3. **Submit a PR** that references the issue. Include:
   - Edit to `conformance-v0.1.md` (or a new `conformance-v0.x.md` file for a new spec version)
   - Update to `CHANGELOG.md` under `[Unreleased]`
   - New or updated tests in `src/sections/` covering the change, with `N.N.x` test ids
   - Rationale section in the PR description

### Improving the runner

The reference runner lives under `src/`. It is a Node.js (≥18) CLI that probes a registry URL against the conformance spec and emits pass/fail/skip results.

Useful contributions include:

- **New test cases** under `src/sections/` covering existing spec requirements that aren't yet automated
- **Better diagnostics** in failure messages (so implementers can fix what's broken without reading the runner source)
- **CI examples** in `README.md` for additional platforms (GitHub Actions, GitLab CI, CircleCI, etc.)
- **Output format improvements** (e.g., JUnit XML, SARIF) gated behind CLI flags so existing consumers aren't disturbed
- **Coverage of currently-skipped sections** (§3.4 retention, §6 rate limiting, §7 availability, §8 data handling) when there is a credible way to automate them

For any new test, the `id` must follow `N.N.x` format and be globally unique. The structural self-test (`npm test`) verifies these invariants.

### Adding a third-party registry as a verification target

We track public AXIS-conformant registry deployments so spec authors and runner contributors can run the suite against multiple implementations. To register one:

- Open a PR adding your registry to `IMPLEMENTATIONS.md` (or open an issue if the file does not yet exist and we'll bootstrap it)
- Include: registry URL, operator name, which spec version you target, known deviations, contact for operations
- We'll run the runner against your registry and merge if you're conformant against the version you target

### Reporting a bug or inconsistency in the spec

Open an issue with:

- Clear description of the problem
- Exact citation in `conformance-v0.1.md` (section number and paragraph)
- Where possible, a proposed correction

### Reporting a bug in the runner

Open an issue with:

- Runner version (from `axis-conformance --version` or `package.json`)
- Command line and CLI flags you used
- Registry you ran against (URL only; do not include keys)
- Expected vs. actual behavior

### Reporting a security vulnerability

Do NOT open a public issue for security vulnerabilities. Contact `contrib@axisprime.ai` for the disclosure process.

## What we're looking for

- **Clarifications** that make the spec easier to implement correctly
- **Real-world cases where a registry passes the runner but violates the spirit of the spec** (gaps in automated coverage)
- **Automated coverage** for currently-skipped requirements when a credible probe exists
- **Third-party registry registrations** in `IMPLEMENTATIONS.md`
- **Corrections** to errors, ambiguities, or inconsistencies in either spec or runner
- **CI integration examples** so implementers can drop the runner into their deploy pipeline
- **Conformance-test fixtures** (signed examples of valid and invalid records, credentials, verification flows) that can be reused across implementations

## What we're not looking for (yet)

- **Breaking changes to the v0.1 spec mid-version.** Between versions (v0.1 → v0.2) breaking changes are expected; within a version we hold the contract stable so implementers can ship against it.
- **Probes that depend on registry internals** the spec does not require to be observable.
- **Runner features that conflate spec changes with implementation details.** Separate them — spec change in one PR, runner change in another.
- **CI features that require the runner to call back into proprietary infrastructure.** The runner stays standalone.

## Style and conventions

### Spec-document style

- **Use SHOULD, MUST, MAY, REQUIRED, OPTIONAL** per [RFC 2119](https://datatracker.ietf.org/doc/html/rfc2119) and [RFC 8174](https://datatracker.ietf.org/doc/html/rfc8174). Capitalize when used normatively.
- **Examples use `axis:operator:agent-name` format.** Pick illustrative operator names that are clearly fictional (`widget-corp`, `acme`, `some-rando`).
- **JSON examples are formatted with 2-space indentation** and trailing commas are prohibited (strict JSON).
- **Cryptographic examples use Ed25519** unless demonstrating a specific alternative algorithm case.

### Runner code style

- **JavaScript, Node 18+, ES modules.**
- **One section file per spec section** under `src/sections/`. Each test has `id` (`N.N.x`), `requirement` (spec reference), and `run` (async function returning `pass` / `fail` / `skip` plus diagnostic detail).
- **Tests are independent.** No test depends on side effects of a previous test.
- **No real-network calls in `npm test`.** The structural self-test is offline; the network-driven suite runs via `npm run check` or the `axis-conformance` bin.
- **Exit codes** are `0` conformant, `1` non-conformant, `2` invalid args.

### Commit messages

Use conventional commits:

```
spec: clarify §3.2 audit-before-mutation timing
runner: add §1.1.4.a coverage for OPTIONS preflight
test: cover §5 listing-endpoint owner-or-admin matrix
docs: fix CI example in README
chore: bump dependency to fix advisory
```

Prefix with `spec:` for normative spec changes, `runner:` for runner code changes, `test:` for added or refined test cases, `docs:` for README/CHANGELOG, `chore:` for housekeeping.

### PR size

Keep PRs focused. One conceptual change per PR. If you're also fixing typos, put the typos in a separate PR.

## Review process

PRs are reviewed by the current maintainers at Kipple Labs, Inc. during the pre-foundation period. Review SLA is best-effort; there are no guaranteed response times during the pre-1.0 phase.

Once a foundation is formed, review will transition to the foundation's governance structure.

## Contact

- **General questions:** open a GitHub issue
- **CLA / organization-level contributions:** `contrib@axisprime.ai`
- **Security issues:** `contrib@axisprime.ai` (do not open a public issue)

## License

By contributing, you agree that your contributions will be licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE).
