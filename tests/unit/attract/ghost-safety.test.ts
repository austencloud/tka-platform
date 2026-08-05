/**
 * Static guards on the presenter's safety layers and its annotation contract
 * (spec: 2026-08-04-ghost-mind-design.md §Testing, rows 3, 5, 6).
 *
 * These are grep-shaped on purpose. They protect the two properties that
 * actually keep a laptop safe in front of strangers — default-deny pressing
 * and an unreachable denylist — without rendering 26 modules.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  DENIED_MODULES,
  isDeniedModule,
  isDeniedPath,
  safe,
} from "$lib/shared/attract/domain/annotations";
import { EMPTY_WORLD, type GhostContext } from "$lib/shared/attract/domain/intention";
import { createMemory } from "$lib/shared/attract/domain/scoring";
import { createRng } from "$lib/shared/attract/services/rng";
import { createTrail } from "$lib/shared/attract/services/trail";
import { ALL_INTENTIONS } from "$lib/shared/attract/intentions";

const INTENTIONS_DIR = "src/lib/shared/attract/intentions";

/** Comments explain the banned patterns by name, so match CODE only. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function intentionSources(): { file: string; source: string }[] {
  return readdirSync(INTENTIONS_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({
      file: f,
      source: stripComments(readFileSync(join(INTENTIONS_DIR, f), "utf8")),
    }));
}

describe("ghost safety", () => {
  it("has no intention that thinks it can act in an empty world", () => {
    // A `can` that is true against nothing is a lying precondition, and a
    // lying precondition is the single thing that makes the ghost look broken.
    // `overwhelmed` is the deliberate exception: it presses nothing at all.
    const ctx: GhostContext = {
      ...EMPTY_WORLD,
      ...createMemory(createRng(1), createTrail(() => 0)),
    };

    const optimistic = ALL_INTENTIONS.filter((i) => i.can(ctx)).map((i) => i.id);
    expect(optimistic).toEqual(["overwhelmed"]);
  });

  it("gives every intention a unique id", () => {
    const ids = ALL_INTENTIONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every appeal inside 0..1 across a spread of worlds", () => {
    const worlds: Partial<typeof EMPTY_WORLD>[] = [
      {},
      { hasSequence: true, sequenceLength: 1 },
      { hasSequence: true, sequenceLength: 12, isPlaying: true },
      { hasSequence: true, sequenceLength: 40, activeEffectIds: ["fire"] },
    ];
    for (const world of worlds) {
      const ctx: GhostContext = {
        ...EMPTY_WORLD,
        ...world,
        ...createMemory(createRng(3), createTrail(() => 0)),
      };
      ctx.moduleDwellMs = 600_000; // long past the restlessness ceiling
      for (const intention of ALL_INTENTIONS) {
        const appeal = intention.appeal(ctx);
        expect(
          appeal,
          `${intention.id} appeal out of range: ${appeal}`,
        ).toBeGreaterThanOrEqual(0);
        expect(appeal).toBeLessThanOrEqual(1);
      }
    }
  });

  it("refuses the denied routes by module id and by path", () => {
    for (const moduleId of DENIED_MODULES) {
      expect(isDeniedModule(moduleId)).toBe(true);
      expect(isDeniedPath(`/${moduleId}`)).toBe(true);
      expect(isDeniedPath(`/${moduleId}/anything`)).toBe(true);
    }
    expect(isDeniedModule("create")).toBe(false);
    expect(isDeniedPath("/create/construct")).toBe(false);
    // A module whose name merely starts with a denied one is not denied.
    expect(isDeniedPath("/adminsomething")).toBe(false);
  });

  it("presses only through the allowlist — no raw selectors in the bag", () => {
    // Every query in an intention must route through safe()/the two sidebar
    // constants. A bare class or testid selector would bypass default-deny.
    // Allowed: a literal [data-ghost…] selector, or a template that starts
    // from safe(). Anything else is a raw class/testid and bypasses the gate.
    const forbidden = /waitFor\(\s*["'`](?!\[data-ghost|\$\{safe\()/;
    for (const { file, source } of intentionSources()) {
      const offenders = source
        .split("\n")
        .map((line, i) => ({ line, n: i + 1 }))
        .filter(({ line }) => forbidden.test(line));
      expect(offenders, `${file} queries outside the allowlist`).toEqual([]);
    }
  });

  it("only ever navigates by pressing — no goto/switchModule in the bag", () => {
    for (const { file, source } of intentionSources()) {
      expect(source, `${file} navigates programmatically`).not.toMatch(
        /\bgoto\(|switchModule|location\.(href|assign|replace)/,
      );
    }
  });

  it("never moves the URL behind the module system's back", () => {
    // history.back() and goto() change the URL while the module system carries
    // on believing it is elsewhere, and the shell then renders an EMPTY screen
    // until a human clicks a module. Escaping goes through the injected
    // escapeHatch, which performs a real module switch.
    const sources = [
      ...intentionSources(),
      {
        file: "PresenterHost.svelte",
        source: stripComments(
          readFileSync(
            "src/lib/shared/attract/components/PresenterHost.svelte",
            "utf8",
          ),
        ),
      },
    ];
    for (const { file, source } of sources) {
      expect(source, `${file} moves the URL directly`).not.toMatch(
        /history\.(back|forward|go|pushState|replaceState)\(|\bgoto\(/,
      );
    }
  });

  it("builds allowlist selectors that require both attributes", () => {
    expect(safe("option")).toBe('[data-ghost="safe"][data-ghost-kind="option"]');
  });
});

describe("annotation integrity", () => {
  const svelteFiles: string[] = [];
  (function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".svelte")) svelteFiles.push(path);
    }
  })("src/lib");

  it("never annotates a kind without also marking it safe", () => {
    // data-ghost-kind alone is invisible to the presenter, which is a silent
    // no-op rather than an error — this catches the half-done annotation.
    const offenders = svelteFiles.filter((path) => {
      const source = readFileSync(path, "utf8");
      if (!source.includes("data-ghost-kind")) return false;
      return !source.includes('data-ghost="safe"') && !source.includes("data-ghost=");
    });
    expect(offenders).toEqual([]);
  });

  it("puts every data-ghost-linger on an element that is also annotated", () => {
    const offenders = svelteFiles.filter((path) => {
      const source = readFileSync(path, "utf8");
      return source.includes("data-ghost-linger") && !source.includes("data-ghost-kind");
    });
    expect(offenders).toEqual([]);
  });

  it("never annotates a control inside a denied module's feature folder", () => {
    // Layer 1 and layer 2 must not contradict each other: a pressable control
    // annotated inside /admin would be reachable the moment a route slipped.
    const offenders = svelteFiles.filter(
      (path) =>
        /[\\/]features[\\/](admin|feedback)[\\/]/.test(path) &&
        readFileSync(path, "utf8").includes('data-ghost="safe"'),
    );
    expect(offenders).toEqual([]);
  });
});
