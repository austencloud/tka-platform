import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { TabId } from "../../../navigation/domain/types";
import type { IExploreThumbnailProvider } from "../../../../features/explore/sequences/display/services/contracts/IExploreThumbnailProvider";
import {
  setSpotlightModalUrl,
  clearModalUrlState,
  cacheSequence,
  type SpotlightDisplayMode as UrlSpotlightMode,
} from "./modal-url-state.svelte";

// Spotlight display modes
export type SpotlightDisplayMode = "image" | "stepgrid" | "animation" | "video" | "split";

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
  showSpotlight: false,
  spotlightSequence: null as SequenceData | null,
  spotlightThumbnailService: null as IExploreThumbnailProvider | null,
  spotlightImageUrl: null as string | null, // Direct image URL (for Create module spotlight)
  spotlightVideoUrl: null as string | null, // Direct video URL (for Dashboard feed spotlight)
  spotlightDisplayMode: "image" as SpotlightDisplayMode, // "image", "stepgrid", "animation", or "video"
  showDebugPanel: false, // Admin-only debug console
});

// ============================================================================
// MODULE STATE (Primary API)
// ============================================================================

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

// ============================================================================
// LEGACY TAB API (for backwards compatibility)
// @deprecated Use module functions instead
// ============================================================================

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

// ============================================================================
// SETTINGS STATE (DEPRECATED - Settings is now a module)
// These functions are deprecated. Use handleModuleChange("settings") instead.
// The settings panel has been replaced with a full module at ModuleId="settings"
// ============================================================================

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

// ============================================================================
// FULLSCREEN STATE
// ============================================================================

export function getIsFullScreen(): boolean {
  return uiState.isFullScreen;
}

export function setFullScreen(fullScreen: boolean): void {
  uiState.isFullScreen = fullScreen;
}

// ============================================================================
// TRANSITION STATE
// ============================================================================

export function getIsTransitioning(): boolean {
  return uiState.isTransitioning;
}

export function setIsTransitioning(isTransitioning: boolean): void {
  uiState.isTransitioning = isTransitioning;
}

// ============================================================================
// MODULE LOADING STATE
// ============================================================================

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

// ============================================================================
// SPOTLIGHT STATE
// ============================================================================

export function getShowSpotlight(): boolean {
  return uiState.showSpotlight;
}

export function getSpotlightSequence(): SequenceData | null {
  return uiState.spotlightSequence;
}

export function getSpotlightThumbnailService(): IExploreThumbnailProvider | null {
  return uiState.spotlightThumbnailService;
}

export function getSpotlightImageUrl(): string | null {
  return uiState.spotlightImageUrl;
}

export function getSpotlightVideoUrl(): string | null {
  return uiState.spotlightVideoUrl;
}

export function getSpotlightDisplayMode(): SpotlightDisplayMode {
  return uiState.spotlightDisplayMode;
}

export function openSpotlightViewer(
  sequence: SequenceData,
  thumbnailService: IExploreThumbnailProvider
): void {
  uiState.spotlightSequence = sequence;
  uiState.spotlightThumbnailService = thumbnailService;
  uiState.spotlightImageUrl = null; // Clear direct URL when using thumbnailService
  uiState.spotlightDisplayMode = "image";
  uiState.showSpotlight = true;
  // Sync to URL for HMR persistence
  cacheSequence(sequence);
  setSpotlightModalUrl(sequence, "image" as UrlSpotlightMode);
}

/**
 * Open spotlight viewer with a direct image URL (for Create module)
 * This bypasses the need for a thumbnailService by providing a pre-rendered image
 */
export function openSpotlightWithImage(
  imageUrl: string,
  sequence?: SequenceData
): void {
  uiState.spotlightImageUrl = imageUrl;
  uiState.spotlightSequence = sequence || null;
  uiState.spotlightThumbnailService = null;
  uiState.spotlightDisplayMode = "image";
  uiState.showSpotlight = true;
  // Sync to URL for HMR persistence (only if sequence provided)
  if (sequence) {
    cacheSequence(sequence);
    setSpotlightModalUrl(sequence, "image" as UrlSpotlightMode);
  }
}

/**
 * Open spotlight viewer with a step grid (renders sequence data directly)
 * Faster than image mode since it doesn't need to generate/fetch an image first
 */
export function openSpotlightWithStepGrid(sequence: SequenceData): void {
  uiState.spotlightSequence = sequence;
  uiState.spotlightImageUrl = null;
  uiState.spotlightThumbnailService = null;
  uiState.spotlightDisplayMode = "stepgrid";
  uiState.showSpotlight = true;
  // Sync to URL for HMR persistence
  cacheSequence(sequence);
  setSpotlightModalUrl(sequence, "stepgrid" as UrlSpotlightMode);
}

/**
 * Open spotlight viewer with animation playback
 * Renders the AnimationPlayer fullscreen for immersive viewing
 */
export function openSpotlightWithAnimation(sequence: SequenceData): void {
  uiState.spotlightSequence = sequence;
  uiState.spotlightImageUrl = null;
  uiState.spotlightVideoUrl = null;
  uiState.spotlightThumbnailService = null;
  uiState.spotlightDisplayMode = "animation";
  uiState.showSpotlight = true;
  // Sync to URL for HMR persistence
  cacheSequence(sequence);
  setSpotlightModalUrl(sequence, "animation" as UrlSpotlightMode);
}

/**
 * Open spotlight viewer with video playback
 * Renders fullscreen video player - tap anywhere to dismiss
 */
export function openSpotlightWithVideo(videoUrl: string, posterUrl?: string): void {
  uiState.spotlightVideoUrl = videoUrl;
  uiState.spotlightImageUrl = posterUrl || null; // Use imageUrl for poster
  uiState.spotlightSequence = null;
  uiState.spotlightThumbnailService = null;
  uiState.spotlightDisplayMode = "video";
  uiState.showSpotlight = true;
}

/**
 * Open spotlight viewer with split view
 * Shows animation on one side and LayeredSequencePreview on the other
 * Supports step highlighting during playback
 */
export function openSpotlightWithSplit(sequence: SequenceData): void {
  uiState.spotlightSequence = sequence;
  uiState.spotlightImageUrl = null;
  uiState.spotlightVideoUrl = null;
  uiState.spotlightThumbnailService = null;
  uiState.spotlightDisplayMode = "split";
  uiState.showSpotlight = true;
  // Sync to URL for HMR persistence
  cacheSequence(sequence);
  setSpotlightModalUrl(sequence, "split" as UrlSpotlightMode);
}

export function closeSpotlightViewer(): void {
  uiState.showSpotlight = false;
  uiState.spotlightSequence = null;
  uiState.spotlightThumbnailService = null;
  uiState.spotlightImageUrl = null;
  uiState.spotlightVideoUrl = null;
  uiState.spotlightDisplayMode = "image";
  // Clear URL state when closing spotlight
  clearModalUrlState();
}

// ============================================================================
// DEBUG PANEL STATE (Admin Only)
// ============================================================================

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

// ============================================================================
// RESET STATE
// ============================================================================

export function resetUIState(): void {
  uiState.activeModule = "create";
  uiState.showSettings = false;
  uiState.isFullScreen = false;
  uiState.isTransitioning = false;
  uiState.isWaitingForModuleLoad = false;
  uiState.showSpotlight = false;
  uiState.spotlightSequence = null;
  uiState.spotlightThumbnailService = null;
  uiState.spotlightImageUrl = null;
  uiState.spotlightVideoUrl = null;
  uiState.spotlightDisplayMode = "image";
  uiState.showDebugPanel = false;
}
