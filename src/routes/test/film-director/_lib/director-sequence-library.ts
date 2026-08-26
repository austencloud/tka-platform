/**
 * Resolves each performer's directed sequence into real SequenceData.
 *
 * The film schema lets a performer say what they spin — the shared demo, a
 * directed sequence, or another performer's sequence mirrored. Generating a
 * directed sequence is async, so this sits between the synchronous spec
 * resolver and the location: the scene asks for a scene's sequences, gets
 * whatever has resolved so far, and re-applies once the rest land.
 *
 * Everything is cached by what it is rather than by who asked for it, so two
 * performers who directed the same sequence share one generated result, and
 * the mirror of it is generated once no matter how many performers reflect it.
 */

import { generationOrchestrator } from "$lib/shared/create/services/generation-orchestrator";
import { mirrorSequence } from "$lib/shared/create/services/sequence-transformer";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

import type {
  ResolvedDirectorScene,
  ResolvedFilmDirectorSpec,
} from "./film-director-schema";
import {
  compileSequenceDirective,
  isGeneratedSequence,
  sequenceDirectiveKey,
  type DirectorPerformerSequence,
} from "./sequence-language";

export interface DirectorSequenceLibrary {
  /**
   * Resolve every sequence the film names. Calling it again with the same
   * film returns the first call's promise rather than regenerating.
   */
  prepare(film: ResolvedFilmDirectorSpec): Promise<void>;
  /** Performer id → sequence, for a scene that has finished resolving. */
  forScene(sceneId: string): ReadonlyMap<string, SequenceData>;
  /** Human-readable reasons a directed sequence fell back to the demo. */
  readonly failures: readonly string[];
}

const EMPTY: ReadonlyMap<string, SequenceData> = new Map();

export function createDirectorSequenceLibrary(
  demoSequence: SequenceData
): DirectorSequenceLibrary {
  const sources = new Map<string, Promise<SequenceData>>();
  const mirrors = new Map<string, Promise<SequenceData>>();
  const byScene = new Map<string, Map<string, SequenceData>>();
  const failures: string[] = [];
  let preparedFilmId: string | null = null;
  let preparing: Promise<void> | null = null;

  function resolveSource(
    sequence: DirectorPerformerSequence
  ): Promise<SequenceData> {
    const key = sequenceDirectiveKey(sequence);
    const existing = sources.get(key);
    if (existing) return existing;

    const created = isGeneratedSequence(sequence)
      ? generationOrchestrator.generateSequence(
          compileSequenceDirective(sequence)
        )
      : Promise.resolve(demoSequence);

    sources.set(key, created);
    return created;
  }

  function resolveMirror(
    sequence: DirectorPerformerSequence
  ): Promise<SequenceData> {
    const key = `mirror:${sequenceDirectiveKey(sequence)}`;
    const existing = mirrors.get(key);
    if (existing) return existing;

    const created = resolveSource(sequence).then((source) =>
      mirrorSequence(source, "both")
    );
    mirrors.set(key, created);
    return created;
  }

  async function resolveScene(scene: ResolvedDirectorScene): Promise<void> {
    const performers = scene.performance.performers;
    const byId = new Map(
      performers.map((performer) => [performer.id, performer.sequence])
    );
    const resolved = new Map<string, SequenceData>();

    await Promise.all(
      performers.map(async (performer) => {
        const directed = performer.sequence;
        try {
          if ("mirrorOf" in directed) {
            // The spec resolver already proved this names a non-mirror
            // performer in this same scene.
            const source = byId.get(directed.mirrorOf)!;
            resolved.set(performer.id, await resolveMirror(source));
            return;
          }
          resolved.set(performer.id, await resolveSource(directed));
        } catch (error: unknown) {
          const reason = error instanceof Error ? error.message : String(error);
          failures.push(
            `Scene "${scene.id}", performer "${performer.id}": ${reason}`
          );
          console.error(
            `[FilmDirector] Could not build the directed sequence for "${performer.id}" in scene "${scene.id}". Falling back to the film's demo sequence.`,
            error
          );
          resolved.set(performer.id, demoSequence);
        }
      })
    );

    byScene.set(scene.id, resolved);
  }

  function prepare(film: ResolvedFilmDirectorSpec): Promise<void> {
    if (preparedFilmId === film.id && preparing) return preparing;

    preparedFilmId = film.id;
    byScene.clear();
    failures.length = 0;
    preparing = Promise.all(film.scenes.map(resolveScene)).then(() => undefined);
    return preparing;
  }

  return {
    prepare,
    forScene: (sceneId) => byScene.get(sceneId) ?? EMPTY,
    get failures() {
      return failures;
    },
  };
}
