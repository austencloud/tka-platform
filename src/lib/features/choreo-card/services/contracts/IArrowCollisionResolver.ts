import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface IArrowCollisionResolver {
  resolveCollisions(beats: PictographData[]): PictographData[];
}
