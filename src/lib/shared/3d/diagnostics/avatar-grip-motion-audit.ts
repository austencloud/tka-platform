import type {
  AvatarGripDiagnostics,
  CollisionEvent,
} from "@austencloud/scene-3d";

type Vec3 = readonly [number, number, number];

export type GripMotionSource = "target-policy" | "arm-solver" | "contact-lock";

export type GripMotionStatus =
  | "insufficient-data"
  | "authored-motion"
  | "twitching"
  | "stable";

export const AVATAR_GRIP_MOTION_STORAGE_KEY = "__avatarGripMotionReport";
export const AVATAR_GRIP_MOTION_ATTRIBUTE = "data-avatar-grip-motion-report";

const MAX_SAMPLES_PER_PERFORMER = 600;
const MIN_SETTLED_SAMPLES = 30;
const AUTHORED_STATIONARY_SPEED_MPS = 0.01;
const TWITCH_SPEED_MPS = 0.04;
const SETTLE_AFTER_AUTHORED_MOTION_MS = 200;
const MAX_VALID_FRAME_INTERVAL_MS = 100;

export const AVATAR_GRIP_MOTION_THRESHOLDS = {
  authoredStationarySpeedMps: AUTHORED_STATIONARY_SPEED_MPS,
  twitchSpeedMps: TWITCH_SPEED_MPS,
  settleAfterAuthoredMotionMs: SETTLE_AFTER_AUTHORED_MOTION_MS,
  minimumSettledSamples: MIN_SETTLED_SAMPLES,
} as const;

export interface GripMotionSpeeds {
  authored: number;
  target: number;
  wrist: number;
  palm: number;
  renderedGrip: number;
  correction: number;
}

export interface GripMotionSeparations {
  authoredGrips: number | null;
  targets: number | null;
  wrists: number | null;
  palms: number | null;
  renderedGrips: number | null;
}

export interface AvatarGripMotionSample {
  frame: number;
  timeMs: number;
  frameIntervalMs: number | null;
  stepNumber: number;
  beatProgress: number;
  settled: boolean;
  source: GripMotionSource | null;
  speeds: GripMotionSpeeds;
  separations: GripMotionSeparations;
  propOverlapDepth: number;
  authoredLeftGrip: Vec3 | null;
  authoredRightGrip: Vec3 | null;
  leftTarget: Vec3 | null;
  rightTarget: Vec3 | null;
  leftWrist: Vec3 | null;
  rightWrist: Vec3 | null;
  leftPalm: Vec3 | null;
  rightPalm: Vec3 | null;
  renderedLeftGrip: Vec3 | null;
  renderedRightGrip: Vec3 | null;
  leftCorrectionLocal: Vec3 | null;
  rightCorrectionLocal: Vec3 | null;
}

interface SpeedSummary {
  peakMps: number;
  rmsMps: number;
}

export interface PerformerGripMotionSummary {
  status: GripMotionStatus;
  sampledFrames: number;
  settledFrames: number;
  durationMs: number;
  settledDurationMs: number;
  twitchFrames: number;
  firstMovingSubsystem: GripMotionSource | null;
  sourceCounts: Record<GripMotionSource, number>;
  speeds: Record<keyof GripMotionSpeeds, SpeedSummary>;
  minimumSeparation: GripMotionSeparations;
  maximumPropOverlapDepth: number;
  maximumCorrectionDistance: number;
}

export interface PerformerGripMotionReport extends PerformerGripMotionSummary {
  samples: AvatarGripMotionSample[];
}

export interface AvatarGripMotionReport {
  thresholds: typeof AVATAR_GRIP_MOTION_THRESHOLDS;
  performers: Record<string, PerformerGripMotionReport>;
}

interface PerformerTrace {
  nextFrame: number;
  lastAuthoredMotionMs: number;
  samples: AvatarGripMotionSample[];
}

interface BrowserGripMotionHooks {
  __avatarGripMotionAudit?: AvatarGripMotionAudit;
  __captureAvatarGripMotionTrace?: (
    durationMs?: number
  ) => Promise<AvatarGripMotionReport>;
}

function copyPoint(
  point: Readonly<{ x: number; y: number; z: number }> | null
): Vec3 | null {
  return point ? [point.x, point.y, point.z] : null;
}

function distance(a: Vec3 | null, b: Vec3 | null): number | null {
  if (!a || !b) return null;
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function speed(
  current: Vec3 | null,
  previous: Vec3 | null,
  deltaSeconds: number
): number {
  if (deltaSeconds <= 0) return 0;
  const travelled = distance(current, previous);
  return travelled === null ? 0 : travelled / deltaSeconds;
}

function pairSpeed(
  currentA: Vec3 | null,
  previousA: Vec3 | null,
  currentB: Vec3 | null,
  previousB: Vec3 | null,
  deltaSeconds: number
): number {
  return Math.max(
    speed(currentA, previousA, deltaSeconds),
    speed(currentB, previousB, deltaSeconds)
  );
}

function pointMagnitude(point: Vec3 | null): number {
  return point ? Math.hypot(point[0], point[1], point[2]) : 0;
}

function summarize(values: number[]): SpeedSummary {
  if (values.length === 0) return { peakMps: 0, rmsMps: 0 };
  let peakMps = 0;
  let squaredSum = 0;
  for (const value of values) {
    peakMps = Math.max(peakMps, value);
    squaredSum += value * value;
  }
  return {
    peakMps,
    rmsMps: Math.sqrt(squaredSum / values.length),
  };
}

function minimum(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length > 0 ? Math.min(...present) : null;
}

function overlapDepth(events: readonly CollisionEvent[]): number {
  let depth = 0;
  for (const event of events) {
    if (event.zone === "prop-through-prop") {
      depth = Math.max(depth, event.penetrationDepth);
    }
  }
  return depth;
}

function classifySource(speeds: GripMotionSpeeds): GripMotionSource | null {
  if (speeds.target >= TWITCH_SPEED_MPS) return "target-policy";
  if (speeds.wrist >= TWITCH_SPEED_MPS || speeds.palm >= TWITCH_SPEED_MPS) {
    return "arm-solver";
  }
  if (
    speeds.correction >= TWITCH_SPEED_MPS ||
    speeds.renderedGrip >= TWITCH_SPEED_MPS
  ) {
    return "contact-lock";
  }
  return null;
}

function copySummary(
  summary: PerformerGripMotionSummary
): PerformerGripMotionSummary {
  return {
    ...summary,
    sourceCounts: { ...summary.sourceCounts },
    speeds: Object.fromEntries(
      Object.entries(summary.speeds).map(([name, value]) => [
        name,
        { ...value },
      ])
    ) as PerformerGripMotionSummary["speeds"],
    minimumSeparation: { ...summary.minimumSeparation },
  };
}

/** Records the exact post-IK values used to render and collision-test a frame. */
export class AvatarGripMotionAudit {
  private readonly traces = new Map<string, PerformerTrace>();
  private publishedFrameCount = 0;

  record(
    performerId: string,
    diagnostics: AvatarGripDiagnostics,
    events: readonly CollisionEvent[],
    timeMs = performance.now()
  ): void {
    let trace = this.traces.get(performerId);
    if (!trace) {
      trace = {
        nextFrame: 0,
        lastAuthoredMotionMs: timeMs,
        samples: [],
      };
      this.traces.set(performerId, trace);
    }

    const previous = trace.samples.at(-1);
    const frameIntervalMs = previous ? timeMs - previous.timeMs : null;
    const validInterval =
      frameIntervalMs !== null &&
      frameIntervalMs > 0 &&
      frameIntervalMs <= MAX_VALID_FRAME_INTERVAL_MS;
    const deltaSeconds = validInterval ? frameIntervalMs / 1000 : 0;

    const sample: AvatarGripMotionSample = {
      frame: trace.nextFrame,
      timeMs,
      frameIntervalMs,
      stepNumber: diagnostics.stepNumber,
      beatProgress: diagnostics.beatProgress,
      settled: false,
      source: null,
      speeds: {
        authored: 0,
        target: 0,
        wrist: 0,
        palm: 0,
        renderedGrip: 0,
        correction: 0,
      },
      separations: {
        authoredGrips: null,
        targets: null,
        wrists: null,
        palms: null,
        renderedGrips: null,
      },
      propOverlapDepth: overlapDepth(events),
      authoredLeftGrip: copyPoint(diagnostics.authoredBlueGrip),
      authoredRightGrip: copyPoint(diagnostics.authoredRedGrip),
      leftTarget: copyPoint(diagnostics.leftTarget),
      rightTarget: copyPoint(diagnostics.rightTarget),
      leftWrist: copyPoint(diagnostics.leftWrist),
      rightWrist: copyPoint(diagnostics.rightWrist),
      leftPalm: copyPoint(diagnostics.leftPalm),
      rightPalm: copyPoint(diagnostics.rightPalm),
      renderedLeftGrip: copyPoint(diagnostics.renderedBlueGrip),
      renderedRightGrip: copyPoint(diagnostics.renderedRedGrip),
      leftCorrectionLocal: copyPoint(diagnostics.blueCorrectionLocal),
      rightCorrectionLocal: copyPoint(diagnostics.redCorrectionLocal),
    };

    if (previous && validInterval) {
      sample.speeds = {
        authored: pairSpeed(
          sample.authoredLeftGrip,
          previous.authoredLeftGrip,
          sample.authoredRightGrip,
          previous.authoredRightGrip,
          deltaSeconds
        ),
        target: pairSpeed(
          sample.leftTarget,
          previous.leftTarget,
          sample.rightTarget,
          previous.rightTarget,
          deltaSeconds
        ),
        wrist: pairSpeed(
          sample.leftWrist,
          previous.leftWrist,
          sample.rightWrist,
          previous.rightWrist,
          deltaSeconds
        ),
        palm: pairSpeed(
          sample.leftPalm,
          previous.leftPalm,
          sample.rightPalm,
          previous.rightPalm,
          deltaSeconds
        ),
        renderedGrip: pairSpeed(
          sample.renderedLeftGrip,
          previous.renderedLeftGrip,
          sample.renderedRightGrip,
          previous.renderedRightGrip,
          deltaSeconds
        ),
        correction: pairSpeed(
          sample.leftCorrectionLocal,
          previous.leftCorrectionLocal,
          sample.rightCorrectionLocal,
          previous.rightCorrectionLocal,
          deltaSeconds
        ),
      };
    }

    if (
      !validInterval ||
      sample.speeds.authored > AUTHORED_STATIONARY_SPEED_MPS
    ) {
      trace.lastAuthoredMotionMs = timeMs;
    }
    sample.settled =
      validInterval &&
      timeMs - trace.lastAuthoredMotionMs >= SETTLE_AFTER_AUTHORED_MOTION_MS;
    if (sample.settled) sample.source = classifySource(sample.speeds);

    sample.separations = {
      authoredGrips: distance(
        sample.authoredLeftGrip,
        sample.authoredRightGrip
      ),
      targets: distance(sample.leftTarget, sample.rightTarget),
      wrists: distance(sample.leftWrist, sample.rightWrist),
      palms: distance(sample.leftPalm, sample.rightPalm),
      renderedGrips: distance(
        sample.renderedLeftGrip,
        sample.renderedRightGrip
      ),
    };

    trace.nextFrame += 1;
    trace.samples.push(sample);
    if (trace.samples.length > MAX_SAMPLES_PER_PERFORMER) {
      trace.samples.shift();
    }

    this.publishedFrameCount += 1;
    if (this.publishedFrameCount % 15 === 0) this.publishBrowserSnapshot();
  }

  report(): AvatarGripMotionReport {
    const performers: Record<string, PerformerGripMotionReport> = {};
    for (const [performerId, trace] of this.traces) {
      const summary = this.summarizeTrace(trace.samples);
      performers[performerId] = {
        ...copySummary(summary),
        samples: trace.samples.map((sample) => ({
          ...sample,
          speeds: { ...sample.speeds },
          separations: { ...sample.separations },
        })),
      };
    }
    return { thresholds: AVATAR_GRIP_MOTION_THRESHOLDS, performers };
  }

  clear(): void {
    this.traces.clear();
    this.publishedFrameCount = 0;
    this.publishBrowserSnapshot();
  }

  private summarizeTrace(
    samples: readonly AvatarGripMotionSample[]
  ): PerformerGripMotionSummary {
    const settled = samples.filter((sample) => sample.settled);
    const first = samples[0];
    const last = samples.at(-1);
    const firstSettled = settled[0];
    const lastSettled = settled.at(-1);
    const sourceCounts: Record<GripMotionSource, number> = {
      "target-policy": 0,
      "arm-solver": 0,
      "contact-lock": 0,
    };
    for (const sample of settled) {
      if (sample.source) sourceCounts[sample.source] += 1;
    }
    const firstMovingSubsystem =
      settled.find((sample) => sample.source)?.source ?? null;
    const twitchFrames = Object.values(sourceCounts).reduce(
      (total, count) => total + count,
      0
    );
    const status: GripMotionStatus =
      samples.length < MIN_SETTLED_SAMPLES
        ? "insufficient-data"
        : settled.length < MIN_SETTLED_SAMPLES
          ? "authored-motion"
          : twitchFrames > 0
            ? "twitching"
            : "stable";
    const speedNames = Object.keys(
      settled[0]?.speeds ?? {
        authored: 0,
        target: 0,
        wrist: 0,
        palm: 0,
        renderedGrip: 0,
        correction: 0,
      }
    ) as Array<keyof GripMotionSpeeds>;

    return {
      status,
      sampledFrames: samples.length,
      settledFrames: settled.length,
      durationMs: first && last ? last.timeMs - first.timeMs : 0,
      settledDurationMs:
        firstSettled && lastSettled
          ? lastSettled.timeMs - firstSettled.timeMs
          : 0,
      twitchFrames,
      firstMovingSubsystem,
      sourceCounts,
      speeds: Object.fromEntries(
        speedNames.map((name) => [
          name,
          summarize(settled.map((sample) => sample.speeds[name])),
        ])
      ) as PerformerGripMotionSummary["speeds"],
      minimumSeparation: {
        authoredGrips: minimum(
          samples.map((sample) => sample.separations.authoredGrips)
        ),
        targets: minimum(samples.map((sample) => sample.separations.targets)),
        wrists: minimum(samples.map((sample) => sample.separations.wrists)),
        palms: minimum(samples.map((sample) => sample.separations.palms)),
        renderedGrips: minimum(
          samples.map((sample) => sample.separations.renderedGrips)
        ),
      },
      maximumPropOverlapDepth: samples.reduce(
        (maximum, sample) => Math.max(maximum, sample.propOverlapDepth),
        0
      ),
      maximumCorrectionDistance: samples.reduce(
        (maximum, sample) =>
          Math.max(
            maximum,
            pointMagnitude(sample.leftCorrectionLocal),
            pointMagnitude(sample.rightCorrectionLocal)
          ),
        0
      ),
    };
  }

  private publishBrowserSnapshot(): void {
    const report = this.report();
    const summary = {
      thresholds: report.thresholds,
      performers: Object.fromEntries(
        Object.entries(report.performers).map(([performerId, performer]) => {
          const { samples: _samples, ...performerSummary } = performer;
          return [performerId, performerSummary];
        })
      ),
    };
    const serialized = JSON.stringify(summary);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(AVATAR_GRIP_MOTION_STORAGE_KEY, serialized);
    }
    if (typeof document !== "undefined" && import.meta.env.DEV) {
      document.documentElement.setAttribute(
        AVATAR_GRIP_MOTION_ATTRIBUTE,
        serialized
      );
    }
  }
}

let audit: AvatarGripMotionAudit | undefined;

export function getAvatarGripMotionAudit(): AvatarGripMotionAudit {
  audit ??= new AvatarGripMotionAudit();
  if (typeof window !== "undefined" && import.meta.env.DEV) {
    const browser = window as typeof window & BrowserGripMotionHooks;
    browser.__avatarGripMotionAudit = audit;
    browser.__captureAvatarGripMotionTrace = async (durationMs = 3000) => {
      const boundedDurationMs = Math.max(500, Math.min(durationMs, 30_000));
      audit!.clear();
      await new Promise((resolve) => setTimeout(resolve, boundedDurationMs));
      return audit!.report();
    };
  }
  return audit;
}
