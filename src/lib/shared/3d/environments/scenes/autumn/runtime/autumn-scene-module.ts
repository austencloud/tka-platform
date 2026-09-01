/** Reports a failed dynamic chunk through the same feature boundary as assets. */
export async function loadAutumnSceneModule<T>(
  importer: () => Promise<T>,
  reportFailed: (message: string) => void
): Promise<T> {
  try {
    return await importer();
  } catch (error) {
    reportFailed("Autumn scene couldn't load. Try again.");
    throw error;
  }
}
