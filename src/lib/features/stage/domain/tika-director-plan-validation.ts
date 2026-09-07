/**
 * Deterministic plan gates. Each veto lives with the verb it guards in
 * tika-capabilities/; this module keeps the names the server and tests use.
 * A gate is a veto, never action synthesis.
 */
import type {
  TikaDirectorRequest,
  TikaDirectorResponse,
} from "./tika-director";
import { assignDistinctCharactersCapability } from "./tika-capabilities/assign-distinct-characters";

export { validateTikaDirectorPlanTiming } from "./tika-capabilities/formation-transition";
export { validateTikaDirectorPlan } from "./tika-capabilities";

/**
 * A presentation filter can only be honored when enough deployed avatars carry
 * the label. Kept as a named gate for callers that check the catalog alone.
 */
export function validateTikaDirectorPlanCatalog(
  request: Pick<TikaDirectorRequest, "scene">,
  response: TikaDirectorResponse
): TikaDirectorResponse {
  if (response.kind !== "apply") return response;
  return (
    assignDistinctCharactersCapability.validate?.(
      { prompt: "", conversation: [], scene: request.scene },
      response.actions
    ) ?? response
  );
}
