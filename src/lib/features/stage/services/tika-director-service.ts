import {
  createAxisStream,
  resolveFilmSeed,
} from "$lib/features/film-director/domain/directive-random";
import { resolveCastAxis } from "$lib/features/film-director/domain/resolve-directives";
import { authState } from "$lib/shared/auth/state/auth-state.svelte";
import { DEPLOYED_CHARACTER_IDS } from "$lib/shared/3d/config/deployed-characters";
import type { CharacterId } from "$lib/shared/3d/domain/character-model";
import type {
  Viewer3DState,
  ViewerPerformerAppearanceAssignment,
} from "$lib/shared/3d/state/viewer-3d-state.svelte";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { filterPremiumCosmeticProps } from "$lib/shared/subscription/domain/premium-prop-access";
import type { StageChoreography } from "../domain/stage-types";
import {
  TikaDirectorResponseSchema,
  type TikaDirectorAction,
  type TikaDirectorConversationMessage,
  type TikaDirectorRequest,
  type TikaDirectorResponse,
} from "../domain/tika-director";
import { interpretStageDirectionLocally } from "../domain/tika-director-interpreter";

export async function resolveStageDirection(input: {
  prompt: string;
  conversation: readonly TikaDirectorConversationMessage[];
  choreography: StageChoreography;
  currentBeat: number;
  viewer: Viewer3DState;
}): Promise<TikaDirectorResponse> {
  const local = interpretStageDirectionLocally(input.prompt);
  if (local) return local;

  const user = authState.user;
  if (!user) {
    throw new Error("Sign in before asking TIKA to direct this scene.");
  }
  const token = await user.getIdToken();
  const viewerSnapshot = input.viewer.serialize();
  const body: TikaDirectorRequest = {
    prompt: input.prompt,
    conversation: [...input.conversation].slice(-8),
    scene: {
      id: input.choreography.id,
      name: input.choreography.name,
      bpm: input.choreography.bpm,
      currentBeat: input.currentBeat,
      performers: input.choreography.performers.map((performer, index) => {
        const look = viewerSnapshot.performers[index];
        return {
          id: performer.id,
          label: performer.label,
          characterId: look?.characterId ?? "unknown",
          prop:
            look?.settings.prop ?? viewerSnapshot.defaultProp ?? PropType.STAFF,
        };
      }),
      formations: input.choreography.formations.map((formation) => ({
        atBeat: formation.atBeat,
        ...(formation.presetId ? { presetId: formation.presetId } : {}),
      })),
    },
  };

  const response = await fetch("/api/tika/direct", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "TIKA could not interpret that direction.";
    throw new Error(message);
  }
  return TikaDirectorResponseSchema.parse(payload);
}

export function resolveDirectorAppearanceAssignments(input: {
  actions: readonly TikaDirectorAction[];
  performerIds: readonly string[];
  seedKey: string;
}): ViewerPerformerAppearanceAssignment[] {
  const assignCharacters = input.actions.some(
    (action) => action.type === "assign-distinct-characters"
  );
  const assignProps = input.actions.some(
    (action) => action.type === "assign-distinct-props"
  );
  if (!assignCharacters && !assignProps) return [];

  const seed = resolveFilmSeed(input.seedKey);
  const sceneId = "live-stage";
  const characters = assignCharacters
    ? resolveCastAxis<string>({
        axis: "characterId",
        sceneId,
        performerIds: input.performerIds,
        values: input.performerIds.map(() => ({ pick: "distinct" as const })),
        catalog: DEPLOYED_CHARACTER_IDS,
        random: createAxisStream(seed, sceneId, "characterId"),
      })
    : null;
  const propCatalog = filterPremiumCosmeticProps(Object.values(PropType));
  const props = assignProps
    ? resolveCastAxis<PropType>({
        axis: "prop",
        sceneId,
        performerIds: input.performerIds,
        values: input.performerIds.map(() => ({ pick: "distinct" as const })),
        catalog: propCatalog,
        random: createAxisStream(seed, sceneId, "prop"),
      })
    : null;

  return input.performerIds.map((_, index) => ({
    index,
    ...(characters ? { characterId: characters[index] as CharacterId } : {}),
    ...(props ? { prop: props[index] } : {}),
  }));
}
