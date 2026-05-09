/**
 * Self-test for the conformance runner.
 *
 * Verifies that the runner machinery is well-formed without making any
 * network calls. For "does my registry conform?" use `npm run check` or
 * the bin (`axis-conformance --registry-url ...`).
 *
 * What this checks:
 *   - All section modules export an array
 *   - Every test in every section has the required shape
 *     (id, requirement, run function)
 *   - Runner imports cleanly and the SECTIONS array is non-empty
 *
 * Exits 0 on success, 1 on any structural defect.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SECTIONS } from "./runner.js";

test("SECTIONS is a non-empty array of section descriptors", () => {
  assert.ok(Array.isArray(SECTIONS), "SECTIONS must be an array");
  assert.ok(SECTIONS.length > 0, "SECTIONS must not be empty");
  for (const s of SECTIONS) {
    assert.equal(typeof s.id, "string", "section.id must be a string");
    assert.equal(typeof s.title, "string", "section.title must be a string");
    assert.ok(Array.isArray(s.tests), `section ${s.id} must have a tests array`);
  }
});

test("every test in every section has the required shape", () => {
  for (const section of SECTIONS) {
    for (const t of section.tests) {
      assert.equal(typeof t.id, "string",
        `${section.id}: every test needs a string id, got ${typeof t.id}`);
      assert.match(t.id, /^\d+\.\d+\.[a-z]$/,
        `${section.id}: test id ${t.id} should match N.N.x (was: ${t.id})`);
      assert.equal(typeof t.requirement, "string",
        `${section.id} ${t.id}: requirement must be a string`);
      assert.equal(typeof t.run, "function",
        `${section.id} ${t.id}: run must be a function`);
    }
  }
});

test("section ids are unique", () => {
  const seen = new Set();
  for (const s of SECTIONS) {
    assert.ok(!seen.has(s.id), `duplicate section id: ${s.id}`);
    seen.add(s.id);
  }
});

test("test ids are globally unique across sections", () => {
  const seen = new Map();
  for (const section of SECTIONS) {
    for (const t of section.tests) {
      if (seen.has(t.id)) {
        assert.fail(`duplicate test id ${t.id}: appears in ${seen.get(t.id)} and ${section.id}`);
      }
      seen.set(t.id, section.id);
    }
  }
});
