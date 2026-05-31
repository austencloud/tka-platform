import type { PictographData } from "../models/pictograph-data";

export function createPictographData(
  data: Partial<PictographData> = {}
): PictographData {
  // Build object conditionally using object spread to avoid undefined assignments
  return {
    id: data.id || crypto.randomUUID(),
    motions: data.motions || {},
    // Only include optional properties if they are not undefined
    ...(data.letter !== undefined && { letter: data.letter }),
    ...(data.startPosition !== undefined && {
      startPosition: data.startPosition,
    }),
    ...(data.endPosition !== undefined && { endPosition: data.endPosition }),
    ...(data.category !== undefined && { category: data.category }),
  };
}
