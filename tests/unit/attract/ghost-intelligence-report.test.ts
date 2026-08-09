/**
 * The intelligence measurement harness.
 *
 * Not a contract — an instrument. It runs long sessions and writes one JSON
 * file of behavioural metrics so a change to the Ghost's mind can be argued
 * with numbers instead of vibes. Run it before a change and after, with the
 * same session count and length, then diff the two files.
 *
 *   GHOST_REPORT=1 GHOST_REPORT_LABEL=before pnpm exec vitest run \
 *     --environment jsdom tests/unit/attract/ghost-intelligence-report.test.ts
 *
 * The headline metric is WASTE: a step that landed, was not a perception, and
 * changed nothing observable in the world. A ghost that is learning should
 * waste less in the back half of a session than the front half, and a smarter
 * ghost should waste less overall. Everything else is there to explain why the
 * waste number moved — or to catch it moving for a bad reason (fewer wasted
 * steps because it stopped doing anything at all is not an improvement).
 *
 * Seeds do not survive a change to the mind: any edit shifts RNG consumption,
 * so seed 7 after is a different session from seed 7 before. That is why this
 * reports DISTRIBUTIONS over many sessions rather than a single replay.
 */

import { describe, expect, it, vi } from "vitest";

// jsdom has no layout, so the real visibility sensors reject every element and
// the ghost finds nothing to do. Same mock the fleet uses — without it every
// session dies after the first press.
vi.mock("$lib/shared/attract/services/sensors", () => ({
  isVisible: () => true,
  visibleAll: (selector: string) => [
    ...document.querySelectorAll<HTMLElement>(selector),
  ],
  createSensors: () => ({ sense: () => ({}) }),
  readRoute: () => ({ moduleId: null, tabId: null }),
}));

import { mkdirSync, writeFileSync } from "node:fs";
import { runSession, type SessionRecord } from "./sim/run-session";

const ENABLED = !!process.env.GHOST_REPORT;
const LABEL = process.env.GHOST_REPORT_LABEL ?? "run";
const SESSIONS = Number(process.env.GHOST_REPORT_SESSIONS ?? 10);
const DECISIONS = Number(process.env.GHOST_REPORT_DECISIONS ?? 900);

/** Did this step move ANYTHING in the app — drawer, overlay, filter, playback? */
function changedWorld(current: SessionRecord, previous: SessionRecord): boolean {
  return (
    current.fingerprint !== previous.fingerprint ||
    current.presentationRevision !== previous.presentationRevision
  );
}

/** Did this step change something the audience is actually looking at? */
function changedVisibly(
  current: SessionRecord,
  previous: SessionRecord
): boolean {
  return (
    current.seqLen !== previous.seqLen ||
    current.word !== previous.word ||
    current.effects !== previous.effects ||
    current.presentationRevision !== previous.presentationRevision
  );
}

interface WasteSlice {
  actions: number;
  wasted: number;
  rate: number;
}

function wasteOf(log: SessionRecord[], from: number, to: number): WasteSlice {
  let actions = 0;
  let wasted = 0;
  for (let index = Math.max(1, from); index < to; index++) {
    const record = log[index]!;
    if (!record.ok || record.operation === "perceive") continue;
    actions += 1;
    if (!changedWorld(record, log[index - 1]!)) wasted += 1;
  }
  return { actions, wasted, rate: actions ? wasted / actions : 0 };
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function round(value: number, places = 4): number {
  return Number(value.toFixed(places));
}

describe.skipIf(!ENABLED)("ghost intelligence report", () => {
  it(
    "measures long sessions and writes the metrics file",
    { timeout: 30 * 60_000 },
    async () => {
      const sessions = [];

      for (let index = 0; index < SESSIONS; index++) {
        const seed = 1000 + index * 37;
        document.body.innerHTML = "";
        const session = runSession(seed, DECISIONS);
        await session.run();

        const log = session.log;
        const memory = session.mind.memory;
        const experience = memory.experience;
        const half = Math.floor(log.length / 2);

        const overall = wasteOf(log, 1, log.length);
        const early = wasteOf(log, 1, half);
        const late = wasteOf(log, half, log.length);

        // Landed, not a perception, and nothing the audience can see moved.
        let visibleActions = 0;
        let invisibleActions = 0;
        for (let i = 1; i < log.length; i++) {
          const record = log[i]!;
          if (!record.ok || record.operation === "perceive") continue;
          visibleActions += 1;
          if (!changedVisibly(record, log[i - 1]!)) invisibleActions += 1;
        }

        // Which intentions burn turns without moving the world, and how often.
        const byIntention: Record<string, { tried: number; wasted: number }> =
          {};
        for (let i = 1; i < log.length; i++) {
          const record = log[i]!;
          if (!record.ok || record.operation === "perceive") continue;
          const entry = (byIntention[record.intentionId] ??= {
            tried: 0,
            wasted: 0,
          });
          entry.tried += 1;
          if (!changedWorld(record, log[i - 1]!)) entry.wasted += 1;
        }

        const completed = [...memory.activities.completed.values()].reduce(
          (total, count) => total + count,
          0
        );
        const abandoned = [...memory.activities.abandoned.values()].reduce(
          (total, count) => total + count,
          0
        );
        const episodes = experience.episodes;
        const earlyEpisodes = episodes.slice(0, 30);
        const lateEpisodes = episodes.slice(-30);

        sessions.push({
          seed,
          decisions: log.length,
          minutes: round((log.at(-1)?.t ?? 0) / 60_000, 1),
          presses: session.app.presses.length,
          failedPerforms: log.filter((record) => !record.ok).length,
          idleTicks: session.telemetry.idleTicks,

          waste: {
            actions: overall.actions,
            wasted: overall.wasted,
            rate: round(overall.rate),
            earlyRate: round(early.rate),
            lateRate: round(late.rate),
            /** Negative = the ghost got more efficient as the session ran. */
            drift: round(late.rate - early.rate),
            /** Softer bar: moved the app, but not the picture. */
            invisibleRate: round(invisibleActions / Math.max(1, visibleActions)),
          },
          wasteByIntention: byIntention,

          activities: {
            completed,
            abandoned,
            abandonRate: round(abandoned / Math.max(1, completed + abandoned)),
            stepsPerCompleted: round(overall.actions / Math.max(1, completed), 2),
          },

          episodes: {
            recorded: experience.recorded,
            retained: episodes.length,
            /** Whole activities that finished having accomplished nothing. */
            futile: episodes.filter(
              ({ evidence }) =>
                !evidence.presentationChanged &&
                !evidence.sequenceChanged &&
                !evidence.effectsChanged &&
                evidence.conceptsLearned === 0 &&
                evidence.encountersLearned === 0
            ).length,
            meanValue: round(mean(episodes.map((e) => e.value))),
            earlyMeanValue: round(mean(earlyEpisodes.map((e) => e.value))),
            lateMeanValue: round(mean(lateEpisodes.map((e) => e.value))),
            low: experience.lowValueEpisodes,
            high: experience.highValueEpisodes,
          },

          prediction: {
            initialError: round(
              experience.initialPredictionErrorTotal /
                Math.max(1, experience.initialPredictionCount)
            ),
            recentError: round(mean(lateEpisodes.map((e) => e.predictionError))),
            accurate: experience.accuratePredictions,
            confidentMisses: experience.confidentMisses,
          },

          judgment: {
            informed: experience.informedSelections,
            boosted: experience.boostedSelections,
            reduced: experience.reducedSelections,
            exploratory: experience.exploratorySelections,
            counterfactual: experience.counterfactualSelections,
            divergences: experience.counterfactualDivergences,
            suppressed: experience.suppressedFutures,
          },
        });
      }

      const aggregate = {
        label: LABEL,
        sessions: SESSIONS,
        decisionsRequested: DECISIONS,
        wasteRate: round(mean(sessions.map((s) => s.waste.rate))),
        wasteEarly: round(mean(sessions.map((s) => s.waste.earlyRate))),
        wasteLate: round(mean(sessions.map((s) => s.waste.lateRate))),
        wasteDrift: round(mean(sessions.map((s) => s.waste.drift))),
        sessionsThatImproved: sessions.filter((s) => s.waste.drift < 0).length,
        invisibleRate: round(mean(sessions.map((s) => s.waste.invisibleRate))),
        futileEpisodeRate: round(
          mean(sessions.map((s) => s.episodes.futile / Math.max(1, s.episodes.retained)))
        ),
        abandonRate: round(mean(sessions.map((s) => s.activities.abandonRate))),
        stepsPerCompleted: round(
          mean(sessions.map((s) => s.activities.stepsPerCompleted)),
          2
        ),
        meanEpisodeValue: round(mean(sessions.map((s) => s.episodes.meanValue))),
        episodeValueDrift: round(
          mean(
            sessions.map((s) => s.episodes.lateMeanValue - s.episodes.earlyMeanValue)
          )
        ),
        predictionErrorInitial: round(
          mean(sessions.map((s) => s.prediction.initialError))
        ),
        predictionErrorRecent: round(
          mean(sessions.map((s) => s.prediction.recentError))
        ),
        totalPresses: sessions.reduce((total, s) => total + s.presses, 0),
        totalFailedPerforms: sessions.reduce(
          (total, s) => total + s.failedPerforms,
          0
        ),
        meanDecisions: round(mean(sessions.map((s) => s.decisions)), 1),
      };

      mkdirSync("test-results", { recursive: true });
      writeFileSync(
        `test-results/ghost-intel-${LABEL}.json`,
        JSON.stringify({ aggregate, sessions }, null, 2)
      );
      console.log(`GHOST_INTEL ${JSON.stringify(aggregate)}`);

      // The instrument itself must be sound: no session may be a dud, or the
      // averages describe a ghost that was not running.
      expect(sessions.every((s) => s.decisions > 100)).toBe(true);
      expect(aggregate.totalFailedPerforms).toBe(0);
    }
  );
});
