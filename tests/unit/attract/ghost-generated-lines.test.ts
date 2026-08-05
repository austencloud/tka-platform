/**
 * The generated voice pool, and the one invariant it can break
 * (spec: docs/superpowers/specs/2026-08-05-ghost-presence-design.md).
 *
 * Generated lines are checked-in data written by a model
 * (scripts/generate-ghost-lines.mjs). The script validates them once, at
 * generation time, on a machine that may not be the one that ships. These tests
 * are the standing check — they run against whatever is actually committed, so
 * a hand-edit, a merge, or a regeneration under a changed prompt cannot quietly
 * put a bad line in front of strangers.
 *
 * The one that matters is the {target} placeholder. A line that NAMES a control
 * must carry the placeholder so the runtime substitutes the control the
 * intention already resolved. A generated line with a control name baked into
 * it would say one thing while the perform pressed another — which is exactly
 * 3b912bbc97, the bug Austen caught live: "he keeps saying I wonder what side
 * by side is and then not clicking side by side."
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATED_LINES } from "$lib/shared/attract/intentions/generated-lines";

const INTENTIONS_DIR = path.resolve("src/lib/shared/attract/intentions");

const slots = Object.entries(GENERATED_LINES);
const allLines = slots.flatMap(([slot, lines]) =>
  lines.map((line) => ({ slot, line })),
);

/** Slots whose pool is written as templates naming a control. */
const templateSlots = slots
  .filter(([, lines]) => lines.some((l) => l.includes("{target}")))
  .map(([slot]) => slot);

function intentionSources(): string {
  return fs
    .readdirSync(INTENTIONS_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "generated-lines.ts")
    .map((f) => fs.readFileSync(path.join(INTENTIONS_DIR, f), "utf-8"))
    .join("\n");
}

describe("the {target} invariant", () => {
  it("uses the placeholder consistently within a slot", () => {
    // A pool that mixes templated and bare lines means a control-naming moment
    // sometimes names nothing — the caller substitutes on every line or none.
    for (const [slot, lines] of slots) {
      const withPlaceholder = lines.filter((l) => l.includes("{target}")).length;
      expect(
        withPlaceholder === 0 || withPlaceholder === lines.length,
        `${slot}: ${withPlaceholder}/${lines.length} lines carry {target}`,
      ).toBe(true);
    }
  });

  it("never carries the placeholder more than once in a line", () => {
    // voicedAbout replaces every occurrence, so two placeholders would name the
    // same control twice in one sentence.
    for (const { slot, line } of allLines) {
      const count = (line.match(/\{target\}/g) ?? []).length;
      expect(count, `${slot}: ${line}`).toBeLessThanOrEqual(1);
    }
  });

  it("routes every template slot through voicedAbout, never plain voiced", () => {
    // THE guard. `voiced()` does not substitute, so a template slot read
    // through it renders the literal text "{target}" on screen — in front of
    // whoever is standing there.
    const source = intentionSources();
    for (const slot of templateSlots) {
      const plain = new RegExp(`\\bvoiced\\(\\s*ctx\\s*,\\s*["']${slot}["']`);
      expect(
        plain.test(source),
        `${slot} has {target} lines but is read with voiced() — use voicedAbout()`,
      ).toBe(false);
      expect(
        source.includes(`voicedAbout(ctx, "${slot}"`),
        `${slot} has {target} lines but no voicedAbout() call site`,
      ).toBe(true);
    }
  });

  it("leaves no stray placeholder syntax", () => {
    for (const { slot, line } of allLines) {
      const braces = line.match(/\{[^}]*\}/g) ?? [];
      for (const brace of braces) {
        expect(brace, `${slot}: unknown placeholder in "${line}"`).toBe("{target}");
      }
    }
  });
});

describe("the lines are speakable", () => {
  it("fits the caption's two-line clamp", () => {
    // ThoughtCaption clamps at two lines and ellipsizes. A line that overflows
    // reads as the ghost trailing off mid-thought.
    for (const { slot, line } of allLines) {
      expect(line.length, `${slot}: ${line}`).toBeLessThanOrEqual(78);
    }
  });

  it("carries no ai-isms or enthusiasm", () => {
    // feedback_no_aiisms. The generator filters these, but the pool is data and
    // data gets hand-edited.
    const banned =
      /\b(amazing|gorgeous|stunning|beautiful|awesome|incredible|seamless|unlock|elevate|delve|so cool|love this)\b/i;
    for (const { slot, line } of allLines) {
      expect(banned.test(line), `${slot}: ${line}`).toBe(false);
      expect(line.includes("!"), `${slot}: ${line}`).toBe(false);
    }
  });

  it("has no duplicates inside a slot", () => {
    for (const [slot, lines] of slots) {
      const lowered = lines.map((l) => l.toLowerCase().trim());
      expect(new Set(lowered).size, `${slot} repeats a line`).toBe(lines.length);
    }
  });
});

describe("the pool is additive", () => {
  it("survives being empty", () => {
    // The whole point of generating offline into a checked-in file: delete it
    // and the presenter still works on its hand-written lines. Nothing may
    // depend on a slot being populated.
    expect(() => Object.keys(GENERATED_LINES)).not.toThrow();
  });

  it("only names slots that a call site actually reads", () => {
    // A pool nobody reads is dead weight that still looks like coverage.
    const source = intentionSources();
    for (const [slot] of slots) {
      expect(
        source.includes(`"${slot}"`),
        `${slot} has generated lines but no voiced()/voicedAbout() call site`,
      ).toBe(true);
    }
  });
});
