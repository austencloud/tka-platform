import type { TabId } from "../../../navigation/domain/types";

// Centralized UI state leveraging Svelte 5 runes.
// Uses TabId (which includes both ModuleId and LegacyTabId) for backwards compatibility
export const uiState = $state({
  activeModule: null as TabId | null, // Start null - will be set after services load in initializeModulePersistence()
  showSettings: false,
  // Default to "desktop" mode - mobile will override this when navigation buttons are clicked
  // Desktop is the primary/default experience (769px+)
  settingsPanelMode: (typeof window !== "undefined" && window.innerWidth >= 769
    ? "desktop"
    : "mobile") as "mobile" | "desktop",
  isFullScreen: false,
  isTransitioning: false,
  isWaitingForModuleLoad: false,
  showDebugPanel: false, // Admin-only debug console
});

// MODULE STATE (Primary API)

export function getActiveModule(): TabId | null {
  return uiState.activeModule;
}

export function getActiveModuleOrDefault(): TabId {
  return uiState.activeModule || "create";
}

export function setActiveModule(module: TabId | null): void {
  uiState.activeModule = module;
}

export function isModuleActive(module: string): boolean {
  return uiState.activeModule === module;
}

// LEGACY TAB API (for backwards compatibility)
// @deprecated Use module functions instead

/** @deprecated Use getActiveModule() instead */
export function getActiveTab(): TabId | null {
  return getActiveModule();
}

/** @deprecated Use getActiveModuleOrDefault() instead */
export function getActiveTabOrDefault(): TabId {
  return getActiveModuleOrDefault();
}

/** @deprecated Use setActiveModule() instead */
export function setActiveTab(module: TabId | null): void {
  setActiveModule(module);
}

/** @deprecated Use isModuleActive() instead */
export function isTabActive(module: string): boolean {
  return isModuleActive(module);
}

// SETTINGS STATE (DEPRECATED - Settings is now a module)
// These functions are deprecated. Use handleModuleChange("settings") instead.
// The settings panel has been replaced with a full module at ModuleId="settings"

/** @deprecated Settings is now a module. Use handleModuleChange("settings") instead */
export function getShowSettings(): boolean {
  console.warn("getShowSettings() is deprecated. Settings is now a module.");
  return uiState.showSettings;
}

/** @deprecated Settings is now a module. This function will be removed. */
export function getSettingsPanelMode(): "mobile" | "desktop" {
  console.warn(
    "getSettingsPanelMode() is deprecated. Settings is now a module."
  );
  return uiState.settingsPanelMode;
}

/** @deprecated Settings is now a module. Use handleModuleChange("settings") instead */
export function setShowSettings(show: boolean): void {
  console.warn("setShowSettings() is deprecated. Settings is now a module.");
  uiState.showSettings = show;
}

/** @deprecated Settings is now a module. This function will be removed. */
export function setSettingsPanelMode(mode: "mobile" | "desktop"): void {
  console.warn(
    "setSettingsPanelMode() is deprecated. Settings is now a module."
  );
  uiState.settingsPanelMode = mode;
}

/** @deprecated Settings is now a module. Use handleModuleChange("settings") instead */
export function toggleShowSettings(): void {
  console.warn("toggleShowSettings() is deprecated. Settings is now a module.");
  uiState.showSettings = !uiState.showSettings;
}

/** @deprecated Settings is now a module. Use handleModuleChange("settings") instead */
export function showSettingsDialog(mode?: "mobile" | "desktop"): void {
  console.warn(
    "showSettingsDialog() is deprecated. Settings is now a module. Use handleModuleChange('settings')."
  );
  if (mode) {
    setSettingsPanelMode(mode);
  }
  setShowSettings(true);
}

/** @deprecated Settings is now a module. Use handleModuleChange(previousModule) instead */
export function hideSettingsDialog(): void {
  console.warn("hideSettingsDialog() is deprecated. Settings is now a module.");
  setShowSettings(false);
}

/** @deprecated Settings is now a module. Use navigation toggle instead */
export function toggleSettingsDialog(mode?: "mobile" | "desktop"): void {
  console.warn(
    "toggleSettingsDialog() is deprecated. Settings is now a module."
  );
  if (mode) {
    setSettingsPanelMode(mode);
  }
  toggleShowSettings();
}


export function getIsFullScreen(): boolean {
  return uiState.isFullScreen;
}

export function setFullScreen(fullScreen: boolean): void {
  uiState.isFullScreen = fullScreen;
}


export function getIsTransitioning(): boolean {
  return uiState.isTransitioning;
}

export function setIsTransitioning(isTransitioning: boolean): void {
  uiState.isTransitioning = isTransitioning;
}


export function getIsWaitingForModuleLoad(): boolean {
  return uiState.isWaitingForModuleLoad;
}

export function setIsWaitingForModuleLoad(waiting: boolean): void {
  uiState.isWaitingForModuleLoad = waiting;
}

/** @deprecated Use getIsWaitingForModuleLoad() instead */
export function getIsWaitingForTabLoad(): boolean {
  return getIsWaitingForModuleLoad();
}

/** @deprecated Use setIsWaitingForModuleLoad() instead */
export function setIsWaitingForTabLoad(waiting: boolean): void {
  setIsWaitingForModuleLoad(waiting);
}

// DEBUG PANEL STATE (Admin Only)

export function getShowDebugPanel(): boolean {
  return uiState.showDebugPanel;
}

export function setShowDebugPanel(show: boolean): void {
  uiState.showDebugPanel = show;
}

export function toggleDebugPanel(): void {
  uiState.showDebugPanel = !uiState.showDebugPanel;
}

export function openDebugPanel(): void {
  uiState.showDebugPanel = true;
}

export function closeDebugPanel(): void {
  uiState.showDebugPanel = false;
}


export function resetUIState(): void {
  uiState.activeModule = "create";
  uiState.showSettings = false;
  uiState.isFullScreen = false;
  uiState.isTransitioning = false;
  uiState.isWaitingForModuleLoad = false;
  uiState.showDebugPanel = false;
}
