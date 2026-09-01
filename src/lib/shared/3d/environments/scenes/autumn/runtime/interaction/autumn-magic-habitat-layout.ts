import mushroomLayout from "../../../../../../../../../scripts/autumn-mushroom-layout.json";

interface AuthoredMushroomHabitat {
  id: string;
  center: [number, number];
  auraRadius: number;
  auraColor: string;
}

export interface AutumnMagicHabitat {
  id: string;
  /** Runtime X/Z; Blender's authored +Y points toward runtime -Z. */
  position: [number, number];
  radius: number;
  color: string;
}

const authoredHabitats: AuthoredMushroomHabitat[] = [
  mushroomLayout.fairyChampignonArc,
  ...mushroomLayout.amethystDeceiverDrifts,
  ...mushroomLayout.honeyFungusColonies,
];

export const AUTUMN_MAGIC_HABITATS: readonly AutumnMagicHabitat[] =
  authoredHabitats.map((habitat) => ({
    id: habitat.id,
    position: [habitat.center[0], -habitat.center[1]],
    radius: habitat.auraRadius,
    color: habitat.auraColor,
  }));
