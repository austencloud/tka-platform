/**
 * animation-panel-persistence.ts
 *
 * LocalStorage persistence utilities for AnimationPanel state.
 * Handles saving/loading trail settings and collapse states.
 */

import { browser } from "$app/environment";
import {
  type TrailSettings,
  DEFAULT_TRAIL_SETTINGS,
  TRAIL_SETTINGS_STORAGE_KEY,
  TrackingMode,
  TrailMode,
  TrailEffect,
} from "$lib/shared/animation-engine/domain/types/trail-types";

const COLLAPSE_STATE_KEY = "tka_animation_collapse_states";

// ============================================================================
// TRAIL SETTINGS PERSISTENCE
// ============================================================================

/**
 * Load trail settings from localStorage
 * Forces the "vivid" trail preset - tapered, exponential fade, glow
 */
export function loadTrailSettings(): TrailSettings {
  if (!browser) return { ...DEFAULT_TRAIL_SETTINGS };
  try {
    const stored = localStorage.getItem(TRAIL_SETTINGS_STORAGE_KEY);
    if (!stored) return { ...DEFAULT_TRAIL_SETTINGS };
    const parsed = JSON.parse(stored);

    // Migration: convert old trackBothEnds boolean to new trackingMode enum
    if ("trackBothEnds" in parsed && !("trackingMode" in parsed)) {
      parsed.trackingMode = parsed.trackBothEnds
        ? TrackingMode.BOTH_ENDS
        : TrackingMode.RIGHT_END;
      delete parsed.trackBothEnds;
    }

    // Migration: Add previewMode if not present (defaults to false = normal trail mode)
    if (!("previewMode" in parsed)) {
      parsed.previewMode = false;
    }

    // Merge with defaults, then FORCE the vivid settings
    // The rendering now always uses exponential fade and tapered width (hardcoded)
    const result = { ...DEFAULT_TRAIL_SETTINGS, ...parsed };

    // ALWAYS force these vivid settings - they make trails beautiful
    result.mode = TrailMode.FADE;
    result.effect = TrailEffect.GLOW;
    // Thicker line width to compensate for tapering (tapered trails thin at tail)
    result.lineWidth = 5;
    result.maxOpacity = 1.0; // Full opacity at head
    result.minOpacity = 0.25; // Higher minimum so tail doesn't fade too much
    result.glowBlur = 3; // Stronger glow for more visibility
    result.fadeDurationMs = 2500;

    return result;
  } catch (error) {
    console.error("❌ Failed to load trail settings:", error);
    return { ...DEFAULT_TRAIL_SETTINGS };
  }
}

/**
 * Save trail settings to localStorage
 */
export function saveTrailSettings(settings: TrailSettings): void {
  if (!browser) return;
  try {
    localStorage.setItem(TRAIL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("❌ Failed to save trail settings:", error);
  }
}

// ============================================================================
// COLLAPSE STATE PERSISTENCE
// ============================================================================

export interface CollapseStates {
  playback: boolean;
  trail: boolean;
}

/**
 * Load collapse states from localStorage
 */
export function loadCollapseStates(): CollapseStates {
  if (!browser) return { playback: false, trail: false };
  try {
    const stored = localStorage.getItem(COLLAPSE_STATE_KEY);
    if (!stored) return { playback: false, trail: false };
    return JSON.parse(stored);
  } catch (error) {
    console.error("❌ Failed to load collapse states:", error);
    return { playback: false, trail: false };
  }
}

/**
 * Save collapse states to localStorage
 */
export function saveCollapseStates(playback: boolean, trail: boolean): void {
  if (!browser) return;
  try {
    localStorage.setItem(
      COLLAPSE_STATE_KEY,
      JSON.stringify({ playback, trail })
    );
  } catch (error) {
    console.error("❌ Failed to save collapse states:", error);
  }
}
