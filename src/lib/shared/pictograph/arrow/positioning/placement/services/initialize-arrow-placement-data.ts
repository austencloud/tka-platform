let initializationPromise: Promise<void> | null = null;

/** Load every persisted placement tier independently of authentication. */
export async function initializeArrowPlacementData(): Promise<void> {
  if (initializationPromise) return initializationPromise;
  initializationPromise = Promise.all([
    import("../../global/services/global-adjustment-singleton").then(
      ({ initializeGlobalAdjustments }) => initializeGlobalAdjustments()
    ),
    import("../../prop-geometry/services/prop-geometry-singleton").then(
      ({ initializePropGeometryAdjustments }) =>
        initializePropGeometryAdjustments()
    ),
    import("../../special-override/services/special-override-singleton").then(
      ({ initializeSpecialOverrides }) => initializeSpecialOverrides()
    ),
    import("../../default-override/services/default-override-singleton").then(
      ({ initializeDefaultOverrides }) => initializeDefaultOverrides()
    ),
  ]).then(() => undefined);

  try {
    await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}
