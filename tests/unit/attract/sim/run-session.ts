/**
 * The session runner, shared by the single-session simulator and the fleet.
 *
 * Extracted so that a 60-session sweep and a one-session transcript are
 * guaranteed to be measuring the same thing — a fleet built on a second,
 * drifting copy of the harness would report averages of a different ghost.
 */

import { createGhostMind } from "$lib/shared/attract/services/mind.svelte";
import { createRng } from "$lib/shared/attract/services/rng";
import { ALL_INTENTIONS } from "$lib/shared/attract/intentions";
import { setEscapeHatch } from "$lib/shared/attract/intentions/explore";
import {
  EMPTY_WORLD,
  type ConceptId,
  type GhostWorld,
  type UnderstandingStage,
} from "$lib/shared/attract/domain/intention";
import { safe, type GhostKind } from "$lib/shared/attract/domain/annotations";
import { createSimApp, SIM_MODULES } from "./app-model";
import { createFakeGhost } from "./fake-ghost";

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

export function runSession(seed: number, decisions: number) {
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
      sequenceWord:
        app.state.seqLen > 0
          ? `${"ABDGPSWX".slice(0, Math.min(8, app.state.seqLen))}${app.state.word}`
          : null,
      isPlaying: app.playing(),
      activeEffectIds: [...app.state.activeEffects],
      viewerOpen: app.state.viewerOpen,
      pickerOpen: available.option > 0 || available["start-position"] > 0,
      reachableModules: [...SIM_MODULES],
      available,
      cameraGranted: true,
      cameraLive: app.state.mirrorOn,
      // Read from the DOM, like the real sensor. The fleet found `linger`
      // firing in 0 of 60 sessions because the harness never offered it
      // anything to linger over — and the first fix INVENTED the count without
      // rendering the element, which is a lying precondition: 243 failed
      // performs in a single session.
      lingerCount: document.querySelectorAll("[data-ghost-linger]").length,
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

export interface Stats {
  decisions: number;
  minutes: number;
  byIntention: Map<string, number>;
  byCategory: Map<string, number>;
  moduleTicks: Map<string, number>;
  peakSeqLen: number;
  seqLenAtClear: number[];
  longestBuildRun: number;
  failures: number;
  concepts: Map<ConceptId, UnderstandingStage>;
}

export function analyze(
  log: SessionRecord[],
  peak: number,
  concepts: Map<ConceptId, UnderstandingStage> = new Map(),
): Stats {
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
    concepts,
  };
}
