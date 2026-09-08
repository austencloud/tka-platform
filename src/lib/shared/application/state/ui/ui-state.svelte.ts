import type { TabId } from "../../../navigation/domain/types";

// Centralized UI state leveraging Svelte 5 runes.
// Uses TabId (which includes both ModuleId and LegacyTabId) for backwards compatibility
export const uiState = $state({
  activeModule: null as TabId | null, // Start null - will be set after services load in initializeModulePersistence()
  showSettings: false,
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

// SETTINGS STATE (read-only; settings is now a module at ModuleId="settings")

/** @deprecated Settings is now a module. Use handleModuleChange("settings") instead */
export function getShowSettings(): boolean {
  console.warn("getShowSettings() is deprecated. Settings is now a module.");
  return uiState.showSettings;
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
