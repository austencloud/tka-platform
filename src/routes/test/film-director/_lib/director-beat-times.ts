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
 * Bars (gap 22) are the same story one level up: `durationBars`/`atBars`
 * become beats through the scene's meter, and then beats become seconds, so
 * only this module ever holds three units at once.
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
  /**
   * Gap 22. Beats in a bar, from `performance.meter`. Absent means the
   * unmarked count-off, four.
   */
  beatsPerBar?: number;
}

export const DEFAULT_BEATS_PER_BAR = 4;

interface BeatTimed {
  durationSeconds?: number;
  durationBeats?: number;
  durationBars?: number;
}

/**
 * Gap 22. Bars are beats times the meter, so they collapse into beats right
 * here and nothing below this line has to know they were ever spoken.
 */
function statedBeats(value: BeatTimed, bpm: SceneBpm): number | undefined {
  if (value.durationBeats !== undefined) return value.durationBeats;
  if (value.durationBars === undefined) return undefined;
  return value.durationBars * (bpm.beatsPerBar ?? DEFAULT_BEATS_PER_BAR);
}

/** Two-decimal display for a user-facing seconds value — see the sibling
 * helper of the same name/intent in director-move-windows.ts and
 * blocking-language.ts. `toFixed(1)` could print a value inside the very
 * range the message claims it violates (0.993s -> "1.0s"); two decimals
 * pushes that boundary case out of visible range. */
const fmt = (n: number): string => String(Number(n.toFixed(2)));

function statesBeatsOrBars(value: BeatTimed): boolean {
  return value.durationBeats !== undefined || value.durationBars !== undefined;
}

function convertDuration<T extends BeatTimed>(value: T, bpm: SceneBpm): T {
  const beats = statedBeats(value, bpm);
  if (beats === undefined) return value;
  const { durationBeats, durationBars, ...rest } = value;
  return {
    ...rest,
    durationSeconds: beatsToSeconds(beats, bpm.value),
  } as T;
}

function describeTime(value: BeatTimed, bpm: SceneBpm): string {
  const beats = statedBeats(value, bpm)!;
  const seconds = beatsToSeconds(beats, bpm.value);
  const bpmClause = bpm.stated ? `${bpm.value} bpm` : `the default ${bpm.value} bpm`;
  const spoken =
    value.durationBars !== undefined && value.durationBeats === undefined
      ? `${value.durationBars} bars of ${bpm.beatsPerBar ?? DEFAULT_BEATS_PER_BAR} at ${bpmClause}`
      : `${beats} beats at ${bpmClause}`;
  return `${spoken} is ${fmt(seconds)}s`;
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

  const sceneBeats = statedBeats(scene, bpm);
  if (sceneBeats !== undefined) {
    const seconds = beatsToSeconds(sceneBeats, bpm.value);
    if (seconds < 1 || seconds > 60) {
      throw new Error(
        `Scene "${scene.id}": ${describeTime(scene, bpm)} — scenes run 1-60 seconds.`
      );
    }
    const target = writable();
    delete target.durationBeats;
    delete target.durationBars;
    target.durationSeconds = seconds;
  }

  if (scene.transition && statesBeatsOrBars(scene.transition)) {
    const seconds = beatsToSeconds(statedBeats(scene.transition, bpm)!, bpm.value);
    if (seconds > 3) {
      throw new Error(
        `Scene "${scene.id}": transition ${describeTime(scene.transition, bpm)} — transitions top out at 3 seconds.`
      );
    }
    const target = writable();
    target.transition = convertDuration(scene.transition, bpm);
  }

  if (scene.performance) {
    const performance = { ...scene.performance };
    let performanceChanged = false;

    // Gap 18. Staging may be one instruction or a list of phases, and either
    // shape may count its length in beats or bars.
    if (Array.isArray(performance.blocking)) {
      const phases = performance.blocking as readonly BeatTimed[];
      if (phases.some(statesBeatsOrBars)) {
        performance.blocking = phases.map((phase) =>
          convertDuration(phase, bpm)
        ) as typeof performance.blocking;
        performanceChanged = true;
      }
    } else if (performance.blocking && statesBeatsOrBars(performance.blocking)) {
      performance.blocking = convertDuration(performance.blocking, bpm);
      performanceChanged = true;
    }

    const convertMoves = <
      T extends { blocking?: readonly BeatTimed[] } | undefined,
    >(
      owner: T
    ): T => {
      if (!owner?.blocking?.some(statesBeatsOrBars)) {
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

    if (performanceChanged) writable().performance = performance;
  }

  if (scene.camera) {
    const camera = { ...scene.camera };
    let cameraChanged = false;

    if (camera.moves?.some(statesBeatsOrBars)) {
      camera.moves = camera.moves.map((move) => convertDuration(move, bpm));
      cameraChanged = true;
    }
    // A shot counts twice over: its own length on screen, and the length of
    // each move inside it. Both convert here so the compiler downstream keeps
    // seeing nothing but seconds.
    const convertShot = <T extends BeatTimed & { moves?: readonly BeatTimed[] }>(
      shot: T
    ): T => {
      const withMoves = shot.moves?.some(statesBeatsOrBars)
        ? { ...shot, moves: shot.moves.map((move) => convertDuration(move, bpm)) }
        : shot;
      return convertDuration(withMoves, bpm);
    };

    if (camera.shots) {
      const next = camera.shots.map((shot) => convertShot(shot));
      if (next.some((shot, index) => shot !== camera.shots![index])) {
        camera.shots = next;
        cameraChanged = true;
      }
    }
    if (
      camera.keyframes?.some(
        (frame) => frame.atBeats !== undefined || frame.atBars !== undefined
      )
    ) {
      const perBar = bpm.beatsPerBar ?? DEFAULT_BEATS_PER_BAR;
      camera.keyframes = camera.keyframes.map((frame) => {
        const beats =
          frame.atBeats ??
          (frame.atBars === undefined ? undefined : frame.atBars * perBar);
        if (beats === undefined) return frame;
        const { atBeats, atBars, ...rest } = frame;
        return { ...rest, atSeconds: beatsToSeconds(beats, bpm.value) };
      });
      cameraChanged = true;
    }

    if (cameraChanged) writable().camera = camera;
  }

  return resolveSceneCues(converted, bpm);
}

/**
 * Gap 15. A cue is a name for a moment in the scene: `cues: { drop: { atBeats: 8 } }`.
 * Once named, "drop" is speakable anywhere a step is, plus `until` on a move and
 * `at` on a camera keyframe, so one edit to the cue moves every event hanging off it.
 *
 * A cue holds two readings of the same moment because the grammar asks for two.
 * A step field wants a count, and counts advance one per beat (the sampler forms
 * sequenceStep as sceneTime * bpm / 60), so a cue's step reading is its beat
 * position. A time field wants seconds. Both come from the one stated moment,
 * which is why a cue can drive a step effect, a shot boundary and a blocking
 * phase to the same instant.
 *
 * Cues resolve here, in the same pass that flattens beats and bars, so nothing
 * downstream of resolveScene ever learns cues existed.
 */
interface CueMoment {
  beats: number;
  seconds: number;
}

const perBarOf = (bpm: SceneBpm): number =>
  bpm.beatsPerBar ?? DEFAULT_BEATS_PER_BAR;

function buildCueTable(
  scene: DirectorSceneInput,
  bpm: SceneBpm
): Map<string, CueMoment> {
  const table = new Map<string, CueMoment>();
  const cues = (scene as { cues?: Record<string, Record<string, number>> }).cues;
  if (!cues) return table;
  for (const [name, moment] of Object.entries(cues)) {
    const beats =
      moment.atBeats ??
      (moment.atBars !== undefined
        ? moment.atBars * perBarOf(bpm)
        : (moment.atSeconds! * bpm.value) / 60);
    table.set(name, { beats, seconds: beatsToSeconds(beats, bpm.value) });
  }
  return table;
}

interface CueContext {
  table: Map<string, CueMoment>;
  sceneId: string;
}

function lookupCue(ctx: CueContext, name: string, where: string): CueMoment {
  const found = ctx.table.get(name);
  if (found) return found;
  const known = [...ctx.table.keys()];
  const names = known.length
    ? `The scene names ${known.map((cue) => `"${cue}"`).join(", ")}.`
    : "The scene names no cues.";
  throw new Error(
    `Scene "${ctx.sceneId}": ${where} waits for a cue named "${name}", which this scene never names. ${names}`
  );
}

/**
 * A cue read as a count. Steps are whole numbers, so a cue that lands between
 * two of them cannot be one: it would silently floor, and the director would
 * see their change happen a count early with nothing saying why.
 */
function cueStep(ctx: CueContext, name: string, where: string): number {
  const beats = lookupCue(ctx, name, where).beats;
  const rounded = Math.round(beats);
  if (Math.abs(beats - rounded) > 1e-6) {
    throw new Error(
      `Scene "${ctx.sceneId}": ${where} happens on cue "${name}", which lands on count ${fmt(beats)}. A step is a whole count, so move the cue or state the step directly.`
    );
  }
  return rounded;
}

/** Rewrites one array through `map`, returning the original when nothing moved. */
function mapKeepingIdentity<T>(
  items: readonly T[] | undefined,
  map: (item: T) => T
): readonly T[] | undefined {
  if (!items) return items;
  const next = items.map(map);
  return next.some((item, index) => item !== items[index]) ? next : items;
}

type StepListed = { step: number | string };

function resolveStepList<T extends StepListed>(
  entries: readonly T[] | undefined,
  ctx: CueContext,
  where: string
): readonly T[] | undefined {
  return mapKeepingIdentity(entries, (entry) =>
    typeof entry.step === "string"
      ? { ...entry, step: cueStep(ctx, entry.step, where) }
      : entry
  );
}

type Timed = { durationSeconds?: number; until?: string };

/**
 * `until` is a length stated as a destination: "walk until the drop". It only
 * means something if we know when the move starts, so the caller walks a cursor
 * along the list and hands each entry its own start. An entry that follows one
 * whose length was never stated has an unknown start, and says so rather than
 * guessing.
 */
function resolveUntilList<T extends Timed>(
  moves: readonly T[] | undefined,
  ctx: CueContext,
  where: string,
  startSeconds: number | undefined
): { moves: readonly T[] | undefined; endSeconds: number | undefined } {
  if (!moves) return { moves, endSeconds: startSeconds };
  let cursor = startSeconds;
  const next = moves.map((move, index) => {
    const start = cursor;
    if (move.until === undefined) {
      cursor =
        cursor !== undefined && move.durationSeconds !== undefined
          ? cursor + move.durationSeconds
          : undefined;
      return move;
    }
    const label = `${where} ${index + 1}`;
    const cue = lookupCue(ctx, move.until, label);
    if (start === undefined) {
      throw new Error(
        `Scene "${ctx.sceneId}": ${label} runs until "${move.until}", but an earlier entry never states how long it lasts, so this one has no known start.`
      );
    }
    if (cue.seconds <= start) {
      throw new Error(
        `Scene "${ctx.sceneId}": ${label} starts at ${fmt(start)}s and runs until "${move.until}" at ${fmt(cue.seconds)}s, which has already passed.`
      );
    }
    cursor = cue.seconds;
    const { until, ...rest } = move;
    return { ...rest, durationSeconds: cue.seconds - start } as T;
  });
  return {
    moves: next.some((move, index) => move !== moves[index]) ? next : moves,
    endSeconds: cursor,
  };
}

interface StepOwner {
  blocking?: readonly Timed[];
  stepPlanes?: readonly StepListed[];
  stepEffects?: readonly StepListed[];
  stepEfforts?: readonly StepListed[];
  stepStaffLengths?: readonly StepListed[];
  holds?: readonly { fromStep: number | string }[];
}

function resolvePerformerCues<T extends StepOwner>(
  owner: T | undefined,
  ctx: CueContext,
  who: string
): T | undefined {
  if (!owner) return owner;
  const next = { ...owner } as Record<string, unknown>;
  let changed = false;
  const swap = (key: string, value: unknown) => {
    if (value === (owner as Record<string, unknown>)[key]) return;
    next[key] = value;
    changed = true;
  };

  swap("stepPlanes", resolveStepList(owner.stepPlanes, ctx, `${who} plane change`));
  swap("stepEffects", resolveStepList(owner.stepEffects, ctx, `${who} effect change`));
  swap("stepEfforts", resolveStepList(owner.stepEfforts, ctx, `${who} effort change`));
  swap(
    "stepStaffLengths",
    resolveStepList(owner.stepStaffLengths, ctx, `${who} prop length`)
  );
  swap(
    "holds",
    mapKeepingIdentity(owner.holds, (hold) =>
      typeof hold.fromStep === "string"
        ? { ...hold, fromStep: cueStep(ctx, hold.fromStep, `${who} hold`) }
        : hold
    )
  );
  swap("blocking", resolveUntilList(owner.blocking, ctx, `${who} move`, 0).moves);

  return changed ? (next as T) : owner;
}

interface BlockingPhaseStart {
  startSeconds?: number;
  startStep?: number;
  startCue?: string;
}

/**
 * Gap 18. A blocking phase may open on a cue, on a count, or on a stopwatch
 * reading. All three are the same instant said three ways, so they land on
 * startSeconds here and the resolver only ever reads one field.
 */
function resolveBlockingPhaseStart<T extends BlockingPhaseStart>(
  phase: T,
  ctx: CueContext,
  bpm: SceneBpm,
  index: number
): T {
  if (phase.startCue !== undefined) {
    const cue = lookupCue(ctx, phase.startCue, `blocking phase ${index + 1}`);
    const { startCue, ...rest } = phase;
    return { ...rest, startSeconds: cue.seconds } as T;
  }
  if (phase.startStep !== undefined) {
    const { startStep, ...rest } = phase;
    return { ...rest, startSeconds: beatsToSeconds(startStep, bpm.value) } as T;
  }
  return phase;
}

interface CuedPerformance {
  blocking?: unknown;
  performers?: readonly StepOwner[];
  cast?: { defaults?: StepOwner; performers?: readonly StepOwner[] };
}

interface CuedCamera {
  moves?: readonly Timed[];
  shots?: readonly (Timed & { moves?: readonly Timed[] })[];
  keyframes?: readonly { atSeconds?: number; at?: string }[];
}

const performerLabel = (performer: StepOwner): string =>
  `performer "${(performer as { id?: string }).id ?? "?"}"`;

function resolveSceneCues(
  scene: DirectorSceneInput,
  bpm: SceneBpm
): DirectorSceneInput {
  const ctx: CueContext = { table: buildCueTable(scene, bpm), sceneId: scene.id };
  let converted: DirectorSceneInput = scene;
  const writable = () => {
    if (converted === scene) converted = { ...scene };
    return converted as DirectorSceneInput & Record<string, unknown>;
  };

  const performance = scene.performance as CuedPerformance | undefined;
  if (performance) {
    const next = { ...performance } as Record<string, unknown>;
    let changed = false;

    if (Array.isArray(performance.blocking)) {
      const phases = performance.blocking as readonly BlockingPhaseStart[];
      const started = phases.map((phase, index) =>
        resolveBlockingPhaseStart(phase, ctx, bpm, index)
      );
      if (started.some((phase, index) => phase !== phases[index])) {
        next.blocking = started;
        changed = true;
      }
    }

    const performers = mapKeepingIdentity(
      performance.performers,
      (performer) => resolvePerformerCues(performer, ctx, performerLabel(performer))!
    );
    if (performers !== performance.performers) {
      next.performers = performers;
      changed = true;
    }

    if (performance.cast) {
      const cast = { ...performance.cast };
      let castChanged = false;
      const defaults = resolvePerformerCues(cast.defaults, ctx, "the cast");
      if (defaults !== cast.defaults) {
        cast.defaults = defaults;
        castChanged = true;
      }
      const castPerformers = mapKeepingIdentity(
        cast.performers,
        (performer) => resolvePerformerCues(performer, ctx, performerLabel(performer))!
      );
      if (castPerformers !== cast.performers) {
        cast.performers = castPerformers;
        castChanged = true;
      }
      if (castChanged) {
        next.cast = cast;
        changed = true;
      }
    }

    if (changed) writable().performance = next;
  }

  const camera = scene.camera as CuedCamera | undefined;
  if (camera) {
    const next = { ...camera } as Record<string, unknown>;
    let changed = false;

    const moves = resolveUntilList(camera.moves, ctx, "camera move", 0);
    if (moves.moves !== camera.moves) {
      next.moves = moves.moves;
      changed = true;
    }

    if (camera.shots) {
      let cursor: number | undefined = 0;
      const shots = camera.shots.map((shot, index) => {
        const start = cursor;
        const inner = resolveUntilList(shot.moves, ctx, `shot ${index + 1} move`, start);
        const outer = resolveUntilList([shot], ctx, "shot", start);
        cursor = outer.endSeconds;
        const resolvedShot = outer.moves![0];
        return inner.moves === shot.moves
          ? resolvedShot
          : { ...resolvedShot, moves: inner.moves };
      });
      if (shots.some((shot, index) => shot !== camera.shots![index])) {
        next.shots = shots;
        changed = true;
      }
    }

    const keyframes = mapKeepingIdentity(camera.keyframes, (frame) => {
      if (frame.at === undefined) return frame;
      const cue = lookupCue(ctx, frame.at, "camera keyframe");
      const { at, ...rest } = frame;
      return { ...rest, atSeconds: cue.seconds };
    });
    if (keyframes !== camera.keyframes) {
      next.keyframes = keyframes;
      changed = true;
    }

    if (changed) writable().camera = next;
  }

  return converted;
}
