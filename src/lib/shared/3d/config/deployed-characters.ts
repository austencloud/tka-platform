import {
  CHARACTER_DEFINITIONS,
  type CharacterId,
} from "../domain/character-model";

/**
 * Characters whose GLB is actually deployed and loadable.
 *
 * The scene-3d registry is the deployment boundary: every definition it
 * exports has an optimized public model URL. Keep this app-facing name for
 * callers that care about deployment availability without guessing from a URL
 * scheme.
 */
export const DEPLOYED_CHARACTER_DEFINITIONS = CHARACTER_DEFINITIONS.filter(
  (character) => character.availability !== "local-evaluation"
);

export const DEPLOYED_CHARACTER_IDS: CharacterId[] =
  DEPLOYED_CHARACTER_DEFINITIONS.map(
    (character) => character.id as CharacterId
  );
