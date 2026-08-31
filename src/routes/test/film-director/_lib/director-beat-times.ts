/**
 * Beats are surface grammar; seconds are the machine's only internal unit.
 *
 * A director counts music, not a stopwatch — "walk in for four beats" is
 * speakable where "walk in for 2.667 seconds" is not. Every duration field in
 * the scene schema accepts a `durationBeats` twin (and camera keyframes an
 * `atBeats` twin), and this module rewrites them into seconds ONCE, at the top
 * of resolveScene, using the scene's own bpm. Every compiler downstream
 * (move windows, blocking, camera) keeps thinking in seconds and never learns
 * beats exist.
 *
 * Schema-level bounds on durationSeconds (scene 1-60, transition 0-3) cannot
 * see a beats-stated value, so the converter re-checks the converted result
 * here and speaks the error in beats.
 */
import type { DirectorSceneInput } from "./film-director-schema";

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}

/**
 * The scene's tempo, plus whether the director actually stated it. When
 * `stated` is false, `value` is the 90bpm fallback the caller substituted —
 * error copy must say "the default 90 bpm", never "90 bpm", so the director
 * isn't told they typed a number they never wrote.
 */
export interface SceneBpm {
  value: number;
  stated: boolean;
}

interface BeatTimed {
  durationSeconds?: number;
  durationBeats?: number;
}

/** Two-decimal display for a user-facing seconds value — see the sibling
 * helper of the same name/intent in director-move-windows.ts and
 * blocking-language.ts. `toFixed(1)` could print a value inside the very
 * range the message claims it violates (0.993s -> "1.0s"); two decimals
 * pushes that boundary case out of visible range. */
const fmt = (n: number): string => String(Number(n.toFixed(2)));

function convertDuration<T extends BeatTimed>(value: T, bpm: number): T {
  if (value.durationBeats === undefined) return value;
  const { durationBeats, ...rest } = value;
  return { ...rest, durationSeconds: beatsToSeconds(durationBeats, bpm) } as T;
}

function describeBeats(beats: number, bpm: SceneBpm): string {
  const seconds = beatsToSeconds(beats, bpm.value);
  const bpmClause = bpm.stated ? `${bpm.value} bpm` : `the default ${bpm.value} bpm`;
  return `${beats} beats at ${bpmClause} is ${fmt(seconds)}s`;
}

export function convertSceneBeatTimes(
  scene: DirectorSceneInput,
  bpm: SceneBpm
): DirectorSceneInput {
  let converted: DirectorSceneInput = scene;
  // Never mutates `scene` — lazily clones it into `converted` on first
  // write, so a scene with no beats fields returns the identical input
  // reference untouched.
  const writable = () => {
    if (converted === scene) converted = { ...scene };
    return converted as DirectorSceneInput & Record<string, unknown>;
  };

  if (scene.durationBeats !== undefined) {
    const seconds = beatsToSeconds(scene.durationBeats, bpm.value);
    if (seconds < 1 || seconds > 60) {
      throw new Error(
        `Scene "${scene.id}": ${describeBeats(scene.durationBeats, bpm)} — scenes run 1-60 seconds.`
      );
    }
    const target = writable();
    delete target.durationBeats;
    target.durationSeconds = seconds;
  }

  if (scene.transition?.durationBeats !== undefined) {
    const seconds = beatsToSeconds(scene.transition.durationBeats, bpm.value);
    if (seconds > 3) {
      throw new Error(
        `Scene "${scene.id}": transition ${describeBeats(scene.transition.durationBeats, bpm)} — transitions top out at 3 seconds.`
      );
    }
    const target = writable();
    target.transition = convertDuration(scene.transition, bpm.value);
  }

  if (scene.performance) {
    const performance = { ...scene.performance };
    let performanceChanged = false;

    if (performance.blocking?.durationBeats !== undefined) {
      performance.blocking = convertDuration(performance.blocking, bpm.value);
      performanceChanged = true;
    }

    const convertMoves = <
      T extends { blocking?: readonly BeatTimed[] } | undefined,
    >(
      owner: T
    ): T => {
      if (!owner?.blocking?.some((move) => move.durationBeats !== undefined)) {
        return owner;
      }
      return {
        ...owner,
        blocking: owner.blocking.map((move) => convertDuration(move, bpm.value)),
      };
    };

    if (performance.performers) {
      const next = performance.performers.map((performer) =>
        convertMoves(performer)
      );
      if (next.some((performer, i) => performer !== performance.performers![i])) {
        performance.performers = next;
        performanceChanged = true;
      }
    }
    if (performance.cast) {
      const cast = { ...performance.cast };
      let castChanged = false;
      const defaults = convertMoves(cast.defaults);
      if (defaults !== cast.defaults) {
        cast.defaults = defaults;
        castChanged = true;
      }
      if (cast.performers) {
        const next = cast.performers.map((performer) => convertMoves(performer));
        if (next.some((performer, i) => performer !== cast.performers![i])) {
          cast.performers = next;
          castChanged = true;
        }
      }
      if (castChanged) {
        performance.cast = cast;
        performanceChanged = true;
      }
    }

    if (performanceChanged) writable().performance = performance;
  }

  if (scene.camera) {
    const camera = { ...scene.camera };
    let cameraChanged = false;

    if (camera.moves?.some((move) => move.durationBeats !== undefined)) {
      camera.moves = camera.moves.map((move) => convertDuration(move, bpm.value));
      cameraChanged = true;
    }
    if (camera.keyframes?.some((frame) => frame.atBeats !== undefined)) {
      camera.keyframes = camera.keyframes.map((frame) => {
        if (frame.atBeats === undefined) return frame;
        const { atBeats, ...rest } = frame;
        return { ...rest, atSeconds: beatsToSeconds(atBeats, bpm.value) };
      });
      cameraChanged = true;
    }

    if (cameraChanged) writable().camera = camera;
  }

  return converted;
}
