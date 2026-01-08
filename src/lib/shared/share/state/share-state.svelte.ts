/**
 * Share State Management
 *
 * Reactive state for the share interface using Svelte 5 runes.
 */

import type { SequenceData } from "../../foundation/domain/models/SequenceData";
import type { ShareOptions } from "../domain/models/ShareOptions";
import {
  SHARE_PRESETS,
  DEFAULT_SHARE_OPTIONS,
} from "../domain/models/ShareOptions";
import type { ISharer } from "../services/contracts/ISharer";
import { tryResolve, TYPES } from "../../inversify/di";
import type { IActivityLogger } from "../../analytics/services/contracts/IActivityLogger";
import { getUser } from "../../auth/state/authState.svelte";
import { settingsService } from "../../settings/state/SettingsState.svelte";
import { PropType } from "../../pictograph/prop/domain/enums/PropType";
import { getImageCompositionManager } from "./image-composition-state.svelte";

export interface ShareState {
  // Current options
  readonly options: ShareOptions;
  readonly selectedPreset: string;

  // Preview state
  readonly previewUrl: string | null;
  readonly isGeneratingPreview: boolean;
  readonly previewError: string | null;

  // Download state
  readonly isDownloading: boolean;
  readonly downloadError: string | null;
  readonly lastDownloadedFile: string | null;

  // Actions
  updateOptions: (newOptions: Partial<ShareOptions>) => void;
  selectPreset: (presetName: string) => void;
  generatePreview: (
    sequence: SequenceData,
    forceRegenerate?: boolean
  ) => Promise<void>;
  downloadImage: (sequence: SequenceData, filename?: string) => Promise<void>;
  resetErrors: () => void;

  // Cache access - for instant preview switching
  tryLoadFromCache: (sequence: SequenceData) => boolean;
  clearCache: () => void;
}

export function createShareState(shareService: ISharer): ShareState {
  // Get image composition settings from the global settings manager
  // This is the single source of truth - shared with Settings > Visibility tab
  const imageCompositionManager = getImageCompositionManager();

  // Reactive state using Svelte 5 runes
  const socialPreset = SHARE_PRESETS["social"];
  if (!socialPreset) {
    throw new Error("Social preset not found in SHARE_PRESETS");
  }

  // Get the authenticated user's display name (fallback to empty string)
  const user = getUser();
  const userName = user?.displayName || "";

  // Initialize options from global image composition settings
  let options = $state<ShareOptions>({
    ...socialPreset.options,
    ...imageCompositionManager.getSettings(), // Read from global settings
    userName,
  });
  let selectedPreset = $state<string>("custom"); // Start as custom

  let previewUrl = $state<string | null>(null);
  let isGeneratingPreview = $state<boolean>(false);
  let previewError = $state<string | null>(null);

  let isDownloading = $state<boolean>(false);
  let downloadError = $state<string | null>(null);
  let lastDownloadedFile = $state<string | null>(null);

  // Preview cache for instant retrieval on repeated views
  const previewCache = new Map<string, string>();

  // Keep options in sync when Settings > Visibility changes
  // This ensures the share panel reflects global settings changes
  const syncWithGlobalSettings = () => {
    const globalSettings = imageCompositionManager.getSettings();
    options = {
      ...options,
      ...globalSettings,
    };
  };
  imageCompositionManager.registerObserver(syncWithGlobalSettings);

  /**
   * Get current prop types from settings (with fallback to default)
   */
  function getCurrentPropTypes(): { blue: string; red: string } {
    const settings = settingsService.settings;
    const defaultPropType = PropType.STAFF;

    // Get bluePropType, falling back to propType (legacy), then default
    const bluePropType =
      settings.bluePropType || settings.propType || defaultPropType;

    // Get redPropType, falling back to propType (legacy), then default
    const redPropType =
      settings.redPropType || settings.propType || defaultPropType;

    return {
      blue: bluePropType,
      red: redPropType,
    };
  }

  /**
   * Generate cache key from sequence ID and relevant options
   * IMPORTANT: All toggle options AND prop types must be included to avoid stale cache
   * Include prop types so changing props in settings invalidates the cache
   */
  function getCacheKey(sequenceId: string, opts: ShareOptions): string {
    const propTypes = getCurrentPropTypes();
    return `${sequenceId}-${opts.format}-${opts.addWord}-${opts.addBeatNumbers}-${opts.includeStartPosition}-${opts.addDifficultyLevel}-${opts.addUserInfo}-${propTypes.blue}-${propTypes.red}`;
  }

  return {
    // Getters
    get options() {
      return options;
    },
    get selectedPreset() {
      return selectedPreset;
    },
    get previewUrl() {
      return previewUrl;
    },
    get isGeneratingPreview() {
      return isGeneratingPreview;
    },
    get previewError() {
      return previewError;
    },
    get isDownloading() {
      return isDownloading;
    },
    get downloadError() {
      return downloadError;
    },
    get lastDownloadedFile() {
      return lastDownloadedFile;
    },

    // Actions
    updateOptions: (newOptions: Partial<ShareOptions>) => {
      options = { ...options, ...newOptions };
      selectedPreset = "custom"; // Mark as custom when manually changed
      previewError = null; // Clear preview error when options change

      // Update the global image composition settings (persists automatically)
      // This ensures Settings > Visibility and Share panel stay in sync
      if (newOptions.addWord !== undefined) {
        imageCompositionManager.setAddWord(newOptions.addWord);
      }
      if (newOptions.addBeatNumbers !== undefined) {
        imageCompositionManager.setAddBeatNumbers(newOptions.addBeatNumbers);
      }
      if (newOptions.addDifficultyLevel !== undefined) {
        imageCompositionManager.setAddDifficultyLevel(
          newOptions.addDifficultyLevel
        );
      }
      if (newOptions.includeStartPosition !== undefined) {
        imageCompositionManager.setIncludeStartPosition(
          newOptions.includeStartPosition
        );
      }
      if (newOptions.addUserInfo !== undefined) {
        imageCompositionManager.setAddUserInfo(newOptions.addUserInfo);
      }
    },

    selectPreset: (presetName: string) => {
      const preset = SHARE_PRESETS[presetName];
      if (preset) {
        // Preserve the user's display name when switching presets
        const currentUser = getUser();
        const currentUserName = currentUser?.displayName || "";
        options = { ...preset.options, userName: currentUserName };
        selectedPreset = presetName;
        previewError = null;

        // Update the global image composition settings with preset values
        imageCompositionManager.setAddWord(options.addWord);
        imageCompositionManager.setAddBeatNumbers(options.addBeatNumbers);
        imageCompositionManager.setAddDifficultyLevel(
          options.addDifficultyLevel
        );
        imageCompositionManager.setIncludeStartPosition(
          options.includeStartPosition
        );
        imageCompositionManager.setAddUserInfo(options.addUserInfo);
      }
    },

    generatePreview: async (
      sequence: SequenceData,
      forceRegenerate = false
    ) => {
      if (!sequence) return;

      // Check cache first (unless forcing regeneration)
      if (!forceRegenerate) {
        const cacheKey = getCacheKey(sequence.id, options);
        const cachedPreview = previewCache.get(cacheKey);

        if (cachedPreview) {
          previewUrl = cachedPreview;
          previewError = null;
          return; // Return immediately with cached preview
        }
      }

      isGeneratingPreview = true;
      previewError = null;

      try {
        // Validate options first
        const validation = shareService.validateOptions(options);
        if (!validation.valid) {
          throw new Error(`Invalid options: ${validation.errors.join(", ")}`);
        }

        // CRITICAL FIX: Override sequence prop types with current settings
        // The sequence may have been generated with different prop types,
        // but we want the preview to always match the current settings
        const currentPropTypes = getCurrentPropTypes();

        // Helper to update motions prop types
        const updateMotionsPropTypes = (data: any) => {
          if (!data?.motions) return data;
          return {
            ...data,
            motions: {
              ...data.motions,
              blue: data.motions.blue
                ? {
                    ...data.motions.blue,
                    propType: currentPropTypes.blue,
                  }
                : data.motions.blue,
              red: data.motions.red
                ? {
                    ...data.motions.red,
                    propType: currentPropTypes.red,
                  }
                : data.motions.red,
            },
          };
        };

        const sequenceWithCurrentProps = {
          ...sequence,
          // Update all beats
          beats:
            sequence.beats?.map((beat) => updateMotionsPropTypes(beat)) || [],
          // Update BOTH start position fields (primary and legacy)
          ...(sequence.startPosition && {
            startPosition: updateMotionsPropTypes(sequence.startPosition),
          }),
          ...(sequence.startingPositionBeat && {
            startingPositionBeat: updateMotionsPropTypes(
              sequence.startingPositionBeat
            ),
          }),
        };

        // Generate preview with the prop-type-overridden sequence
        const newPreviewUrl = await shareService.generatePreview(
          sequenceWithCurrentProps,
          options,
          forceRegenerate
        );

        // Cache the preview for future use
        const cacheKey = getCacheKey(sequence.id, options);
        previewCache.set(cacheKey, newPreviewUrl);

        // Clean up old preview URL (but not if it's cached)
        if (
          previewUrl &&
          !Array.from(previewCache.values()).includes(previewUrl)
        ) {
          URL.revokeObjectURL(previewUrl);
        }

        previewUrl = newPreviewUrl;
      } catch (error) {
        previewError =
          error instanceof Error ? error.message : "Failed to generate preview";
        console.error("Preview generation failed:", error);
      } finally {
        isGeneratingPreview = false;
      }
    },

    downloadImage: async (sequence: SequenceData, filename?: string) => {
      if (!sequence) return;

      isDownloading = true;
      downloadError = null;

      try {
        // Validate options first
        const validation = shareService.validateOptions(options);
        if (!validation.valid) {
          throw new Error(`Invalid options: ${validation.errors.join(", ")}`);
        }

        // CRITICAL FIX: Override sequence prop types with current settings (same as preview)
        const currentPropTypes = getCurrentPropTypes();

        // Helper to update motions prop types (same as in generatePreview)
        const updateMotionsPropTypes = (data: any) => {
          if (!data?.motions) return data;
          return {
            ...data,
            motions: {
              ...data.motions,
              blue: data.motions.blue
                ? {
                    ...data.motions.blue,
                    propType: currentPropTypes.blue,
                  }
                : data.motions.blue,
              red: data.motions.red
                ? {
                    ...data.motions.red,
                    propType: currentPropTypes.red,
                  }
                : data.motions.red,
            },
          };
        };

        const sequenceWithCurrentProps = {
          ...sequence,
          // Update all beats
          beats:
            sequence.beats?.map((beat) => updateMotionsPropTypes(beat)) || [],
          // Update BOTH start position fields (primary and legacy)
          ...(sequence.startPosition && {
            startPosition: updateMotionsPropTypes(sequence.startPosition),
          }),
          ...(sequence.startingPositionBeat && {
            startingPositionBeat: updateMotionsPropTypes(
              sequence.startingPositionBeat
            ),
          }),
        };

        // Download image with the prop-type-overridden sequence
        await shareService.downloadImage(
          sequenceWithCurrentProps,
          options,
          filename
        );

        // Track successful download
        lastDownloadedFile =
          filename || shareService.generateFilename(sequence, options);

        // Log share/download action for analytics (non-blocking)
        try {
          const activityService = tryResolve<IActivityLogger>(
            TYPES.IActivityLogger
          );
          if (activityService) {
            void activityService.logShareAction("sequence_export", {
              sequenceId: sequence.id,
              format: options.format,
              sequenceWord: sequence.word,
            });
          }
        } catch {
          // Silently fail - activity logging is non-critical
        }
      } catch (error) {
        downloadError =
          error instanceof Error ? error.message : "Failed to download image";
        console.error("Download failed:", error);
      } finally {
        isDownloading = false;
      }
    },

    resetErrors: () => {
      previewError = null;
      downloadError = null;
    },

    // Synchronous cache check - returns true if cache hit and preview was updated
    tryLoadFromCache: (sequence: SequenceData): boolean => {
      if (!sequence) return false;

      const cacheKey = getCacheKey(sequence.id, options);
      const cachedPreview = previewCache.get(cacheKey);

      if (cachedPreview) {
        previewUrl = cachedPreview;
        previewError = null;
        return true; // Cache hit - preview updated instantly
      }

      return false; // Cache miss - caller should generate
    },

    // Clear the preview cache (useful for debugging or forcing regeneration)
    clearCache: () => {
      previewCache.clear();
      previewUrl = null;
    },
  };
}
