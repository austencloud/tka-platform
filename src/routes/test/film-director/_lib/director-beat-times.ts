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

interface BeatTimed {
  durationSeconds?: number;
  durationBeats?: number;
}

function convertDuration<T extends BeatTimed>(value: T, bpm: number): T {
  if (value.durationBeats === undefined) return value;
  const { durationBeats, ...rest } = value;
  return { ...rest, durationSeconds: beatsToSeconds(durationBeats, bpm) } as T;
}

function describeBeats(beats: number, bpm: number): string {
  const seconds = beatsToSeconds(beats, bpm);
  return `${beats} beats at ${bpm} bpm is ${seconds.toFixed(1)}s`;
}

export function convertSceneBeatTimes(
  scene: DirectorSceneInput,
  bpm: number
): DirectorSceneInput {
  let converted: DirectorSceneInput = scene;
  const mutate = () => {
    if (converted === scene) converted = { ...scene };
    return converted as DirectorSceneInput & Record<string, unknown>;
  };

  if (scene.durationBeats !== undefined) {
    const seconds = beatsToSeconds(scene.durationBeats, bpm);
    if (seconds < 1 || seconds > 60) {
      throw new Error(
        `Scene "${scene.id}": ${describeBeats(scene.durationBeats, bpm)} — scenes run 1-60 seconds.`
      );
    }
    const target = mutate();
    delete target.durationBeats;
    target.durationSeconds = seconds;
  }

  if (scene.transition?.durationBeats !== undefined) {
    const seconds = beatsToSeconds(scene.transition.durationBeats, bpm);
    if (seconds > 3) {
      throw new Error(
        `Scene "${scene.id}": transition ${describeBeats(scene.transition.durationBeats, bpm)} — transitions top out at 3 seconds.`
      );
    }
    const target = mutate();
    target.transition = convertDuration(scene.transition, bpm);
  }

  if (scene.performance) {
    const performance = { ...scene.performance };
    let performanceChanged = false;

    if (performance.blocking?.durationBeats !== undefined) {
      performance.blocking = convertDuration(performance.blocking, bpm);
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
        blocking: owner.blocking.map((move) => convertDuration(move, bpm)),
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

    if (performanceChanged) mutate().performance = performance;
  }

  if (scene.camera) {
    const camera = { ...scene.camera };
    let cameraChanged = false;

    if (camera.moves?.some((move) => move.durationBeats !== undefined)) {
      camera.moves = camera.moves.map((move) => convertDuration(move, bpm));
      cameraChanged = true;
    }
    if (camera.keyframes?.some((frame) => frame.atBeats !== undefined)) {
      camera.keyframes = camera.keyframes.map((frame) => {
        if (frame.atBeats === undefined) return frame;
        const { atBeats, ...rest } = frame;
        return { ...rest, atSeconds: beatsToSeconds(atBeats, bpm) };
      });
      cameraChanged = true;
    }

    if (cameraChanged) mutate().camera = camera;
  }

  return converted;
}
