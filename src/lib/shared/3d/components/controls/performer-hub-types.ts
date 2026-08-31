import type { PropBuild } from "@austencloud/scene-3d";
import type { CharacterId } from "$lib/shared/3d/domain/character-model";
import type { EffectType } from "$lib/shared/effects/domain/effects-config";
import type { EffortId } from "$lib/shared/effort/domain/effort-types";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export type PerformerHubTab =
  | "prop"
  | "planes"
  | "effort"
  | "effects"
  | "character"
  | "sequence";

/**
 * One parameter change the hub would otherwise have written straight onto a
 * performer.
 *
 * `performerIndex` is null in All-Performers mode, which means every performer
 * in the current scope.
 */
export type PerformerHubEdit =
  | { performerIndex: number | null; field: "characterId"; value: CharacterId }
  | { performerIndex: number | null; field: "prop"; value: PropType }
  | { performerIndex: number | null; field: "propBuild"; value: PropBuild }
  | { performerIndex: number | null; field: "effort"; value: EffortId }
  | { performerIndex: number | null; field: "staffLengthCm"; value: number }
  | { performerIndex: number | null; field: "effect"; value: EffectType };

/**
 * A host that owns performer state itself.
 *
 * The Director's performers are a projection of its film document, so a
 * mutation written onto the manager is discarded the next time that document
 * applies. A host that supplies this sink receives the change instead and
 * decides how to persist it; the hub does not touch the manager for any field
 * the sink accepts. Returning false means the host rejected the edit and the
 * hub should leave its own state alone.
 */
export type PerformerEditSink = (edit: PerformerHubEdit) => boolean;
