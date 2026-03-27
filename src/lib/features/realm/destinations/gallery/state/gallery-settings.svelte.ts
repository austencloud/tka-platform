/**
 * Gallery Settings
 *
 * User preferences for the Gallery module.
 * Stored in localStorage and persisted across sessions.
 */

export type PhysicsMode = "raycasting" | "rapier";
export type RenderingBackend = "webgl" | "webgpu-auto";

export interface GallerySettings {
  /** Physics simulation mode - raycasting (lighter) or Rapier (realistic) */
  physicsMode: PhysicsMode;
  /** Rendering backend - WebGL or WebGPU with fallback */
  renderingBackend: RenderingBackend;
  /** Field of view (degrees) */
  fov: number;
  /** Mouse sensitivity multiplier */
  mouseSensitivity: number;
  /** Movement speed multiplier */
  moveSpeedMultiplier: number;
}

const STORAGE_KEY = "tka-gallery-settings";

const DEFAULT_SETTINGS: GallerySettings = {
  physicsMode: "raycasting", // Default to lighter raycasting mode
  renderingBackend: "webgpu-auto", // WebGPU when available, auto-fallback to WebGL
  fov: 75,
  mouseSensitivity: 1.0,
  moveSpeedMultiplier: 1.0,
};

/**
 * Load settings from localStorage with defaults
 */
function loadSettings(): GallerySettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.warn("[GallerySettings] Failed to load settings:", error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Save settings to localStorage
 */
function saveSettings(settings: GallerySettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("[GallerySettings] Failed to save settings:", error);
  }
}

/**
 * Create reactive gallery settings store
 */
export function createGallerySettings() {
  let settings = $state<GallerySettings>(loadSettings());

  return {
    get physicsMode() {
      return settings.physicsMode;
    },
    get renderingBackend() {
      return settings.renderingBackend;
    },
    get fov() {
      return settings.fov;
    },
    get mouseSensitivity() {
      return settings.mouseSensitivity;
    },
    get moveSpeedMultiplier() {
      return settings.moveSpeedMultiplier;
    },

    setPhysicsMode(mode: PhysicsMode) {
      settings.physicsMode = mode;
      saveSettings(settings);
    },

    setRenderingBackend(backend: RenderingBackend) {
      settings.renderingBackend = backend;
      saveSettings(settings);
    },

    setFov(fov: number) {
      settings.fov = Math.max(50, Math.min(120, fov));
      saveSettings(settings);
    },

    setMouseSensitivity(sensitivity: number) {
      settings.mouseSensitivity = Math.max(0.1, Math.min(5.0, sensitivity));
      saveSettings(settings);
    },

    setMoveSpeedMultiplier(multiplier: number) {
      settings.moveSpeedMultiplier = Math.max(0.5, Math.min(3.0, multiplier));
      saveSettings(settings);
    },

    reset() {
      settings = { ...DEFAULT_SETTINGS };
      saveSettings(settings);
    },
  };
}

export type GallerySettingsInstance = ReturnType<typeof createGallerySettings>;
