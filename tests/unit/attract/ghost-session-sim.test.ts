/**
 * Session simulator — watch the presenter for a few hundred decisions and
 * write down what it actually did.
 *
 * Austen (2026-08-05): "he'll set a turn value and say I wonder let's see what
 * turns but then he won't apply an option, or he'll apply one option and then
 * he'll play it and then he'll clear the sequence. He won't build a whole
 * sequence... I'm not even seeing him mess with generate."
 *
 * Those are claims about decision ORDER, and decision order is produced by
 * `appeal x novelty x freshness x momentum` against a set of preconditions —
 * no pixels involved. So this runs the REAL mind, the REAL scoring and the REAL
 * intention bag against a simulated app (sim/app-model.ts) on a virtual clock,
 * and reports the session the way you would judge a stranger using the app.
 *
 * The assertions below are the personality contract. They are deliberately
 * about behaviour a person would notice from across a room, not about
 * implementation.
 *
 * `GHOST_SIM_REPORT=1` writes the full transcript to
 * `test-results/ghost-session.md`.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("$lib/shared/attract/services/sensors", () => ({
  isVisible: () => true,
  visibleAll: (selector: string) => [
    ...document.querySelectorAll<HTMLElement>(selector),
  ],
  createSensors: () => ({ sense: () => ({}) }),
  readRoute: () => ({ moduleId: null, tabId: null }),
}));

import { createGhostMind } from "$lib/shared/attract/services/mind.svelte";
import { createRng } from "$lib/shared/attract/services/rng";
import { ALL_INTENTIONS } from "$lib/shared/attract/intentions";
import { setEscapeHatch } from "$lib/shared/attract/intentions/explore";
import {
  EMPTY_WORLD,
  type GhostWorld,
} from "$lib/shared/attract/domain/intention";
import { safe, type GhostKind } from "$lib/shared/attract/domain/annotations";
import { createSimApp, SIM_MODULES } from "./sim/app-model";
import { createFakeGhost } from "./sim/fake-ghost";

const KINDS = Object.keys(EMPTY_WORLD.available) as GhostKind[];

export interface SessionRecord {
  t: number;
  intentionId: string;
  category: string;
  thought: string;
  moduleId: string | null;
  tabId: string | null;
  ok: boolean;
  seqLen: number;
  effects: number;
  playing: boolean;
}

function runSession(seed: number, decisions: number) {
  const rng = createRng(seed);
  const pick = <T,>(arr: T[]): T => rng.pick(arr) as T;
  // The app needs the clock and the clock lives on the motor, which needs the
  // app — tied together through a holder rather than by duplicating the clock.
  const clock = { now: () => 0 };
  const app = createSimApp(pick, () => clock.now());
  const fake = createFakeGhost(app, pick);
  clock.now = fake.now;

  setEscapeHatch(() => app.goTo("create", "construct"));

  // Mirrors services/sensors.ts exactly, including the two things that are easy
  // to get wrong and change everything: nav counts come from the sidebar
  // package's own selectors (they carry no data-ghost annotation), and
  // `pickerOpen` is derived from options being on screen rather than from any
  // drawer state.
  const sense = (): GhostWorld => {
    const available = { ...EMPTY_WORLD.available };
    for (const kind of KINDS) {
      available[kind] = document.querySelectorAll(safe(kind)).length;
    }
    available["nav-module"] = document.querySelectorAll(
      ".module-button[data-tour-module]",
    ).length;
    available["nav-tab"] = document.querySelectorAll(".section-button").length;

    return {
      ...EMPTY_WORLD,
      moduleId: app.state.moduleId,
      tabId: app.state.tabId,
      hasSequence: app.state.seqLen > 0,
      sequenceLength: app.state.seqLen,
      sequenceWord: app.state.seqLen > 0 ? "ABDG".slice(0, app.state.seqLen) : null,
      isPlaying: app.state.isPlaying,
      activeEffectIds: [...app.state.activeEffects],
      viewerOpen: app.state.viewerOpen,
      pickerOpen: available.option > 0 || available["start-position"] > 0,
      reachableModules: [...SIM_MODULES],
      available,
      cameraGranted: true,
      cameraLive: app.state.mirrorOn,
      presenting: app.presenting(),
    };
  };

  const mind = createGhostMind({
    intentions: ALL_INTENTIONS,
    ghost: fake.ghost,
    sense,
    seed,
    now: fake.now,
  });

  const log: SessionRecord[] = [];
  let lastT = -1;

  return {
    app,
    fake,
    mind,
    log,
    run: async () => {
      for (let i = 0; i < decisions; i++) {
        await mind.tick();
        // The trail is a 200-entry ring buffer, so it cannot be replayed for a
        // long session — read only the newest entry, each tick, as it lands.
        const entries = mind.trail.entries();
        const e = entries[entries.length - 1];
        if (!e || e.t === lastT) continue;
        lastT = e.t;
        log.push({
          t: e.t,
          intentionId: e.intentionId,
          category:
            ALL_INTENTIONS.find((x) => x.id === e.intentionId)?.category ?? "?",
          thought: e.thought,
          moduleId: e.moduleId,
          tabId: app.state.tabId,
          ok: e.ok,
          seqLen: app.state.seqLen,
          effects: app.state.activeEffects.size,
          playing: app.state.isPlaying,
        });
      }
    },
  };
}

interface Stats {
  decisions: number;
  minutes: number;
  byIntention: Map<string, number>;
  byCategory: Map<string, number>;
  moduleTicks: Map<string, number>;
  peakSeqLen: number;
  seqLenAtClear: number[];
  longestBuildRun: number;
  failures: number;
}

function analyze(log: SessionRecord[], peak: number): Stats {
  const byIntention = new Map<string, number>();
  const byCategory = new Map<string, number>();
  const moduleTicks = new Map<string, number>();
  const seqLenAtClear: number[] = [];
  let longestBuildRun = 0;
  let run = 0;
  let prevLen = 0;

  for (const r of log) {
    byIntention.set(r.intentionId, (byIntention.get(r.intentionId) ?? 0) + 1);
    byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
    const key = `${r.moduleId ?? "none"}${r.tabId ? "/" + r.tabId : ""}`;
    moduleTicks.set(key, (moduleTicks.get(key) ?? 0) + 1);

    if (r.intentionId === "add-step" || r.intentionId === "pick-start") {
      run += 1;
      longestBuildRun = Math.max(longestBuildRun, run);
    } else if (r.intentionId !== "filter-continuous") {
      run = 0;
    }
    if (r.seqLen === 0 && prevLen > 0) seqLenAtClear.push(prevLen);
    prevLen = r.seqLen;
  }

  return {
    decisions: log.length,
    minutes: log.length ? Math.round(log[log.length - 1]!.t / 60000) : 0,
    byIntention,
    byCategory,
    moduleTicks,
    peakSeqLen: peak,
    seqLenAtClear,
    longestBuildRun,
    failures: log.filter((r) => !r.ok).length,
  };
}

function report(stats: Stats, log: SessionRecord[]): string {
  const rank = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `| ${k} | ${v} | ${((v / stats.decisions) * 100).toFixed(1)}% |`)
      .join("\n");

  return [
    `# Ghost session — ${stats.decisions} decisions over ~${stats.minutes} simulated minutes`,
    ``,
    `- peak sequence length: **${stats.peakSeqLen}**`,
    `- longest unbroken run of building: **${stats.longestBuildRun}**`,
    `- sequence length when cleared: ${stats.seqLenAtClear.join(", ") || "never cleared"}`,
    `- failed performs: ${stats.failures}`,
    ``,
    `## By intention`,
    ``,
    `| intention | n | share |`,
    `|---|---|---|`,
    rank(stats.byIntention),
    ``,
    `## By category`,
    ``,
    `| category | n | share |`,
    `|---|---|---|`,
    rank(stats.byCategory),
    ``,
    `## Where it spent its time`,
    ``,
    `| module | ticks | share |`,
    `|---|---|---|`,
    rank(stats.moduleTicks),
    ``,
    `## First 80 decisions`,
    ``,
    ...log
      .slice(0, 80)
      .map(
        (r) =>
          `${String(Math.round(r.t / 1000)).padStart(4)}s  [${r.moduleId ?? "-"}${
            r.tabId ? "/" + r.tabId : ""
          }] len=${r.seqLen} fx=${r.effects}  ${r.intentionId}${r.ok ? "" : " (FAILED)"} — "${r.thought}"`,
      ),
  ].join("\n");
}

describe("ghost session simulation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("plays a long session and reports what it did", async () => {
    const session = runSession(7, 400);
    await session.run();
    const stats = analyze(session.log, session.app.state.peakSeqLen);
    const text = report(stats, session.log);

    if (process.env.GHOST_SIM_REPORT) {
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync("test-results", { recursive: true });
      writeFileSync("test-results/ghost-session.md", text, "utf8");
    }
    // Always visible in the run output — this file exists to be read.
    console.log(text);

    expect(stats.decisions).toBeGreaterThan(100);
  });

  it("builds sequences a person would recognise as sequences", async () => {
    const session = runSession(11, 300);
    await session.run();
    // A presenter that never gets past three steps is demonstrating a
    // start-position picker, not a composer.
    expect(session.app.state.peakSeqLen).toBeGreaterThanOrEqual(6);
  });

  it("spends real time in generate, not just construct", async () => {
    const session = runSession(23, 300);
    await session.run();
    const stats = analyze(session.log, session.app.state.peakSeqLen);
    const generate = stats.moduleTicks.get("create/generate") ?? 0;
    expect(generate / stats.decisions).toBeGreaterThan(0.05);
  });

  it("does not fiddle turns more often than it adds steps", async () => {
    const session = runSession(5, 300);
    await session.run();
    const stats = analyze(session.log, session.app.state.peakSeqLen);
    const turns = stats.byIntention.get("fiddle-turns") ?? 0;
    const steps = stats.byIntention.get("add-step") ?? 0;
    expect(turns).toBeLessThan(steps);
  });
});
