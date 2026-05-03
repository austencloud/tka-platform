import type { DexiePersistenceService } from "../../persistence/services/implementations/DexiePersistenceService";
import { getPersistenceService as getPersistenceServiceSingleton } from "../../persistence/getPersistenceService";
import type { SettingsState } from "$lib/shared/settings/state/SettingsState.svelte";
import { settingsService as settingsServiceSingleton } from "../../settings/state/SettingsState.svelte";
import { getAnimationVisibilityManager } from "../../animation-engine/state/animation-visibility-state.svelte";

// ============================================================================
// HMR STATE PRESERVATION
// ============================================================================
// Without this, every HMR update resets isInitialized to false, which triggers
// the full initialization cascade (auth → Firestore → settings → theme).
const hmrData = import.meta.hot?.data as
  | { isInitialized?: boolean; settingsService?: SettingsState | null; persistenceService?: DexiePersistenceService | null }
  | undefined;

// Make isInitialized reactive so components using getSettings() will re-evaluate
let isInitialized = $state(hmrData?.isInitialized ?? false);
let settingsService: SettingsState | null = hmrData?.settingsService ?? null;
let persistenceService: DexiePersistenceService | null = hmrData?.persistenceService ?? null;

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.isInitialized = isInitialized;
    data.settingsService = settingsService;
    data.persistenceService = persistenceService;
  });
}

export async function initializeAppServices(): Promise<void> {
  if (isInitialized) return;

  settingsService = settingsServiceSingleton;
  isInitialized = true;

  // Sync darkMode from AppSettings to animation visibility manager
  // This ensures animations render correctly with the user's persisted setting
  syncDarkModeToAnimationManager();
}

/**
 * Sync the darkMode setting from AppSettings to the animation visibility manager.
 * Called after settings are loaded to ensure animations use the correct setting.
 */
function syncDarkModeToAnimationManager(): void {
  if (!settingsService) return;

  const darkMode = settingsService.settings.darkMode ?? false;
  getAnimationVisibilityManager().setDarkMode(darkMode);
}

export function clearAppServicesCache(): void {
  isInitialized = false;
  settingsService = null;
  persistenceService = null;
}

export function getSettingsServiceSync(): SettingsState {
  if (!settingsService) {
    throw new Error(
      "Settings service not initialized. Call initializeAppServices first."
    );
  }
  return settingsService;
}

export async function getSettingsService(): Promise<SettingsState> {
  if (!settingsService) {
    settingsService = settingsServiceSingleton;
  }
  if (!settingsService) {
    throw new Error("Settings service is null after resolution");
  }
  return settingsService;
}

export async function getPersistenceService(): Promise<DexiePersistenceService> {
  if (!persistenceService) {
    persistenceService = getPersistenceServiceSingleton();
  }
  if (!persistenceService) {
    throw new Error("Persistence service is null after resolution");
  }
  return persistenceService;
}

export function areServicesInitialized(): boolean {
  return isInitialized;
}
