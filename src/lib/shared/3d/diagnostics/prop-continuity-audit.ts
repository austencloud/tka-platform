/**
 * Prop continuity audit - finds the frames where a prop's pose stops being
 * continuous.
 *
 * A "teleport" is a visually instantaneous change in a prop's pose that the
 * choreography did not ask for. It is NOT the same as "fast": a dash across
 * the grid diameter and a one-turn spin are both legitimately quick, and a
 * detector built on a fixed speed ceiling flags those and misses the real
 * defect. So every frame here is judged against the LOCAL trend of the trace
 * it belongs to - the median speed of its own neighbourhood, with the
 * neighbourhood's centre cut out so a wide event cannot raise its own
 * baseline.
 *
 * This module is pure and has no opinion about where the samples came from.
 * `prop-continuity-sweep.ts` builds them from the shared score-time owner so
 * the lab and a headless run measure the same poses.
 */

/** Which prop a finding belongs to. Blue is the left hand, red the right. */
export type ContinuityPropId = "blue" | "red";

/** A prop pose at one phase, in the rig-local frame the renderer composes. */
export interface ContinuityPose {
  /** Metres. */
  readonly position: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  /** Unit quaternion. */
  readonly rotation: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly w: number;
  };
}

/** One prop's pose track across a sequence. */
export interface ContinuityTrace {
  readonly prop: ContinuityPropId;
  /** Strictly increasing motion-score phase, in steps. */
  readonly phases: readonly number[];
  /** Same length as `phases`; null where the prop is not rendered. */
  readonly poses: readonly (ContinuityPose | null)[];
}

/**
 * How a flagged span reads. The classes are the ones a viewer can tell apart
 * on the stage, not the ones the maths happens to produce.
 */
export type ContinuityClass =
  /** (a) The prop's position jumps inside the plane it draws in. */
  | "position-jump"
  /** (c) The prop swaps between upstage and downstage of the performer. */
  | "depth-flip"
  /** (b) Quaternion double cover: the rotation is continuous, the numbers are not. */
  | "orientation-sign-flip"
  /** (b/e) The orientation changes faster than the motion around it explains. */
  | "orientation-discontinuity"
  /** (d) A discontinuity confined to the seam between two steps. */
  | "step-boundary-jump"
  /** (e) Flagged, but none of the above describe it. */
  | "unclassified";

export interface ContinuityFinding {
  readonly sequenceId: string;
  readonly prop: ContinuityPropId;
  /** Motion-score phase where the span starts, in steps. */
  readonly phaseStart: number;
  /** Motion-score phase where the span ends, in steps. */
  readonly phaseEnd: number;
  /** The step label the lab shows for `phaseStart` (1-based step . hundredths). */
  readonly labelStart: string;
  readonly labelEnd: string;
  /** Net straight-line displacement across the span, centimetres. */
  readonly magnitudeCm: number;
  /** Net rotation across the span, degrees, taken the short way. */
  readonly magnitudeDeg: number;
  /** Axis carrying most of the net displacement. */
  readonly axis: "x" | "y" | "z" | "mixed";
  readonly class: ContinuityClass;
  /** Peak linear speed inside the span, cm per step. */
  readonly peakSpeedCmPerStep: number;
  /** Peak angular speed inside the span, degrees per step. */
  readonly peakAngularDegPerStep: number;
  /** The local trend the peak was judged against. */
  readonly baselineCmOrDegPerStep: number;
  /** peak / baseline. How far outside its own motion this frame sits. */
  readonly trendRatio: number;
  /** Net per-axis displacement, centimetres. */
  readonly displacementCm: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  /** One sentence a human can read without opening the trace. */
  readonly note: string;
  /** Whatever the caller attached at the span's peak frame. */
  readonly context?: Readonly<Record<string, number | string | boolean>>;
}

export interface ContinuityAuditOptions {
  /**
   * How many times its own local median a frame's speed must exceed before it
   * is a candidate. Four keeps ordinary arcs, dashes and direction reversals
   * out while still catching an order-of-magnitude spike.
   */
  readonly trendMultiple?: number;
  /**
   * Absolute guard so a near-static trace cannot flag its own numerical noise.
   * A prop drawing the whole 0.52 m grid circle inside one step travels about
   * 327 cm/step, so this sits above every legitimate authored path.
   */
  readonly linearFloorCmPerStep?: number;
  /** The same guard for rotation. One full turn per step is 360 deg/step. */
  readonly angularFloorDegPerStep?: number;
  /** Half-width of the trend window, in samples. */
  readonly trendWindowSamples?: number;
  /** Half-width of the hole cut out of the trend window, in samples. */
  readonly trendExclusionSamples?: number;
  /** Findings below this net displacement are dropped as noise. */
  readonly minMagnitudeCm?: number;
  /** Findings below this net rotation are dropped when there is no travel. */
  readonly minMagnitudeDeg?: number;
  /**
   * Once a span is flagged, grow it outwards while the speed is still this
   * many times the local trend. Without it a finding reports only the frames
   * that broke the floor, which understates a swing that ramps in and out -
   * and a scrubber marker drawn from those bounds would sit inside the event
   * rather than around it.
   */
  readonly extensionMultiple?: number;
  /** A span within this of an integer phase counts as sitting on a step seam. */
  readonly stepSeamEpsilon?: number;
  /**
   * Share of the net displacement the depth axis must carry - or a sign change
   * it must make - before a span reads as an upstage/downstage swap.
   */
  readonly depthDominance?: number;
  /** Attach per-frame diagnostics to the finding, taken at its peak frame. */
  readonly contextAt?: (
    sampleIndex: number,
    prop: ContinuityPropId
  ) => Record<string, number | string | boolean> | undefined;
}

const DEFAULTS = {
  trendMultiple: 4,
  linearFloorCmPerStep: 360,
  angularFloorDegPerStep: 1080,
  trendWindowSamples: 100,
  trendExclusionSamples: 20,
  minMagnitudeCm: 5,
  minMagnitudeDeg: 20,
  extensionMultiple: 1.5,
  stepSeamEpsilon: 0.01,
  depthDominance: 0.6,
} as const;

/** The label the staff-grip lab prints for a motion-score phase. */
export function phaseLabel(phase: number): string {
  const step = Math.floor(phase) + 1;
  const hundredths = Math.round((phase % 1) * 100);
  return `${step}.${String(hundredths).padStart(2, "0")}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 0) {
    // mid - 1 and mid are always in bounds here: sorted.length is even and
    // > 0, so mid >= 1 and mid < sorted.length.
    const lower = sorted[mid - 1] ?? 0;
    const upper = sorted[mid] ?? 0;
    return (lower + upper) / 2;
  }
  // mid < sorted.length always holds for a non-empty array.
  return sorted[mid] ?? 0;
}

/** Short-way angle between two unit quaternions, in radians. */
function quaternionAngle(
  a: ContinuityPose["rotation"],
  b: ContinuityPose["rotation"]
): { angleRad: number; dot: number } {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const clamped = Math.min(1, Math.abs(dot));
  return { angleRad: 2 * Math.acos(clamped), dot };
}

interface FrameDelta {
  /** Index of the later sample of the pair. */
  index: number;
  dPhase: number;
  /** cm per step. */
  speed: number;
  /** degrees per step. */
  angularSpeed: number;
  /** Raw quaternion dot, so a double-cover flip stays visible. */
  dot: number;
}

/** Find the spans where one prop's pose leaves its own motion behind. */
export function auditPropContinuity(
  sequenceId: string,
  trace: ContinuityTrace,
  options: ContinuityAuditOptions = {}
): ContinuityFinding[] {
  const o = { ...DEFAULTS, ...options };
  const { phases, poses, prop } = trace;
  if (phases.length !== poses.length) {
    throw new Error(
      `prop-continuity: trace for ${sequenceId}/${prop} has ${phases.length} phases and ${poses.length} poses`
    );
  }

  const deltas: FrameDelta[] = [];
  for (let i = 1; i < poses.length; i++) {
    const previous = poses[i - 1];
    const current = poses[i];
    // A prop that appears or disappears is a visibility change, not a
    // discontinuity in a pose that exists on both sides of the frame.
    if (!previous || !current) continue;
    const phaseCurrent = phases[i];
    const phasePrevious = phases[i - 1];
    if (phaseCurrent === undefined || phasePrevious === undefined) continue;
    const dPhase = phaseCurrent - phasePrevious;
    if (dPhase <= 0) continue;
    const dx = (current.position.x - previous.position.x) * 100;
    const dy = (current.position.y - previous.position.y) * 100;
    const dz = (current.position.z - previous.position.z) * 100;
    const { angleRad, dot } = quaternionAngle(
      previous.rotation,
      current.rotation
    );
    deltas.push({
      index: i,
      dPhase,
      speed: Math.hypot(dx, dy, dz) / dPhase,
      angularSpeed: ((angleRad * 180) / Math.PI) / dPhase,
      dot,
    });
  }
  if (deltas.length === 0) return [];

  const speeds = deltas.map((d) => d.speed);
  const angulars = deltas.map((d) => d.angularSpeed);

  /** Median of the neighbourhood with its own centre cut out. */
  const localBaseline = (values: number[], at: number): number => {
    const window: number[] = [];
    const from = Math.max(0, at - o.trendWindowSamples);
    const to = Math.min(values.length - 1, at + o.trendWindowSamples);
    for (let i = from; i <= to; i++) {
      if (Math.abs(i - at) <= o.trendExclusionSamples) continue;
      const value = values[i];
      if (value === undefined) continue;
      window.push(value);
    }
    // A trace shorter than the exclusion hole has no outside to compare with,
    // so fall back to the whole trace rather than to nothing.
    return median(window.length > 0 ? window : values);
  };

  const flags = deltas.map((d, i) => {
    const speedBaseline = localBaseline(speeds, i);
    const angularBaseline = localBaseline(angulars, i);
    return {
      linear:
        d.speed > o.linearFloorCmPerStep &&
        d.speed > o.trendMultiple * speedBaseline,
      angular:
        d.angularSpeed > o.angularFloorDegPerStep &&
        d.angularSpeed > o.trendMultiple * angularBaseline,
      speedBaseline,
      angularBaseline,
    };
  });

  const findings: ContinuityFinding[] = [];
  let cursor = 0;
  while (cursor < deltas.length) {
    const currentFlag = flags[cursor];
    if (!currentFlag || (!currentFlag.linear && !currentFlag.angular)) {
      cursor += 1;
      continue;
    }
    let end = cursor;
    while (end + 1 < deltas.length) {
      const nextFlag = flags[end + 1];
      if (!nextFlag || !(nextFlag.linear || nextFlag.angular)) break;
      end += 1;
    }
    const coreStart = cursor;
    const coreEnd = end;
    cursor = end + 1;

    // Grow the span out to the shoulders of the event. The core is only the
    // frames that broke the absolute floor; a swing that ramps in and out
    // carries most of its travel in the shoulders.
    const coreLinear = flags
      .slice(coreStart, coreEnd + 1)
      .some((f) => f.linear);
    const reference = median(
      flags
        .slice(coreStart, coreEnd + 1)
        .map((f) => (coreLinear ? f.speedBaseline : f.angularBaseline))
    );
    const stillElevated = (i: number): boolean => {
      // A zero baseline means the trace around the event is static, so every
      // frame reads as elevated and growth would run to its cap for nothing.
      if (reference <= 0) return false;
      const delta = deltas[i];
      if (!delta) return false;
      const value = coreLinear ? delta.speed : delta.angularSpeed;
      return value > o.extensionMultiple * reference;
    };
    const maxGrowth = 3 * o.trendWindowSamples;
    let spanStart = coreStart;
    let spanEnd = coreEnd;
    while (
      spanStart > 0 &&
      coreStart - spanStart < maxGrowth &&
      stillElevated(spanStart - 1)
    ) {
      spanStart -= 1;
    }
    while (
      spanEnd + 1 < deltas.length &&
      spanEnd - coreEnd < maxGrowth &&
      stillElevated(spanEnd + 1)
    ) {
      spanEnd += 1;
    }

    const span = deltas.slice(spanStart, spanEnd + 1);
    const spanFlags = flags.slice(spanStart, spanEnd + 1);

    const firstDelta = span[0];
    const lastDelta = span[span.length - 1];
    const firstFlags = spanFlags[0];
    if (!firstDelta || !lastDelta || !firstFlags) continue;

    const firstIndex = firstDelta.index - 1;
    const lastIndex = lastDelta.index;
    const startPose = poses[firstIndex];
    const endPose = poses[lastIndex];
    if (!startPose || !endPose) continue;

    const displacementCm = {
      x: (endPose.position.x - startPose.position.x) * 100,
      y: (endPose.position.y - startPose.position.y) * 100,
      z: (endPose.position.z - startPose.position.z) * 100,
    };
    const magnitudeCm = Math.hypot(
      displacementCm.x,
      displacementCm.y,
      displacementCm.z
    );
    const magnitudeDeg =
      (quaternionAngle(startPose.rotation, endPose.rotation).angleRad * 180) /
      Math.PI;

    const linearFlagged = spanFlags.some((f) => f.linear);
    const angularFlagged = spanFlags.some((f) => f.angular);
    if (linearFlagged && magnitudeCm < o.minMagnitudeCm) continue;
    if (!linearFlagged && angularFlagged && magnitudeDeg < o.minMagnitudeDeg) {
      continue;
    }

    let peak = firstDelta;
    let peakFlags = firstFlags;
    for (let i = 1; i < span.length; i++) {
      const candidate = span[i];
      const candidateFlags = spanFlags[i];
      if (!candidate || !candidateFlags) continue;
      const better = linearFlagged
        ? candidate.speed > peak.speed
        : candidate.angularSpeed > peak.angularSpeed;
      if (better) {
        peak = candidate;
        peakFlags = candidateFlags;
      }
    }

    const abs = {
      x: Math.abs(displacementCm.x),
      y: Math.abs(displacementCm.y),
      z: Math.abs(displacementCm.z),
    };
    const total = abs.x + abs.y + abs.z;
    let axis: ContinuityFinding["axis"] = "mixed";
    if (total > 0) {
      const dominant = (["x", "y", "z"] as const).reduce((best, key) =>
        abs[key] > abs[best] ? key : best
      );
      if (abs[dominant] / total >= 0.5) axis = dominant;
    }

    const phaseStartRaw = phases[firstIndex];
    const phaseEndRaw = phases[lastIndex];
    if (phaseStartRaw === undefined || phaseEndRaw === undefined) continue;
    const phaseStart = phaseStartRaw;
    const phaseEnd = phaseEndRaw;
    const crossesSeam = span.some((d) => {
      const p = phases[d.index];
      if (p === undefined) return false;
      return Math.abs(p - Math.round(p)) <= o.stepSeamEpsilon;
    });
    const depthSignChanged =
      Math.sign(startPose.position.z) !== Math.sign(endPose.position.z);
    const depthDominant = total > 0 && abs.z / total >= o.depthDominance;
    const signFlip = span.some((d) => d.dot < 0);
    const spanSteps = phaseEnd - phaseStart;

    let cls: ContinuityClass;
    let note: string;
    if (
      linearFlagged &&
      (depthDominant || depthSignChanged) &&
      abs.z >= o.minMagnitudeCm
    ) {
      cls = "depth-flip";
      note =
        `${prop} swaps depth: z ${(startPose.position.z * 100).toFixed(1)}cm to ` +
        `${(endPose.position.z * 100).toFixed(1)}cm over ${spanSteps.toFixed(3)} steps`;
    } else if (linearFlagged && crossesSeam && span.length <= 2) {
      cls = "step-boundary-jump";
      note = `${prop} jumps ${magnitudeCm.toFixed(1)}cm at the seam between steps`;
    } else if (linearFlagged) {
      cls = "position-jump";
      note =
        `${prop} moves ${magnitudeCm.toFixed(1)}cm on ${axis} in ${spanSteps.toFixed(3)} steps ` +
        `(${peak.speed.toFixed(0)} cm/step against a ${peakFlags.speedBaseline.toFixed(0)} cm/step trend)`;
    } else if (signFlip) {
      cls = "orientation-sign-flip";
      note = `${prop} quaternion changes hemisphere; the rotation itself stays short-way continuous`;
    } else if (crossesSeam) {
      cls = "step-boundary-jump";
      note = `${prop} rotation jumps ${magnitudeDeg.toFixed(1)}deg at the seam between steps`;
    } else {
      cls = "orientation-discontinuity";
      note =
        `${prop} rotates ${magnitudeDeg.toFixed(1)}deg in ${spanSteps.toFixed(3)} steps ` +
        `(${peak.angularSpeed.toFixed(0)} deg/step against a ${peakFlags.angularBaseline.toFixed(0)} deg/step trend)`;
    }

    findings.push({
      sequenceId,
      prop,
      phaseStart: Number(phaseStart.toFixed(4)),
      phaseEnd: Number(phaseEnd.toFixed(4)),
      labelStart: phaseLabel(phaseStart),
      labelEnd: phaseLabel(phaseEnd),
      magnitudeCm: Number(magnitudeCm.toFixed(2)),
      magnitudeDeg: Number(magnitudeDeg.toFixed(2)),
      axis,
      class: cls,
      peakSpeedCmPerStep: Number(peak.speed.toFixed(1)),
      peakAngularDegPerStep: Number(peak.angularSpeed.toFixed(1)),
      baselineCmOrDegPerStep: Number(
        (linearFlagged
          ? peakFlags.speedBaseline
          : peakFlags.angularBaseline
        ).toFixed(1)
      ),
      trendRatio: Number(
        (linearFlagged
          ? peak.speed / Math.max(peakFlags.speedBaseline, 1e-6)
          : peak.angularSpeed / Math.max(peakFlags.angularBaseline, 1e-6)
        ).toFixed(2)
      ),
      displacementCm: {
        x: Number(displacementCm.x.toFixed(2)),
        y: Number(displacementCm.y.toFixed(2)),
        z: Number(displacementCm.z.toFixed(2)),
      },
      note,
      context: o.contextAt?.(peak.index, prop),
    });
  }

  return findings;
}
