import { HandPathFactory } from "./HandPathFactory";
import { hashSoloProp } from "$lib/shared/foundation/services/content-hasher";
import type { SoloPropStepData } from "../../domain/models/SoloPropStepData";
import type { SoloPropData } from "../../domain/models/SoloPropData";
import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

function extractHandPathLocations(
  steps: readonly SoloPropStepData[]
): GridLocation[] {
  if (steps.length === 0) return [];

  const locations: GridLocation[] = [(steps[0] as SoloPropStepData).startLocation];
  for (const step of steps) {
    locations.push(step.endLocation);
  }
  return locations;
}

export class SoloPropFactory {
  private readonly handPathFactory = new HandPathFactory();

  create(
    steps: readonly SoloPropStepData[],
    startLocation: GridLocation,
    startOrientation: Orientation,
    metadata?: { name?: string; author?: string; notes?: string }
  ): SoloPropData {
    if (steps.length === 0) {
      throw new Error("SoloPropFactory: steps must not be empty");
    }

    const handPathLocations = extractHandPathLocations(steps);
    const handPath = this.handPathFactory.create(handPathLocations, metadata);

    const contentHash = hashSoloProp({
      startLocation,
      startOrientation,
      steps,
    });

    const id = crypto.randomUUID();

    return {
      id,
      steps,
      startLocation,
      startOrientation,
      contentHash,
      handPath,
      length: steps.length,
      bigrams: handPath.bigrams,
      impliedGridMode: handPath.impliedGridMode,
      ...metadata,
    };
  }
}
