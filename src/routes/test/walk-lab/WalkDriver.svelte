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
  import { stepOf } from "$lib/shared/3d/diagnostics/gait/walk-patterns";
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
    /** Change it to put the character back at the origin. */
    resetNonce: number;
    onState: (state: WalkState) => void;
  }

  let { pattern, speed, running, manual, resetNonce, onState }: Props =
    $props();

  /** Radians a second the hand-driven mode turns at. */
  const MANUAL_TURN_RATE = 1.8;

  let t = 0;
  let x = 0;
  let z = 0;
  let facing = 0;
  let travelled = 0;

  $effect(() => {
    // Read so the reset re-runs, then clear everything the path accumulated.
    void resetNonce;
    t = 0;
    x = 0;
    z = 0;
    facing = 0;
    travelled = 0;
  });

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
    if (running) t += dt;

    const tick = manual
      ? manualTick(manual, running ? dt : 0)
      : pattern.tick(t % pattern.period(speed), speed);

    facing = tick.facing;

    const step = stepOf(tick, running ? speed : 0, dt);
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
      phase: tick.phase,
      travelled,
    });
  });
</script>
