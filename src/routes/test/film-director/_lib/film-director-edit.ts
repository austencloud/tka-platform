/**
 * Control-surface edits, applied to the authored document.
 *
 * The Director's live scene is a projection of `sourceInput`, so an edit that
 * mutates the viewer's performers would be discarded the next time the
 * document re-applied — on a scene cut, a scrub, or a sequence-library
 * refresh. Edits patch the document instead and let re-resolution drive the
 * scene, which is the same path the JSON editor already takes.
 *
 * Spec: docs/superpowers/specs/active/2026-08-25-director-control-surface-design.md
 */

import { isDirectiveExpression, normalizeDirective } from "./directives";
import type { DirectiveValue } from "./directives";
import { FilmDirectorInputSchema } from "./film-director-schema";
import type {
  DirectorPerformerSequence,
  FilmDirectorInput,
  ResolvedDirectorPerformer,
  ResolvedFilmDirectorSpec,
} from "./film-director-schema";

/** Axes whose authored value may be a directive, so they are freeze-sensitive. */
export const DIRECTIVE_PERFORMER_FIELDS = [
  "characterId",
  "prop",
  "effect",
  "effort",
  "staffLengthCm",
  "leftPlane",
  "rightPlane",
] as const;

export type DirectivePerformerField = (typeof DIRECTIVE_PERFORMER_FIELDS)[number];
export type PerformerEditableField = DirectivePerformerField | "sequence";

export type PerformerEditValue =
  | string
  | number
  | null
  | DirectorPerformerSequence;

export interface PerformerEdit {
  sceneId: string;
  /**
   * Every performer the change applies to. The control surface's
   * All-Performers scope sends the whole cast, which has to land as one patch:
   * a per-performer loop would re-resolve between writes and could leave the
   * document half-edited if a later one failed to validate.
   */
  performerIds: readonly string[];
  field: PerformerEditableField;
  value: PerformerEditValue;
}

/** A mutable view of the performer slots in a scene's authored performance. */
type PerformerSlot = Record<string, unknown>;

function isDirectiveField(
  field: PerformerEditableField
): field is DirectivePerformerField {
  return (DIRECTIVE_PERFORMER_FIELDS as readonly string[]).includes(field);
}

function drawsFromStream(value: unknown): boolean {
  if (value === undefined) return false;
  if (!isDirectiveExpression(value as DirectiveValue<string>)) return false;
  return normalizeDirective(value as DirectiveValue<string>).kind === "pick";
}

/**
 * The document slots for a scene's cast, in resolved order, materializing a
 * `cast` block's implicit performers so an edit has somewhere to land.
 * Returns null when the scene declares no cast at all.
 */
function performerSlots(
  performance: Record<string, unknown>,
  castSize: number
): { slots: PerformerSlot[]; defaults: PerformerSlot | null } | null {
  const explicit = performance.performers as PerformerSlot[] | undefined;
  if (explicit) return { slots: explicit, defaults: null };

  const cast = performance.cast as
    | { count: number; defaults?: PerformerSlot; performers?: PerformerSlot[] }
    | undefined;
  if (!cast) return null;

  // buildCastPerformerInputs matches overrides to `performer-N` by id first,
  // so materializing every slot with its canonical id keeps the same mapping
  // an unedited document already had.
  const existing = cast.performers ?? [];
  const byId = new Map<string, PerformerSlot>();
  const idLess: PerformerSlot[] = [];
  for (const override of existing) {
    if (typeof override.id === "string") byId.set(override.id, override);
    else idLess.push(override);
  }

  let cursor = 0;
  const slots: PerformerSlot[] = [];
  for (let index = 0; index < castSize; index += 1) {
    const id = `performer-${index + 1}`;
    let slot = byId.get(id);
    if (!slot) {
      while (cursor < idLess.length && idLess[cursor]!.id !== undefined) {
        cursor += 1;
      }
      slot = idLess[cursor];
      if (slot) {
        cursor += 1;
        slot.id = id;
      }
    }
    if (!slot) {
      slot = { id };
    }
    slots.push(slot);
  }

  cast.performers = slots;
  return { slots, defaults: (cast.defaults as PerformerSlot | undefined) ?? null };
}

function resolvedValue(
  performer: ResolvedDirectorPerformer,
  field: DirectivePerformerField
): string | number | null {
  return performer[field] as string | number | null;
}

export class PerformerEditError extends Error {}

/**
 * Applies one control-surface edit and returns the patched document.
 *
 * The input is never mutated. The result is schema-validated before it is
 * returned, so a rejected edit leaves the caller's document untouched.
 */
export function applyPerformerEdit(
  input: FilmDirectorInput,
  resolved: ResolvedFilmDirectorSpec,
  edit: PerformerEdit
): FilmDirectorInput {
  const next = structuredClone(input) as unknown as {
    scenes: { id: string; performance?: Record<string, unknown> }[];
  };

  const resolvedScene = resolved.scenes.find(
    (scene) => scene.id === edit.sceneId
  );
  const scene = next.scenes.find((candidate) => candidate.id === edit.sceneId);
  if (!resolvedScene || !scene) {
    throw new PerformerEditError(`No scene "${edit.sceneId}" in this film.`);
  }

  const cast = resolvedScene.performance.performers;
  const targetIndexes = edit.performerIds.map((performerId) => {
    const index = cast.findIndex((performer) => performer.id === performerId);
    if (index < 0) {
      throw new PerformerEditError(
        `Scene "${edit.sceneId}" has no performer "${performerId}".`
      );
    }
    return index;
  });
  if (targetIndexes.length === 0) {
    throw new PerformerEditError("An edit has to name at least one performer.");
  }

  scene.performance ??= {};
  const layout = performerSlots(scene.performance, cast.length);
  if (!layout) {
    throw new PerformerEditError(
      `Scene "${edit.sceneId}" declares no cast to edit.`
    );
  }

  if (isDirectiveField(edit.field)) {
    freezeStreamDraws(layout, cast, edit.field);
  }

  for (const targetIndex of targetIndexes) {
    const slot = layout.slots[targetIndex]!;
    if (edit.value === null && edit.field !== "staffLengthCm") {
      delete slot[edit.field];
    } else {
      slot[edit.field] = edit.value;
    }
  }

  try {
    return FilmDirectorInputSchema.parse(next) as FilmDirectorInput;
  } catch (error) {
    throw new PerformerEditError(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Pins every value on this axis that would otherwise be drawn from the seed.
 *
 * Seeded draws are position-dependent within a (scene, axis) pair, so writing
 * one concrete value shifts the stream and re-rolls every later pick on that
 * axis. Writing each drawn value down as a literal first removes the draws
 * entirely, which makes the shift unrepresentable rather than merely unlikely.
 * `sameAs` and already-literal values are left alone: neither consumes the
 * stream, and `sameAs` is an authored intent that should keep following.
 */
function freezeStreamDraws(
  layout: { slots: PerformerSlot[]; defaults: PerformerSlot | null },
  cast: readonly ResolvedDirectorPerformer[],
  field: DirectivePerformerField
): void {
  const defaultDraws = drawsFromStream(layout.defaults?.[field]);
  const anyDraw =
    defaultDraws ||
    layout.slots.some((slot) => drawsFromStream(slot[field]));
  if (!anyDraw) return;

  layout.slots.forEach((slot, index) => {
    const performer = cast[index];
    if (!performer) return;
    const authored = slot[field];
    const inherits = authored === undefined;
    if (!drawsFromStream(authored) && !(inherits && defaultDraws)) return;
    const value = resolvedValue(performer, field);
    if (value === null) delete slot[field];
    else slot[field] = value;
  });

  if (defaultDraws && layout.defaults) delete layout.defaults[field];
}
