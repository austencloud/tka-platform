import { QualityTier } from "../../../effects/types";

const GRASS_TIER_ORDER: Record<QualityTier, number> = {
  [QualityTier.LOW]: 0,
  [QualityTier.MEDIUM]: 1,
  [QualityTier.HIGH]: 2,
};

export function getForestGrassTierFromName(
  objectName: string
): QualityTier | null {
  if (objectName.startsWith("Forest_Grass_Base_")) return QualityTier.LOW;
  if (objectName.startsWith("Forest_Grass_Medium_")) return QualityTier.MEDIUM;
  if (objectName.startsWith("Forest_Grass_High_")) return QualityTier.HIGH;
  return null;
}

export function isForestGrassTierVisible(
  objectName: string,
  qualityTier: QualityTier
): boolean {
  const grassTier = getForestGrassTierFromName(objectName);
  return (
    grassTier !== null &&
    GRASS_TIER_ORDER[grassTier] <= GRASS_TIER_ORDER[qualityTier]
  );
}
