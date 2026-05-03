import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

// Maps each GridLocation value to its compact abbreviation.
// Cardinals are uppercase; intercardinals are title-case so "NE" (North→East)
// and "Ne" (Northeast) are visually distinct in a concatenated name.
const LOCATION_TO_ABBR: Record<GridLocation, string> = {
  [GridLocation.NORTH]: "N",
  [GridLocation.EAST]: "E",
  [GridLocation.SOUTH]: "S",
  [GridLocation.WEST]: "W",
  [GridLocation.NORTHEAST]: "Ne",
  [GridLocation.SOUTHEAST]: "Se",
  [GridLocation.SOUTHWEST]: "Sw",
  [GridLocation.NORTHWEST]: "Nw",
  [GridLocation.CENTER]: "C",
};

// Reverse map for fromName(). Sorted longest-first so the greedy scanner
// matches "Ne" before it could mistakenly match a bare "N".
const ABBR_TO_LOCATION: Array<{ abbr: string; location: GridLocation }> = (
  Object.entries(LOCATION_TO_ABBR) as Array<[GridLocation, string]>
)
  .map(([location, abbr]) => ({ abbr, location }))
  .sort((a, b) => b.abbr.length - a.abbr.length);

export class HandPathNamer {
  toName(locations: readonly GridLocation[]): string {
    return locations.map((loc) => LOCATION_TO_ABBR[loc] ?? loc).join("");
  }

  /**
   * Greedy longest-match scanner (matches "Ne" before "N").
   */
  fromName(name: string): GridLocation[] {
    const result: GridLocation[] = [];
    let remaining = name;

    while (remaining.length > 0) {
      const match = ABBR_TO_LOCATION.find((entry) =>
        remaining.startsWith(entry.abbr)
      );

      if (!match) {
        throw new Error(
          `HandPathNamer.fromName: unrecognized segment at "${remaining}" in "${name}"`
        );
      }

      result.push(match.location);
      remaining = remaining.slice(match.abbr.length);
    }

    return result;
  }
}
