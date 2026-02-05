import type { IPersistenceService } from "../../persistence/services/contracts/IPersistenceService";
import { container } from "../../di";
import type { ISettingsState } from "../../settings/services/contracts/ISettingsState";
import { getAnimationVisibilityManager } from "../../animation-engine/state/animation-visibility-state.svelte";

// Make isInitialized reactive so components using getSettings() will re-evaluate
let isInitialized = $state(false);
let settingsService: ISettingsState | null = null;
let persistenceService: IPersistenceService | null = null;

export async function initializeAppServices(): Promise<void> {
  if (isInitialized) return;

  settingsService = container.items.settingsState;
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

export function getSettingsServiceSync(): ISettingsState {
  if (!settingsService) {
    throw new Error(
      "Settings service not initialized. Call initializeAppServices first."
    );
  }
  return settingsService;
}

export async function getSettingsService(): Promise<ISettingsState> {
  if (!settingsService) {
    settingsService = container.items.settingsState;
  }
  if (!settingsService) {
    throw new Error("Settings service is null after resolution");
  }
  return settingsService;
}

export async function getPersistenceService(): Promise<IPersistenceService> {
  if (!persistenceService) {
    persistenceService = container.items.persistenceService;
  }
  if (!persistenceService) {
    throw new Error("Persistence service is null after resolution");
  }
  return persistenceService;
}

export function areServicesInitialized(): boolean {
  return isInitialized;
}
