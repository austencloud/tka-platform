/**
 * Image Composition State Manager
 *
 * Manages persistent settings for what elements appear in exported/shared images.
 * Persists to Firebase for authenticated users, falls back to localStorage for guests.
 */

import { browser } from "$app/environment";
import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
import { settingsService } from "$lib/shared/settings/state/SettingsState.svelte";
import { auth } from "$lib/shared/auth/firebase";

const STORAGE_KEY = "tka-image-composition-settings";

export interface ImageCompositionSettings {
  addWord: boolean;
  addBeatNumbers: boolean;
  addDifficultyLevel: boolean;
  includeStartPosition: boolean;
  addUserInfo: boolean;
  darkMode: boolean;
}

const DEFAULT_SETTINGS: ImageCompositionSettings = {
  addWord: true,
  addBeatNumbers: true,
  addDifficultyLevel: false,
  includeStartPosition: true,
  addUserInfo: false,
  darkMode: false, // Default to light mode (will be synced from global on init)
};

type Observer = () => void;

class ImageCompositionStateManager {
  private settings = $state<ImageCompositionSettings>({ ...DEFAULT_SETTINGS });
  private observers = new Set<Observer>();

  constructor() {
    if (browser) {
      this.loadSettings();
    }
  }

  /**
   * Load settings from Firebase (if authenticated) or localStorage (if guest)
   */
  private loadSettings(): void {
    // First try to load from Firebase if authenticated
    const firebaseSettings = settingsService.currentSettings.imageExport;

    if (firebaseSettings && auth.currentUser) {
      // Use Firebase settings for authenticated users
      this.settings = { ...DEFAULT_SETTINGS, ...firebaseSettings };
    } else {
      // Fall back to localStorage for guests or if no Firebase settings exist
      this.loadFromStorage();
    }

    // Sync dark mode from global settings if not previously set
    if (this.settings.darkMode === DEFAULT_SETTINGS.darkMode) {
      const animVisibilityManager = getAnimationVisibilityManager();
      this.settings.darkMode = animVisibilityManager.isDarkMode();
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch {
      console.warn("Failed to load image composition settings from storage");
    }
  }

  /**
   * Save settings to both localStorage and Firebase (if authenticated)
   */
  private saveToStorage(): void {
    if (!browser) return;

    // Always save to localStorage for immediate persistence and guest users
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      console.warn("Failed to save image composition settings to localStorage");
    }

    // Also save to Firebase if authenticated
    if (auth.currentUser) {
      this.saveToFirebase();
    }
  }

  /**
   * Save settings to Firebase for authenticated users
   */
  private saveToFirebase(): void {
    const currentSettings = settingsService.currentSettings;
    const updatedSettings = {
      ...currentSettings,
      imageExport: { ...this.settings },
    };

    // Use updateSetting to trigger Firebase persistence
    void settingsService.updateSetting("imageExport", this.settings);
  }

  private notifyObservers(): void {
    this.observers.forEach((observer) => observer());
  }

  // Getters
  get addWord(): boolean {
    return this.settings.addWord;
  }

  get addBeatNumbers(): boolean {
    return this.settings.addBeatNumbers;
  }

  get addDifficultyLevel(): boolean {
    return this.settings.addDifficultyLevel;
  }

  get includeStartPosition(): boolean {
    return this.settings.includeStartPosition;
  }

  get addUserInfo(): boolean {
    return this.settings.addUserInfo;
  }

  get darkMode(): boolean {
    return this.settings.darkMode;
  }

  // Get all settings (for passing to share service)
  getSettings(): ImageCompositionSettings {
    return { ...this.settings };
  }

  // Setters
  setAddWord(value: boolean): void {
    this.settings.addWord = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setAddBeatNumbers(value: boolean): void {
    this.settings.addBeatNumbers = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setAddDifficultyLevel(value: boolean): void {
    this.settings.addDifficultyLevel = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setIncludeStartPosition(value: boolean): void {
    this.settings.includeStartPosition = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setAddUserInfo(value: boolean): void {
    this.settings.addUserInfo = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  setDarkMode(value: boolean): void {
    this.settings.darkMode = value;
    this.saveToStorage();
    this.notifyObservers();
  }

  // Toggle helpers
  toggle(key: keyof ImageCompositionSettings): void {
    this.settings[key] = !this.settings[key];
    this.saveToStorage();
    this.notifyObservers();
  }

  // Observer pattern for reactivity
  registerObserver(observer: Observer): void {
    this.observers.add(observer);
  }

  unregisterObserver(observer: Observer): void {
    this.observers.delete(observer);
  }
}

// Singleton instance
let instance: ImageCompositionStateManager | null = null;

export function getImageCompositionManager(): ImageCompositionStateManager {
  if (!instance) {
    instance = new ImageCompositionStateManager();
  }
  return instance;
}
