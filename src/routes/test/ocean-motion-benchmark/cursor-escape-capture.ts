/** The capture panel records whatever phase string the fish reports
 * (`+page.svelte` reads it as `string | null`); the ocean package no longer
 * exports a phase union to narrow it against. */
export type CursorCapturePhase = string;
export type CursorCaptureState = "idle" | "armed" | "recording" | "complete";
export type AutomatedPursuitState = "idle" | "running" | "complete";

export interface CursorEscapeCaptureSample {
  elapsed: number;
  escapeEventId: number | null;
  escapeResponseEventId: number | null;
  x: number;
  y: number;
  pointerX: number | null;
  pointerY: number | null;
  speedBodyLengths: number;
  headingAngle: number;
  direction: 1 | -1;
  bodyFlex: number;
  animationPhase: number;
  clearanceBodyLengths: number;
  liveClearanceBodyLengths: number | null;
  pursuitPressure: number;
  phase: CursorCapturePhase;
}

export interface CursorEscapeCaptureReport {
  duration: number;
  sampleCount: number;
  netDisplacementBodyLengths: number | null;
  pathDistanceBodyLengths: number;
  postTurnNetDisplacementBodyLengths: number | null;
  postTurnPathDistanceBodyLengths: number;
  turnLatencyMilliseconds: number | null;
  maneuverActiveMilliseconds: number;
  escapeEventCount: number;
  firstManeuverDurationMilliseconds: number | null;
  firstManeuverNetDisplacementBodyLengths: number | null;
  firstManeuverPathDistanceBodyLengths: number | null;
  firstManeuverClearanceGainBodyLengths: number | null;
  firstManeuverTurnLatencyMilliseconds: number | null;
  firstResponseDurationMilliseconds: number | null;
  firstResponseNetDisplacementBodyLengths: number | null;
  firstResponsePathDistanceBodyLengths: number | null;
  firstResponseClearanceGainBodyLengths: number | null;
  firstResponseTravelEfficiency: number | null;
  clearanceGainBodyLengths: number;
  peakSpeedBodyLengths: number;
  peakBodyFlex: number;
  bodyWaveCyclesAfterTurn: number;
  bodyLengthsPerWaveAfterTurn: number | null;
  travelEfficiency: number | null;
  pointerPathBodyLengths: number;
  maximumStageThreeHeadingStepDegrees: number;
  stageThreeHeadingChangeDegrees: number;
  minimumLiveClearanceBodyLengths: number | null;
  maximumPursuitPressure: number;
  pursuedDurationMilliseconds: number;
  wrapped: boolean;
}

export interface LiveCursorCaptureReport extends CursorEscapeCaptureReport {
  fishId: number | null;
  species: string;
  bodyLength: number;
  source: { x: number; y: number };
}

export interface AutomatedPursuitReport {
  durationMilliseconds: number;
  escapeEventCount: number;
  retargetLatencyMilliseconds: number | null;
  maximumHeadingStepDegrees: number;
  maximumAllowedHeadingStepDegrees: number;
  retargetDegrees: number;
  maximumPursuitPressure: number;
  minimumLateChaseSpeedBodyLengths: number | null;
  requiredLateChaseSpeedBodyLengths: number;
  activeAfterBaseline: boolean;
  recoveryAfterReleaseMilliseconds: number | null;
}

export function automatedPursuitPassed(
  report: AutomatedPursuitReport | null
): boolean {
  return (
    report !== null &&
    report.escapeEventCount === 1 &&
    report.retargetLatencyMilliseconds !== null &&
    report.retargetLatencyMilliseconds <= 34 &&
    report.maximumHeadingStepDegrees <=
      report.maximumAllowedHeadingStepDegrees + 0.05 &&
    report.retargetDegrees >= 150 &&
    report.maximumPursuitPressure >= 0.8 &&
    report.minimumLateChaseSpeedBodyLengths !== null &&
    report.minimumLateChaseSpeedBodyLengths >=
      report.requiredLateChaseSpeedBodyLengths &&
    report.activeAfterBaseline &&
    report.recoveryAfterReleaseMilliseconds !== null &&
    report.recoveryAfterReleaseMilliseconds >= 2600 &&
    report.recoveryAfterReleaseMilliseconds <= 3100
  );
}

const normalizeAngle = (angle: number): number => {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
};

interface EscapeEventSegment {
  eventId: number;
  startIndex: number;
  endIndex: number;
  duration: number;
}

function eventSegments(
  samples: CursorEscapeCaptureSample[],
  eventIdFor: (sample: CursorEscapeCaptureSample) => number | null
): EscapeEventSegment[] {
  const segments: EscapeEventSegment[] = [];
  let active: Omit<EscapeEventSegment, "duration"> | null = null;

  for (let index = 0; index < samples.length; index += 1) {
    const eventId = eventIdFor(samples[index]!);
    if (eventId === null) {
      if (active) {
        const endBoundary = samples[index]!.elapsed;
        const startBoundary = samples[active.startIndex - 1]?.elapsed ?? 0;
        segments.push({
          ...active,
          duration: Math.max(0, endBoundary - startBoundary),
        });
        active = null;
      }
      continue;
    }

    const currentActive = active as Omit<EscapeEventSegment, "duration"> | null;
    if (currentActive !== null && currentActive.eventId === eventId) {
      currentActive.endIndex = index;
      continue;
    }

    if (active) {
      const endBoundary = samples[index]!.elapsed;
      const startBoundary = samples[active.startIndex - 1]?.elapsed ?? 0;
      segments.push({
        ...active,
        duration: Math.max(0, endBoundary - startBoundary),
      });
    }
    active = { eventId, startIndex: index, endIndex: index };
  }

  if (active) {
    const previous = samples[active.endIndex - 1];
    const last = samples[active.endIndex]!;
    const finalStep = previous ? last.elapsed - previous.elapsed : last.elapsed;
    const startBoundary = samples[active.startIndex - 1]?.elapsed ?? 0;
    segments.push({
      ...active,
      duration: Math.max(0, last.elapsed + finalStep - startBoundary),
    });
  }

  return segments;
}

function pathDistance(
  samples: CursorEscapeCaptureSample[],
  bodyLength: number
): { distance: number; wrapped: boolean } {
  let distance = 0;
  let wrapped = false;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const step = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (step > bodyLength * 4) {
      wrapped = true;
      continue;
    }
    distance += step;
  }
  return { distance: distance / bodyLength, wrapped };
}

function pointerPathDistance(
  samples: CursorEscapeCaptureSample[],
  bodyLength: number
): number {
  let distance = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    if (
      previous.pointerX === null ||
      previous.pointerY === null ||
      current.pointerX === null ||
      current.pointerY === null
    ) {
      continue;
    }
    distance += Math.hypot(
      current.pointerX - previous.pointerX,
      current.pointerY - previous.pointerY
    );
  }
  return distance / bodyLength;
}

function bodyWaveCycles(samples: CursorEscapeCaptureSample[]): number {
  let phaseTravel = 0;
  for (let index = 1; index < samples.length; index += 1) {
    phaseTravel += Math.abs(
      samples[index]!.animationPhase - samples[index - 1]!.animationPhase
    );
  }
  return phaseTravel / (Math.PI * 2);
}

function summarizeStageThree(samples: CursorEscapeCaptureSample[]): {
  maximumHeadingStepDegrees: number;
  headingChangeDegrees: number;
  pursuedDurationMilliseconds: number;
} {
  const stageThree = samples.filter((sample) => sample.phase === "escape-swim");
  const first = stageThree[0];
  if (!first) {
    return {
      maximumHeadingStepDegrees: 0,
      headingChangeDegrees: 0,
      pursuedDurationMilliseconds: 0,
    };
  }

  let maximumStep = 0;
  let maximumChange = 0;
  let pursuedDuration = 0;
  for (let index = 1; index < stageThree.length; index += 1) {
    const previous = stageThree[index - 1]!;
    const current = stageThree[index]!;
    maximumStep = Math.max(
      maximumStep,
      Math.abs(normalizeAngle(current.headingAngle - previous.headingAngle))
    );
    maximumChange = Math.max(
      maximumChange,
      Math.abs(normalizeAngle(current.headingAngle - first.headingAngle))
    );
    if (current.pursuitPressure >= 0.25) {
      pursuedDuration += Math.max(0, current.elapsed - previous.elapsed);
    }
  }

  return {
    maximumHeadingStepDegrees: (maximumStep * 180) / Math.PI,
    headingChangeDegrees: (maximumChange * 180) / Math.PI,
    pursuedDurationMilliseconds: pursuedDuration * 1000,
  };
}

export function summarizeCursorEscapeCapture(
  samples: CursorEscapeCaptureSample[],
  bodyLength: number,
  startHeadingAngle: number
): CursorEscapeCaptureReport | null {
  if (samples.length < 2 || bodyLength <= 0) return null;

  const first = samples[0]!;
  const last = samples.at(-1)!;
  const turnIndex = samples.findIndex(
    (sample) =>
      Math.abs(normalizeAngle(sample.headingAngle - startHeadingAngle)) >=
      Math.PI * 0.5
  );
  const postTurnSamples = turnIndex >= 0 ? samples.slice(turnIndex) : [];
  const entirePath = pathDistance(samples, bodyLength);
  const postTurnPath = pathDistance(postTurnSamples, bodyLength);
  const netDisplacement = Math.hypot(last.x - first.x, last.y - first.y);
  const postTurnFirst = postTurnSamples[0];
  const postTurnNet = postTurnFirst
    ? Math.hypot(last.x - postTurnFirst.x, last.y - postTurnFirst.y) /
      bodyLength
    : null;
  const postTurnWaves = bodyWaveCycles(postTurnSamples);
  const stageThree = summarizeStageThree(samples);
  const liveClearances = samples
    .filter((sample) => sample.phase === "escape-swim")
    .map((sample) => sample.liveClearanceBodyLengths)
    .filter((value): value is number => value !== null);
  const maneuverSegments = eventSegments(
    samples,
    (sample) => sample.escapeEventId
  );
  const responseSegments = eventSegments(
    samples,
    (sample) => sample.escapeResponseEventId
  );
  const firstEvent = maneuverSegments[0];
  const firstEventSamples = firstEvent
    ? samples.slice(firstEvent.startIndex, firstEvent.endIndex + 1)
    : [];
  const firstEventPath = pathDistance(firstEventSamples, bodyLength);
  const firstEventStart = firstEventSamples[0];
  const firstEventEnd = firstEventSamples.at(-1);
  const firstEventStartBoundary = firstEvent
    ? (samples[firstEvent.startIndex - 1]?.elapsed ?? 0)
    : null;
  const firstEventNet =
    firstEventStart && firstEventEnd
      ? Math.hypot(
          firstEventEnd.x - firstEventStart.x,
          firstEventEnd.y - firstEventStart.y
        ) / bodyLength
      : null;
  const firstEventTurnIndex = firstEventSamples.findIndex(
    (sample) =>
      Math.abs(normalizeAngle(sample.headingAngle - startHeadingAngle)) >=
      Math.PI * 0.5
  );
  const firstResponse = responseSegments[0];
  const firstResponseSamples = firstResponse
    ? samples.slice(firstResponse.startIndex, firstResponse.endIndex + 1)
    : [];
  const firstResponsePath = pathDistance(firstResponseSamples, bodyLength);
  const firstResponseStart = firstResponseSamples[0];
  const firstResponseEnd = firstResponseSamples.at(-1);
  const firstResponseNet =
    firstResponseStart && firstResponseEnd
      ? Math.hypot(
          firstResponseEnd.x - firstResponseStart.x,
          firstResponseEnd.y - firstResponseStart.y
        ) / bodyLength
      : null;

  return {
    duration: last.elapsed - first.elapsed,
    sampleCount: samples.length,
    netDisplacementBodyLengths: entirePath.wrapped
      ? null
      : netDisplacement / bodyLength,
    pathDistanceBodyLengths: entirePath.distance,
    postTurnNetDisplacementBodyLengths: entirePath.wrapped ? null : postTurnNet,
    postTurnPathDistanceBodyLengths: postTurnPath.distance,
    turnLatencyMilliseconds:
      turnIndex >= 0 ? samples[turnIndex]!.elapsed * 1000 : null,
    maneuverActiveMilliseconds:
      maneuverSegments.reduce((sum, segment) => sum + segment.duration, 0) *
      1000,
    escapeEventCount: new Set(
      maneuverSegments.map((segment) => segment.eventId)
    ).size,
    firstManeuverDurationMilliseconds: firstEvent
      ? firstEvent.duration * 1000
      : null,
    firstManeuverNetDisplacementBodyLengths: firstEventPath.wrapped
      ? null
      : firstEventNet,
    firstManeuverPathDistanceBodyLengths: firstEvent
      ? firstEventPath.distance
      : null,
    firstManeuverClearanceGainBodyLengths:
      firstEventStart && firstEventEnd
        ? firstEventEnd.clearanceBodyLengths -
          firstEventStart.clearanceBodyLengths
        : null,
    firstManeuverTurnLatencyMilliseconds:
      firstEventTurnIndex >= 0 && firstEventStartBoundary !== null
        ? (firstEventSamples[firstEventTurnIndex]!.elapsed -
            firstEventStartBoundary) *
          1000
        : null,
    firstResponseDurationMilliseconds: firstResponse
      ? firstResponse.duration * 1000
      : null,
    firstResponseNetDisplacementBodyLengths: firstResponsePath.wrapped
      ? null
      : firstResponseNet,
    firstResponsePathDistanceBodyLengths: firstResponse
      ? firstResponsePath.distance
      : null,
    firstResponseClearanceGainBodyLengths:
      firstResponseStart && firstResponseEnd
        ? firstResponseEnd.clearanceBodyLengths -
          firstResponseStart.clearanceBodyLengths
        : null,
    firstResponseTravelEfficiency:
      firstResponseNet !== null && firstResponsePath.distance > 0.001
        ? firstResponseNet / firstResponsePath.distance
        : null,
    clearanceGainBodyLengths:
      last.clearanceBodyLengths - first.clearanceBodyLengths,
    peakSpeedBodyLengths: Math.max(
      ...samples.map((sample) => sample.speedBodyLengths)
    ),
    peakBodyFlex: Math.max(...samples.map((sample) => sample.bodyFlex)),
    bodyWaveCyclesAfterTurn: postTurnWaves,
    bodyLengthsPerWaveAfterTurn:
      postTurnNet !== null && postTurnWaves > 0.01
        ? postTurnNet / postTurnWaves
        : null,
    travelEfficiency:
      entirePath.wrapped || entirePath.distance <= 0.001
        ? null
        : netDisplacement / bodyLength / entirePath.distance,
    pointerPathBodyLengths: pointerPathDistance(samples, bodyLength),
    maximumStageThreeHeadingStepDegrees: stageThree.maximumHeadingStepDegrees,
    stageThreeHeadingChangeDegrees: stageThree.headingChangeDegrees,
    minimumLiveClearanceBodyLengths:
      liveClearances.length > 0 ? Math.min(...liveClearances) : null,
    maximumPursuitPressure: Math.max(
      0,
      ...samples.map((sample) => sample.pursuitPressure)
    ),
    pursuedDurationMilliseconds: stageThree.pursuedDurationMilliseconds,
    wrapped: entirePath.wrapped || postTurnPath.wrapped,
  };
}
