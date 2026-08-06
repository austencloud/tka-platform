/**
 * The fleet — many sessions at once, for the patterns one session cannot show.
 *
 * A single transcript answers "what did it do". It cannot answer "what does it
 * USUALLY do", and the difference matters because selection is weighted-random:
 * every number in a one-session report carries seed noise, and tuning against
 * one run is fitting the ghost to a coin flip. Three findings need a fleet:
 *
 *   1. Intentions that NEVER fire. An intention that loses on every seed is
 *      dead code wearing a personality, and it is invisible from one run where
 *      it merely happened not to come up.
 *   2. Variance. "Peak sequence 16" means nothing without knowing whether the
 *      spread is 14-18 or 4-28.
 *   3. Rare disasters. A trap that strands the ghost on one seed in twenty is
 *      a four-hour jam ruined, and a single run finds it one time in twenty.
 *
 * Env-gated (`GHOST_FLEET=1`) because it runs tens of sessions; CI runs the
 * single-session contract instead. Writes test-results/ghost-fleet.md.
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

import { ALL_INTENTIONS } from "$lib/shared/attract/intentions";
import {
  CONCEPTS,
  type ConceptId,
} from "$lib/shared/attract/domain/intention";
import { analyze, runSession } from "./sim/run-session";

const SESSIONS = Number(process.env.GHOST_FLEET_SESSIONS ?? 60);
const TICKS = Number(process.env.GHOST_FLEET_TICKS ?? 400);

interface FleetRow {
  seed: number;
  decisions: number;
  /** Ticks that produced no decision at all — the ghost standing there. */
  deadTicks: number;
  peakSeqLen: number;
  clears: number;
  longestBuildRun: number;
  failures: number;
  byIntention: Map<string, number>;
  moduleShare: Map<string, number>;
  concepts: Map<ConceptId, string>;
  /** Module visits where it did nothing but navigate away. */
  emptyVisits: number;
  visits: number;
}

async function flyFleet(): Promise<FleetRow[]> {
  const rows: FleetRow[] = [];
  for (let i = 0; i < SESSIONS; i++) {
    const seed = 1000 + i * 7;
    document.body.innerHTML = "";
    const session = runSession(seed, TICKS);
    await session.run();
    const stats = analyze(
      session.log,
      session.app.state.peakSeqLen,
      session.mind.memory.concepts,
    );

    // Module visits, grouped by module id only — the tab suffix would split a
    // single stay in `create` into several phantom visits.
    let visits = 0;
    let emptyVisits = 0;
    let current: string | null = null;
    let actions = 0;
    for (const r of session.log) {
      const mod = (r.moduleId ?? "none").split("/")[0]!;
      if (mod !== current) {
        if (current !== null) {
          visits++;
          if (actions === 0) emptyVisits++;
        }
        current = mod;
        actions = 0;
      }
      if (r.intentionId !== "go-to-module") actions++;
    }
    if (current !== null) {
      visits++;
      if (actions === 0) emptyVisits++;
    }

    const moduleShare = new Map<string, number>();
    for (const [key, n] of stats.moduleTicks) {
      const mod = key.split("/")[0]!;
      moduleShare.set(mod, (moduleShare.get(mod) ?? 0) + n);
    }

    rows.push({
      seed,
      decisions: stats.decisions,
      deadTicks: TICKS - stats.decisions,
      peakSeqLen: stats.peakSeqLen,
      clears: stats.seqLenAtClear.length,
      longestBuildRun: stats.longestBuildRun,
      failures: stats.failures,
      byIntention: stats.byIntention,
      moduleShare,
      concepts: new Map(stats.concepts),
      emptyVisits,
      visits,
    });
  }
  return rows;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

function fleetReport(rows: FleetRow[]): string {
  const ids = ALL_INTENTIONS.map((i) => i.id);
  const totals = new Map<string, number>();
  const sessionsFired = new Map<string, number>();
  for (const id of ids) {
    totals.set(id, 0);
    sessionsFired.set(id, 0);
  }
  for (const r of rows) {
    for (const id of ids) {
      const n = r.byIntention.get(id) ?? 0;
      totals.set(id, totals.get(id)! + n);
      if (n > 0) sessionsFired.set(id, sessionsFired.get(id)! + 1);
    }
  }
  const allDecisions = sum(rows.map((r) => r.decisions));

  const modules = new Set<string>();
  for (const r of rows) for (const m of r.moduleShare.keys()) modules.add(m);

  const dist = (label: string, xs: number[]) =>
    `| ${label} | ${mean(xs).toFixed(1)} | ${quantile(xs, 0.1)} | ${quantile(xs, 0.5)} | ${quantile(xs, 0.9)} | ${Math.min(...xs)} | ${Math.max(...xs)} |`;

  return [
    `# Ghost fleet — ${rows.length} sessions x ${TICKS} ticks`,
    ``,
    `## Distributions (mean, p10, p50, p90, min, max)`,
    ``,
    `| measure | mean | p10 | p50 | p90 | min | max |`,
    `|---|---|---|---|---|---|---|`,
    dist("decisions per session", rows.map((r) => r.decisions)),
    dist("dead ticks (nothing to do)", rows.map((r) => r.deadTicks)),
    dist("peak sequence length", rows.map((r) => r.peakSeqLen)),
    dist("clears", rows.map((r) => r.clears)),
    dist("longest build run", rows.map((r) => r.longestBuildRun)),
    dist("failed performs", rows.map((r) => r.failures)),
    dist("module visits", rows.map((r) => r.visits)),
    dist("visits doing nothing", rows.map((r) => r.emptyVisits)),
    ``,
    `## Intentions — how often, and in how many sessions`,
    ``,
    `| intention | total | share | sessions firing |`,
    `|---|---|---|---|`,
    ...ids
      .map((id) => ({
        id,
        n: totals.get(id)!,
        s: sessionsFired.get(id)!,
      }))
      .sort((a, b) => b.n - a.n)
      .map(
        (r) =>
          `| ${r.id} | ${r.n} | ${((r.n / allDecisions) * 100).toFixed(2)}% | ${r.s}/${rows.length} |`,
      ),
    ``,
    `## Where the time goes`,
    ``,
    `| module | share |`,
    `|---|---|`,
    ...[...modules]
      .map((m) => ({
        m,
        n: sum(rows.map((r) => r.moduleShare.get(m) ?? 0)),
      }))
      .sort((a, b) => b.n - a.n)
      .map((r) => `| ${r.m} | ${((r.n / allDecisions) * 100).toFixed(1)}% |`),
    ``,
    `## Concepts reaching each stage`,
    ``,
    `| concept | understood | confused | never met |`,
    `|---|---|---|---|`,
    ...CONCEPTS.map((c) => {
      const u = rows.filter((r) => r.concepts.get(c) === "understood").length;
      const k = rows.filter((r) => r.concepts.get(c) === "confused").length;
      return `| ${c} | ${u}/${rows.length} | ${k}/${rows.length} | ${rows.length - u - k}/${rows.length} |`;
    }),
  ].join("\n");
}

describe("ghost fleet", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it.skipIf(!process.env.GHOST_FLEET)(
    "flies a fleet and reports the aggregate",
    async () => {
      const rows = await flyFleet();
      const text = fleetReport(rows);
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync("test-results", { recursive: true });
      writeFileSync("test-results/ghost-fleet.md", text, "utf8");
      console.log(text);

      // An intention that never wins on ANY seed is dead code wearing a
      // personality. This is the finding a fleet exists for.
      const never = ALL_INTENTIONS.filter((i) =>
        rows.every((r) => (r.byIntention.get(i.id) ?? 0) === 0),
      ).map((i) => i.id);
      expect(never, "intentions that never fired in any session").toEqual([]);

      // No session may end up unable to act. A ghost with nothing to do is a
      // ghost standing still in front of strangers.
      const stranded = rows.filter((r) => r.decisions < TICKS * 0.2);
      expect(
        stranded.map((r) => r.seed),
        "sessions where the ghost was idle for most of its ticks",
      ).toEqual([]);
    },
    600_000,
  );
});
