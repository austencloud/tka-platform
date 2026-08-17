import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { PropType as ScenePropType } from "@austencloud/scene-3d";

/**
 * The 3D package carries its own PropType, and it only lists props it has a
 * model for. Every app prop used to appear there too, so passing one straight
 * through happened to typecheck. The energy pair broke that: they are 2D
 * cosmetics with no 3D asset of their own.
 *
 * They each follow a physical parent — Energy Saber spins exactly like a sword,
 * Energy Staff exactly like a staff — so the rig borrows that parent's model
 * rather than rendering nothing. Every other prop passes through unchanged.
 */
const SCENE_PROP_SUBSTITUTES: Partial<Record<PropType, ScenePropType>> = {
  [PropType.ENERGY_SABER]: ScenePropType.SWORD,
  [PropType.ENERGY_STAFF]: ScenePropType.STAFF,
  // The LED baton has its own 2D artwork but no entry in the scene package's
  // enum yet, so the rig borrows the staff model. Delete this line in the same
  // change that adds a baton member to that enum and a CapsuleBaton3D branch to
  // Prop3D — leaving it would silently shadow the real model.
  [PropType.CAPSULE_BATON]: ScenePropType.STAFF,
};

export function toScenePropType(propType: PropType): ScenePropType {
  return SCENE_PROP_SUBSTITUTES[propType] ?? (propType as unknown as ScenePropType);
}
