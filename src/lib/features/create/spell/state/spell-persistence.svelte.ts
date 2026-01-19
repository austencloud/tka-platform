/**
 * Spell Tab Persistence (Production-Hardened)
 *
 * Comprehensive persistence for spell tab state with:
 * - Schema versioning and migration
 * - Data validation
 * - Debounced saves
 * - Error recovery
 *
 * Ensures refresh preserves all spell tab state robustly.
 */

import { browser } from "$app/environment";
import type { SequenceData } from "$lib/features/create/shared/domain/models/SequenceData";
import type { SpellPreferences } from "../domain/models/spell-models";
import type { WizardPhase } from "./funnel-state.svelte";
import { DEFAULT_SPELL_PREFERENCES } from "../domain/constants/spell-constants";
import { debounce } from "$lib/shared/utils/debounce";

// ============================================================================
// VERSIONING
// ============================================================================

/**
 * Current schema version
 * Increment when making breaking changes to stored data structure
 */
const SCHEMA_VERSION = 1;

const STORAGE_KEYS = {
  VERSION: "tka_spell_state_version",
  CURRENT_SEQUENCE: "tka_spell_current_sequence",
  WIZARD_PHASE: "tka_spell_wizard_phase",
  INPUT_WORD: "tka_spell_input_word",
  EXPANDED_WORD: "tka_spell_expanded_word",
  PREFERENCES: "tka_spell_preferences",
  HAS_GENERATED: "tka_spell_has_generated",
} as const;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Spell Tab Persisted State
 */
export interface SpellPersistedState {
  currentSequence: SequenceData | null;
  wizardPhase: WizardPhase;
  inputWord: string;
  expandedWord: string;
  preferences: SpellPreferences;
  hasGeneratedOnce: boolean;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that loaded data is a valid SequenceData object
 */
function isValidSequenceData(data: unknown): data is SequenceData {
  if (!data || typeof data !== "object") return false;
  const seq = data as Partial<SequenceData>;

  // Check required fields
  return (
    typeof seq.id === "string" &&
    typeof seq.name === "string" &&
    typeof seq.word === "string" &&
    Array.isArray(seq.steps)
  );
}

/**
 * Validate wizard phase
 */
function isValidWizardPhase(value: unknown): value is WizardPhase {
  return (
    value === "preferences" || value === "generating" || value === "results"
  );
}

/**
 * Validate preferences object
 */
function isValidPreferences(data: unknown): data is SpellPreferences {
  if (!data || typeof data !== "object") return false;
  // At minimum, should be an object - merge with defaults for safety
  return true;
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Migrate data from old schema versions
 * Returns null if migration fails
 */
function migrateData(version: number): SpellPersistedState | null {
  if (version === SCHEMA_VERSION) {
    // No migration needed
    return null;
  }

  console.log(
    `[SpellPersistence] Migrating from v${version} to v${SCHEMA_VERSION}`
  );

  // Future migrations will go here
  // Example:
  // if (version === 1 && SCHEMA_VERSION === 2) {
  //   return migrateV1ToV2();
  // }

  // Unknown version - can't migrate safely
  console.warn(
    `[SpellPersistence] Unknown version ${version}, clearing state`
  );
  return null;
}

// ============================================================================
// SAVE/LOAD
// ============================================================================

/**
 * Internal save function (called by debounced wrapper)
 */
function saveSpellStateInternal(state: Partial<SpellPersistedState>): void {
  if (!browser) return;

  try {
    // Always save version
    localStorage.setItem(STORAGE_KEYS.VERSION, String(SCHEMA_VERSION));

    if (state.currentSequence !== undefined) {
      if (state.currentSequence === null) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_SEQUENCE);
      } else {
        localStorage.setItem(
          STORAGE_KEYS.CURRENT_SEQUENCE,
          JSON.stringify(state.currentSequence)
        );
      }
    }

    if (state.wizardPhase !== undefined) {
      localStorage.setItem(STORAGE_KEYS.WIZARD_PHASE, state.wizardPhase);
    }

    if (state.inputWord !== undefined) {
      localStorage.setItem(STORAGE_KEYS.INPUT_WORD, state.inputWord);
    }

    if (state.expandedWord !== undefined) {
      localStorage.setItem(STORAGE_KEYS.EXPANDED_WORD, state.expandedWord);
    }

    if (state.preferences !== undefined) {
      localStorage.setItem(
        STORAGE_KEYS.PREFERENCES,
        JSON.stringify(state.preferences)
      );
    }

    if (state.hasGeneratedOnce !== undefined) {
      localStorage.setItem(
        STORAGE_KEYS.HAS_GENERATED,
        String(state.hasGeneratedOnce)
      );
    }
  } catch (error) {
    // Check for quota exceeded
    if (
      error instanceof Error &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      console.error(
        "[SpellPersistence] Storage quota exceeded. Clearing old data."
      );
      // Try to recover by clearing sequence (largest item)
      try {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_SEQUENCE);
        console.log("[SpellPersistence] Cleared sequence to free space");
      } catch {
        // If even clearing fails, give up
        console.error("[SpellPersistence] Could not recover from quota error");
      }
    } else {
      console.warn("[SpellPersistence] Failed to save state:", error);
    }
  }
}

/**
 * Debounced save function (300ms delay)
 * Prevents hammering localStorage on rapid state changes
 */
export const saveSpellState = debounce(saveSpellStateInternal, 300);

/**
 * Load spell tab state from localStorage with validation
 */
export function loadSpellState(): SpellPersistedState {
  const defaultState: SpellPersistedState = {
    currentSequence: null,
    wizardPhase: "preferences",
    inputWord: "",
    expandedWord: "",
    preferences: { ...DEFAULT_SPELL_PREFERENCES },
    hasGeneratedOnce: false,
  };

  if (!browser) return defaultState;

  try {
    // Check version
    const versionStr = localStorage.getItem(STORAGE_KEYS.VERSION);
    const version = versionStr ? parseInt(versionStr, 10) : 0;

    if (version !== SCHEMA_VERSION) {
      // Attempt migration
      const migrated = migrateData(version);
      if (migrated) {
        return migrated;
      }
      // Migration failed or not needed - fall through to normal load
      if (version > SCHEMA_VERSION) {
        // Data is from future version - can't safely load
        console.warn(
          `[SpellPersistence] Data from future version (${version} > ${SCHEMA_VERSION}), clearing`
        );
        clearSpellState();
        return defaultState;
      }
    }

    // Load and validate sequence
    const sequenceJson = localStorage.getItem(STORAGE_KEYS.CURRENT_SEQUENCE);
    let currentSequence: SequenceData | null = null;

    if (sequenceJson) {
      try {
        const parsed = JSON.parse(sequenceJson);
        if (isValidSequenceData(parsed)) {
          currentSequence = parsed;
        } else {
          console.warn(
            "[SpellPersistence] Invalid sequence data, discarding"
          );
        }
      } catch (parseError) {
        console.warn(
          "[SpellPersistence] Failed to parse sequence, discarding:",
          parseError
        );
      }
    }

    // Load and validate wizard phase
    const phaseStr = localStorage.getItem(STORAGE_KEYS.WIZARD_PHASE);
    const wizardPhase = isValidWizardPhase(phaseStr)
      ? phaseStr
      : "preferences";

    // Load input word
    const inputWord = localStorage.getItem(STORAGE_KEYS.INPUT_WORD) || "";

    // Load expanded word
    const expandedWord =
      localStorage.getItem(STORAGE_KEYS.EXPANDED_WORD) || "";

    // Load and validate preferences
    const preferencesJson = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    let preferences = { ...DEFAULT_SPELL_PREFERENCES };

    if (preferencesJson) {
      try {
        const parsed = JSON.parse(preferencesJson);
        if (isValidPreferences(parsed)) {
          preferences = { ...DEFAULT_SPELL_PREFERENCES, ...parsed };
        }
      } catch {
        console.warn("[SpellPersistence] Invalid preferences, using defaults");
      }
    }

    // Load has generated flag
    const hasGeneratedOnce =
      localStorage.getItem(STORAGE_KEYS.HAS_GENERATED) === "true";

    // Smart phase restoration: if we have a sequence, go to results
    const actualPhase = currentSequence ? "results" : wizardPhase;

    return {
      currentSequence,
      wizardPhase: actualPhase,
      inputWord,
      expandedWord,
      preferences,
      hasGeneratedOnce,
    };
  } catch (error) {
    console.warn("[SpellPersistence] Failed to load state:", error);
    return defaultState;
  }
}

/**
 * Clear all spell tab persisted state
 */
export function clearSpellState(): void {
  if (!browser) return;

  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
    console.log("[SpellPersistence] State cleared");
  } catch (error) {
    console.warn("[SpellPersistence] Failed to clear state:", error);
  }
}

/**
 * Check storage usage (diagnostic)
 * Returns approximate size in bytes
 */
export function getStorageSize(): number {
  if (!browser) return 0;

  try {
    let total = 0;
    Object.values(STORAGE_KEYS).forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) {
        // Each character is ~2 bytes in UTF-16
        total += value.length * 2;
      }
    });
    return total;
  } catch {
    return 0;
  }
}
