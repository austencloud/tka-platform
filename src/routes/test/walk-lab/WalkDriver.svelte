<script lang="ts">
  /**
   * WalkDriver
   *
   * Turns a walk pattern into a path. Lives inside the canvas because the
   * integration has to happen on the same clock the animator is reading, and
   * renders nothing.
   *
   * The pattern says which way to face and which way to travel; this advances
   * the position at the commanded speed and hands the whole command back out.
   * Deriving the path from the speed rather than the other way round is the
   * point: the animator scales its stride to the speed it is told, so if the
   * body covered a different distance than it was told about, every foot on
   * the floor would slide by the difference.
   */

  import { useTask } from "@threlte/core";
  import type {
    LocomotionGaitClock,
    ScheduledGaitTimingSample,
    TerminalStepPlan,
  } from "@austencloud/scene-3d";
  import {
    stepOf,
    stepOfGaitDistance,
  } from "$lib/shared/3d/diagnostics/gait/walk-patterns";
  import {
    sampleDestinationWalkPlan,
    type DestinationWalkPlan,
  } from "$lib/shared/3d/locomotion/destination-walk-plan";
  import {
    assertGaitTimingPlanMatchesSteps,
    sampleGaitTimingPlan,
    type GaitTimingPlan,
  } from "$lib/shared/3d/locomotion/gait-timing-plan";
  import { createPatternTerminalStepPlan } from "$lib/shared/3d/locomotion/pattern-terminal-step-plan";
  import type {
    WalkPattern,
    WalkTick,
  } from "$lib/shared/3d/diagnostics/gait/walk-patterns";
  import type { ManualInput, WalkState } from "./walk-command";

  interface Props {
    pattern: WalkPattern;
    /** Base ground speed the pattern's rate multiplies, m/s. */
    speed: number;
    running: boolean;
    /** When set, the pattern is ignored and these drive the character. */
    manual: ManualInput | null;
    /** Mark-to-mark intent driven by the animator's own authored-step clock. */
    destinationPlan?: DestinationWalkPlan | null;
    /** Musical footfall declarations for the destination move. */
    gaitTimingPlan?: GaitTimingPlan | null;
    gaitClock?: LocomotionGaitClock | null;
    /** Change it to put the character back at the origin. */
    resetNonce: number;
    onState: (state: WalkState) => void;
    onDepartureStep?: (step: number | null) => void;
    onGaitTimingSample?: (sample: ScheduledGaitTimingSample | null) => void;
  }

  let {
    pattern,
    speed,
    running,
    manual,
    destinationPlan = null,
    gaitTimingPlan = null,
    gaitClock = null,
    resetNonce,
    onState,
    onDepartureStep,
    onGaitTimingSample,
  }: Props = $props();

  /** Radians a second the hand-driven mode turns at. */
  const MANUAL_TURN_RATE = 1.8;

  let t = 0;
  let x = 0;
  let z = 0;
  let facing = 0;
  let travelled = 0;
  let departureStep: number | null = null;
  let departureDistanceStep: number | null = null;
  let departureTime: number | null = null;
  let observedFootfalls = 0;
  let latestTimingError: number | null = null;
  let maxTimingError = 0;
  let previousObservedStep = 0;
  let previousObservedScoreTime = 0;
  let scoreStarted = false;
  let patternTerminalStepPlan: TerminalStepPlan | null = null;
  let holdPatternTime = false;
  let previousGaitDistanceStep: number | null = null;

  $effect(() => {
    if (destinationPlan && gaitTimingPlan) {
      assertGaitTimingPlanMatchesSteps(gaitTimingPlan, destinationPlan.steps);
    }
  });

  $effect(() => {
    // Read so the reset re-runs, then clear everything the path accumulated.
    void resetNonce;
    t = 0;
    x = 0;
    z = 0;
    facing = 0;
    travelled = 0;
    departureStep = null;
    departureDistanceStep = null;
    departureTime = null;
    observedFootfalls = 0;
    latestTimingError = null;
    maxTimingError = 0;
    previousObservedStep = 0;
    previousObservedScoreTime = gaitTimingPlan?.departureTimeSeconds ?? 0;
    scoreStarted = false;
    patternTerminalStepPlan = null;
    holdPatternTime = false;
    previousGaitDistanceStep = null;
    onDepartureStep?.(null);
    onGaitTimingSample?.(null);
  });

  function driveDestination(
    plan: DestinationWalkPlan,
    dt: number,
    scoreDelta: number
  ): void {
    if (running) {
      if (!gaitTimingPlan) {
        t += dt;
      } else if (departureStep !== null) {
        // Asset initialization can leave one oversized frame directly after
        // the gait clock first appears. The lab has no audio transport to
        // catch up to yet, so earn the departure epoch on one healthy frame;
        // after that, score time remains authoritative through real stalls.
        if (scoreStarted) t += scoreDelta;
        else if (scoreDelta <= 0.1) {
          scoreStarted = true;
          t += scoreDelta;
        }
      }
    }

    // Capture the animator where it is rather than inventing a second phase
    // origin. The first command starts movement; the callback then advances
    // this same clock on the next frame.
    if (departureStep === null && gaitClock) {
      departureStep = gaitClock.step;
      departureDistanceStep = gaitClock.distanceStep ?? gaitClock.step;
      departureTime = t;
      previousObservedScoreTime = gaitTimingPlan?.departureTimeSeconds ?? t;
      onDepartureStep?.(departureStep);
    }
    const scoreTimeSeconds = gaitTimingPlan
      ? gaitTimingPlan.departureTimeSeconds +
        Math.max(0, t - (departureTime ?? t))
      : t;
    const timingSample = gaitTimingPlan
      ? sampleGaitTimingPlan(gaitTimingPlan, scoreTimeSeconds)
      : null;
    onGaitTimingSample?.(
      timingSample && departureStep !== null
        ? {
            planId: gaitTimingPlan!.id,
            gaitStep: departureStep + timingSample.step,
            cadence: timingSample.cadence,
            arrived: timingSample.arrived,
            settled: timingSample.settled,
            settleProgress: timingSample.settleProgress,
          }
        : null
    );
    const authoredStep =
      departureStep === null || !gaitClock
        ? 0
        : Math.max(0, gaitClock.step - departureStep);
    const distanceStep =
      departureDistanceStep === null || !gaitClock
        ? authoredStep
        : Math.max(
            0,
            (gaitClock.distanceStep ?? gaitClock.step) - departureDistanceStep
          );
    const sample = sampleDestinationWalkPlan(
      plan,
      authoredStep,
      distanceStep,
      timingSample?.cadence ?? plan.cadence
    );

    if (gaitTimingPlan && departureStep !== null && gaitClock) {
      const observedStep = Math.min(plan.steps, authoredStep);
      const completed = Math.floor(observedStep + 1e-6);
      for (
        let footfall = observedFootfalls + 1;
        footfall <= completed;
        footfall++
      ) {
        const declared = gaitTimingPlan.footfalls[footfall - 1]!;
        const observedSpan = observedStep - previousObservedStep;
        const crossing =
          observedSpan > 1e-6
            ? previousObservedScoreTime +
              ((footfall - previousObservedStep) / observedSpan) *
                (scoreTimeSeconds - previousObservedScoreTime)
            : scoreTimeSeconds;
        latestTimingError = (crossing - declared.plantTimeSeconds) * 1000;
        maxTimingError = Math.max(maxTimingError, Math.abs(latestTimingError));
      }
      observedFootfalls = Math.max(observedFootfalls, completed);
      previousObservedStep = observedStep;
      previousObservedScoreTime = scoreTimeSeconds;
    }

    x = sample.position.x;
    z = sample.position.z;
    travelled = plan.distance * sample.progress;
    facing = Math.atan2(plan.direction.x, plan.direction.z);
    const moving = running && !(timingSample?.arrived ?? sample.arrived);

    onState({
      t,
      x,
      z,
      facing,
      isMoving: moving,
      // Each braking placement has its own distance. Feeding that distance's
      // speed keeps stride warping matched to the root plan instead of asking
      // the feet to keep a steady-loop stride while the body decelerates.
      speed: moving ? sample.speed : 0,
      direction: { x: 0, z: 1 },
      worldMotionMatchesGait: gaitClock !== null,
      phase: sample.arrived
        ? `arrived on step ${plan.steps}`
        : `walking to mark · step ${sample.step.toFixed(1)} of ${plan.steps}`,
      travelled,
      plannedSteps: plan.steps,
      completedSteps: sample.step,
      endpointError: plan.distance - travelled,
      ...(gaitTimingPlan && {
        timing: {
          planId: gaitTimingPlan.id,
          scoreTimeSeconds,
          observedFootfalls,
          nextPlantBeat: timingSample?.nextFootfall?.plantBeat ?? null,
          latestErrorMilliseconds: latestTimingError,
          maxErrorMilliseconds: maxTimingError,
          settled: timingSample?.settled ?? false,
        },
      }),
      turnRequest: null,
      terminalStepPlan: null,
    });
  }

  function manualTick(input: ManualInput, dt: number): WalkTick {
    facing += input.turn * MANUAL_TURN_RATE * dt;
    const moving = input.forward !== 0 || input.right !== 0;
    return {
      facing,
      isMoving: moving,
      rate: moving ? 1 : 0,
      direction: { x: input.right, z: input.forward },
      phase: moving ? "driven" : "standing",
    };
  }

  useTask((rawDelta) => {
    // A tab that was in the background hands back one enormous delta, which
    // would teleport the character across the arena and write a jolt into the
    // buffer that nothing in the rig did.
    const dt = Math.min(rawDelta, 1 / 20);

    if (destinationPlan) {
      driveDestination(
        destinationPlan,
        running ? dt : 0,
        running ? rawDelta : 0
      );
      return;
    }

    if (running && !holdPatternTime) t += dt;

    const tick = manual
      ? manualTick(manual, running ? dt : 0)
      : pattern.tick(t % pattern.period(speed), speed);

    if (manual || tick.turnRequest) {
      patternTerminalStepPlan = null;
    } else if (!patternTerminalStepPlan && tick.terminalIntent && gaitClock) {
      patternTerminalStepPlan = createPatternTerminalStepPlan({
        intent: tick.terminalIntent,
        gaitStep: gaitClock.step,
        cadence: gaitClock.cadence,
        speed: speed * tick.rate,
      });
    }
    const terminalStatus = gaitClock?.terminal?.status;
    holdPatternTime =
      !manual &&
      tick.waitForTerminalSettle === true &&
      (terminalStatus === "braking" || terminalStatus === "landed");

    facing = tick.facing;

    const fallbackStep = stepOf(tick, running ? speed : 0, dt);
    const currentDistanceStep = gaitClock?.distanceStep;
    const worldMotionMatchesGait =
      !manual &&
      tick.isMoving &&
      gaitClock?.moving === true &&
      gaitClock.cadence > 1e-6 &&
      currentDistanceStep !== undefined &&
      previousGaitDistanceStep !== null &&
      currentDistanceStep >= previousGaitDistanceStep;
    const step = worldMotionMatchesGait
      ? stepOfGaitDistance(
          tick,
          running ? speed : 0,
          gaitClock!.cadence,
          currentDistanceStep! - previousGaitDistanceStep!
        )
      : fallbackStep;
    previousGaitDistanceStep = currentDistanceStep ?? null;
    x += step.dx;
    z += step.dz;
    travelled += step.distance;

    const length = Math.hypot(tick.direction.x, tick.direction.z);
    onState({
      t,
      x,
      z,
      facing,
      isMoving: step.distance > 0,
      speed: dt > 0 ? step.distance / dt : 0,
      direction:
        length > 1e-6
          ? { x: tick.direction.x / length, z: tick.direction.z / length }
          : { x: 0, z: 1 },
      worldMotionMatchesGait,
      phase: tick.phase,
      travelled,
      turnRequest: tick.turnRequest ?? null,
      terminalStepPlan: patternTerminalStepPlan,
    });
  });
</script>
