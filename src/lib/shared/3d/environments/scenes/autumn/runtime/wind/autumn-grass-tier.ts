import type { AutumnQualityTier } from "../../quality/autumn-quality";

const GRASS_TIER_ORDER: Record<AutumnQualityTier, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function getAutumnGrassTierFromName(
  objectName: string
): AutumnQualityTier | null {
  if (objectName.startsWith("Autumn_Grass_Base")) return "low";
  if (objectName.startsWith("Autumn_Grass_Medium")) return "medium";
  if (objectName.startsWith("Autumn_Grass_High")) return "high";
  return null;
}

export function isAutumnGrassTierVisible(
  objectName: string,
  qualityTier: AutumnQualityTier
): boolean {
  const grassTier = getAutumnGrassTierFromName(objectName);
  return (
    grassTier !== null &&
    GRASS_TIER_ORDER[grassTier] <= GRASS_TIER_ORDER[qualityTier]
  );
}
