export const HAND_MOTIONS_STAGE_SCHEMA_VERSION = 2;

export function migrateHandMotionsSavedStep(
  savedStep: number,
  savedSchemaVersion: number,
  handPathStageCount: number
): number {
  const legacyComparisonStep = handPathStageCount + 1;
  const comparisonStep = legacyComparisonStep + 1;

  if (
    savedSchemaVersion < HAND_MOTIONS_STAGE_SCHEMA_VERSION &&
    savedStep === legacyComparisonStep
  ) {
    return comparisonStep;
  }

  return savedStep || 1;
}
