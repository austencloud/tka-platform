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

function toHabitatCenter(center: number[]): [number, number] {
  const [x, z] = center;
  if (x === undefined || z === undefined) {
    throw new Error(
      `Autumn mushroom habitat has a center missing coordinates: ${JSON.stringify(center)}`
    );
  }
  return [x, z];
}

const rawHabitats = [
  mushroomLayout.fairyChampignonArc,
  ...mushroomLayout.amethystDeceiverDrifts,
  ...mushroomLayout.honeyFungusColonies,
];

const authoredHabitats: AuthoredMushroomHabitat[] = rawHabitats.map((habitat) => ({
  id: habitat.id,
  center: toHabitatCenter(habitat.center),
  auraRadius: habitat.auraRadius,
  auraColor: habitat.auraColor,
}));

export const AUTUMN_MAGIC_HABITATS: readonly AutumnMagicHabitat[] =
  authoredHabitats.map((habitat) => ({
    id: habitat.id,
    position: [habitat.center[0], -habitat.center[1]],
    radius: habitat.auraRadius,
    color: habitat.auraColor,
  }));
