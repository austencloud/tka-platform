/**
 * Walks the configuration space and hands back a scored result per cell.
 *
 * Three things shape this runner, all of them cost.
 *
 * A settled reading takes about two seconds, so brute force is not available:
 * the run takes a coarse pass over each sequence, scores it, and spends fine
 * readings only where the coarse pass already looked suspicious. Ask for the
 * estimate before starting one — `estimateSweepCost` will tell you when the
 * answer is days.
 *
 * A long browser run does not survive the page. A Vite dependency
 * re-optimization reloads the tab and takes the run with it, which is why a
 * full sweep belongs on a production build and why every finished
 * configuration is written to a store as it completes. A reload resumes from
 * the last completed cell rather than starting over.
 *
 * And a run has to be interruptible. Progress is reported per configuration
 * and an abort signal stops the loop between readings, so the tab stays usable
 * and nobody has to kill it to get their browser back.
 */

import {
  aggregateConfiguration,
  MINIMUM_SETTLED_SAMPLES,
  type SweepConfigurationResult,
} from "./sweep-aggregation";
import {
  DEFAULT_SWEEP_PHASE_PLAN,
  planCoarsePhases,
  planRefinementPhases,
  type SweepPhasePlan,
} from "./sweep-phase-plan";
import { scoreSweepSample } from "./sweep-scoring";
import type { SweepPhaseSample } from "./sweep-sample";
import {
  DEFAULT_SETTLE_POLICY,
  readSettledPhase,
  realWait,
  type SweepRig,
  type SweepSettlePolicy,
  type SweepWait,
} from "./sweep-settling";
import {
  enumerateSweepConfigurations,
  sweepSpaceDigest,
  type SweepConfiguration,
  type SweepSpace,
} from "./sweep-space";

/**
 * The only part of a sweep that needs a rig. Everything else in this folder is
 * pure, so a batch runner outside the browser only has to implement this.
 */
export interface SweepSampler {
  /**
   * Load this body, prop, and sequence and return something readable. Return
   * null when the configuration cannot be mounted at all — a missing model,
   * a prop the scene will not render — so the cell is blocked rather than
   * silently green.
   */
  mount(
    configuration: SweepConfiguration,
    signal?: { aborted: boolean }
  ): Promise<SweepRig | null>;
  /** Tear the configuration down before the next one mounts. */
  unmount?(configuration: SweepConfiguration): void | Promise<void>;
}

export interface SweepProgress {
  completed: number;
  total: number;
  /** The configuration currently mounted, or null between cells. */
  current: SweepConfiguration | null;
  /** Result just finished, so a matrix can paint a cell without waiting. */
  lastResult: SweepConfigurationResult | null;
  elapsedMs: number;
  /** Linear projection from cells finished so far. Null before the first one. */
  estimatedRemainingMs: number | null;
}

/** Everything needed to resume a run that was interrupted. */
export interface SweepRunState {
  spaceDigest: string;
  startedAt: number;
  /** Completed results keyed by configuration key. */
  results: Record<string, SweepConfigurationResult>;
}

export interface SweepRunStore {
  load(): SweepRunState | null | Promise<SweepRunState | null>;
  save(state: SweepRunState): void | Promise<void>;
}

export interface SweepRunOptions {
  space: SweepSpace;
  sampler: SweepSampler;
  plan?: SweepPhasePlan;
  policy?: SweepSettlePolicy;
  minimumSamples?: number;
  wait?: SweepWait;
  signal?: { aborted: boolean };
  onProgress?: (progress: SweepProgress) => void;
  /** Persist after each configuration so a reload resumes rather than restarts. */
  store?: SweepRunStore;
  /** Clock seam, so a test can assert elapsed time without waiting. */
  now?: () => number;
}

export interface SweepRunReport {
  spaceDigest: string;
  results: SweepConfigurationResult[];
  /** True when the run stopped early because it was cancelled. */
  cancelled: boolean;
  completed: number;
  total: number;
  elapsedMs: number;
}

async function sampleConfiguration(
  configuration: SweepConfiguration,
  options: SweepRunOptions
): Promise<SweepConfigurationResult> {
  const plan = options.plan ?? DEFAULT_SWEEP_PHASE_PLAN;
  const policy = options.policy ?? DEFAULT_SETTLE_POLICY;
  const wait = options.wait ?? realWait;
  const now = options.now ?? (() => Date.now());
  const startedAt = now();

  const rig = await options.sampler.mount(configuration, options.signal);
  if (!rig) {
    return aggregateConfiguration(configuration, [], {
      blockedReason: "configuration could not be mounted",
      durationMs: now() - startedAt,
      minimumSamples: options.minimumSamples ?? MINIMUM_SETTLED_SAMPLES,
    });
  }

  const samples: SweepPhaseSample[] = [];
  let unsettled = 0;
  let cancelled = false;

  const readPhases = async (phases: readonly number[]) => {
    for (const phase of phases) {
      if (options.signal?.aborted) {
        cancelled = true;
        return;
      }
      const outcome = await readSettledPhase({
        rig,
        phase,
        configuredPropLengthCm: configuration.prop.lengthCm,
        policy,
        wait,
        signal: options.signal,
      });
      if (outcome.settled) samples.push(outcome.sample);
      else if (outcome.reason !== "cancelled") unsettled += 1;
      else {
        cancelled = true;
        return;
      }
    }
  };

  await readPhases(
    planCoarsePhases(configuration.sequence.stepCount, plan.coarseSamplesPerStep)
  );

  if (!cancelled) {
    const scored = samples.map((sample) => ({
      phase: sample.phase,
      score: scoreSweepSample(sample).score,
    }));
    await readPhases(
      planRefinementPhases(scored, configuration.sequence.stepCount, plan)
    );
  }

  await options.sampler.unmount?.(configuration);

  return aggregateConfiguration(configuration, samples, {
    unsettledPhases: unsettled,
    blockedReason: cancelled ? "cancelled mid-configuration" : null,
    durationMs: now() - startedAt,
    minimumSamples: options.minimumSamples ?? MINIMUM_SETTLED_SAMPLES,
  });
}

/**
 * Run the sweep. Resumes from `store` when the stored run was measured against
 * the same axes; a different space starts clean rather than mixing results
 * from two different question.
 */
export async function runSweep(
  options: SweepRunOptions
): Promise<SweepRunReport> {
  const now = options.now ?? (() => Date.now());
  const digest = sweepSpaceDigest(options.space);
  const configurations = enumerateSweepConfigurations(options.space);
  const startedAt = now();

  const restored = await options.store?.load();
  const results = new Map<string, SweepConfigurationResult>(
    restored && restored.spaceDigest === digest
      ? Object.entries(restored.results)
      : []
  );

  let cancelled = false;
  for (const configuration of configurations) {
    if (options.signal?.aborted) {
      cancelled = true;
      break;
    }
    if (results.has(configuration.key)) continue;

    options.onProgress?.({
      completed: results.size,
      total: configurations.length,
      current: configuration,
      lastResult: null,
      elapsedMs: now() - startedAt,
      estimatedRemainingMs: null,
    });

    const result = await sampleConfiguration(configuration, options);
    results.set(configuration.key, result);

    await options.store?.save({
      spaceDigest: digest,
      startedAt,
      results: Object.fromEntries(results),
    });

    const elapsedMs = now() - startedAt;
    options.onProgress?.({
      completed: results.size,
      total: configurations.length,
      current: null,
      lastResult: result,
      elapsedMs,
      estimatedRemainingMs:
        results.size > 0
          ? (elapsedMs / results.size) * (configurations.length - results.size)
          : null,
    });

    if (options.signal?.aborted) {
      cancelled = true;
      break;
    }
  }

  return {
    spaceDigest: digest,
    results: configurations
      .map((configuration) => results.get(configuration.key))
      .filter((result): result is SweepConfigurationResult => Boolean(result)),
    cancelled,
    completed: results.size,
    total: configurations.length,
    elapsedMs: now() - startedAt,
  };
}

const SWEEP_RUN_STORAGE_KEY = "__gripSweepRun";

/**
 * Browser-side persistence. `localStorage` survives the reload a Vite
 * dependency re-optimization causes, which is the failure this exists for.
 * A run large enough to exceed the quota drops its oldest results rather than
 * throwing and losing the whole run.
 */
export function createLocalSweepRunStore(
  key = SWEEP_RUN_STORAGE_KEY
): SweepRunStore {
  return {
    load() {
      if (typeof localStorage === "undefined") return null;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as SweepRunState;
      } catch {
        return null;
      }
    },
    save(state) {
      if (typeof localStorage === "undefined") return;
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        const entries = Object.entries(state.results);
        const trimmed = Object.fromEntries(entries.slice(-200));
        try {
          localStorage.setItem(
            key,
            JSON.stringify({ ...state, results: trimmed })
          );
        } catch {
          // A run too large for storage still completes in memory; it just
          // cannot be resumed after a reload.
        }
      }
    },
  };
}
