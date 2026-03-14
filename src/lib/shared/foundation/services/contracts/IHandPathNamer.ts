import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

/**
 * Converts hand path location arrays to/from compact human-readable names.
 *
 * Mixed case distinguishes intercardinals from cardinals:
 *   Cardinals (N, E, S, W) are uppercase.
 *   Intercardinals (Ne, Se, Sw, Nw) are title-case.
 *
 * Example: ["n", "ne", "s", "w"] → "NNeSW"
 */
export interface IHandPathNamer {
  toName(locations: readonly GridLocation[]): string;
  fromName(name: string): GridLocation[];
}
