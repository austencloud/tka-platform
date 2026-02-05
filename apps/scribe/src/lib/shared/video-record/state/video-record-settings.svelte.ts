/**
 * Video Record Settings State
 *
 * Manages reference view preferences with localStorage persistence.
 * Uses unified persistence utility for consistent auto-save behavior.
 */

import { createPersistenceHelper } from "$lib/shared/state/utils/persistent-state";

export type ReferenceViewType = "none" | "animation" | "grid";

export interface AnimationSettings {
  speed: number; // 0.25 to 2.0
  showTrails: boolean;
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
}

export interface GridSettings {
  animated: boolean; // false = static, true = BPM-synced
  bpm: number; // Only used when animated is true
}

export interface VideoRecordSettings {
  // Desktop: 'none' or 'animation'
  // Mobile: 'animation' or 'grid'
  referenceView: ReferenceViewType;

  animationSettings: AnimationSettings;
  gridSettings: GridSettings;
}

const DEFAULT_SETTINGS: VideoRecordSettings = {
  referenceView: "animation",
  animationSettings: {
    speed: 1.0,
    showTrails: true,
    blueMotionVisible: true,
    redMotionVisible: true,
  },
  gridSettings: {
    animated: false,
    bpm: 60,
  },
};

const settingsPersistence = createPersistenceHelper({
  key: "tka-video-record-settings",
  defaultValue: DEFAULT_SETTINGS,
});

/**
 * Create video record settings state
 */
export function createVideoRecordSettings() {
  let settings = $state<VideoRecordSettings>(settingsPersistence.load());

  // Auto-save on changes
  $effect.root(() => {
    $effect(() => {
      // Access all properties to track changes
      void settings.referenceView;
      void settings.animationSettings.speed;
      void settings.animationSettings.showTrails;
      void settings.animationSettings.blueMotionVisible;
      void settings.animationSettings.redMotionVisible;
      void settings.gridSettings.animated;
      void settings.gridSettings.bpm;

      settingsPersistence.setupAutoSave(settings);
    });
  });

  return {
    get current() {
      return settings;
    },

    setReferenceView(view: ReferenceViewType) {
      settings.referenceView = view;
    },

    setAnimationSpeed(speed: number) {
      settings.animationSettings.speed = Math.max(0.25, Math.min(2.0, speed));
    },

    setShowTrails(show: boolean) {
      settings.animationSettings.showTrails = show;
    },

    setBlueMotionVisible(visible: boolean) {
      settings.animationSettings.blueMotionVisible = visible;
    },

    setRedMotionVisible(visible: boolean) {
      settings.animationSettings.redMotionVisible = visible;
    },

    setGridAnimated(animated: boolean) {
      settings.gridSettings.animated = animated;
    },

    setGridBpm(bpm: number) {
      settings.gridSettings.bpm = Math.max(30, Math.min(200, bpm));
    },

    reset() {
      settings = { ...DEFAULT_SETTINGS };
    },
  };
}

export type VideoRecordSettingsState = ReturnType<
  typeof createVideoRecordSettings
>;
