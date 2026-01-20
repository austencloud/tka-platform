/**
 * Spell Tab Persistence (Simplified)
 *
 * Persists spell tab UI state:
 * - Schema versioning and migration
 * - Data validation
 * - Debounced saves
 * - Error recovery
 *
 * NOTE: Sequence data is persisted via sequenceState (not here).
 * This only persists UI state like wizard phase, input word, and preferences.
 */

import { browser } from "$app/environment";
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
const SCHEMA_VERSION = 2; // Bumped: removed currentSequence (now persisted via sequenceState)

const STORAGE_KEYS = {
  VERSION: "tka_spell_state_version",
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
 * NOTE: Sequence is persisted via sequenceState, not here.
 */
export interface SpellPersistedState {
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
 * Returns null if migration fails or not needed
 */
function migrateData(version: number): SpellPersistedState | null {
  if (version === SCHEMA_VERSION) {
    // No migration needed
    return null;
  }

  console.log(
    `[SpellPersistence] Migrating from v${version} to v${SCHEMA_VERSION}`
  );

  // Migration from v1 to v2: removed currentSequence (now persisted via sequenceState)
  if (version === 1 && SCHEMA_VERSION === 2) {
    // Just clear the old currentSequence key if it exists
    try {
      localStorage.removeItem("tka_spell_current_sequence");
    } catch {
      // Ignore
    }
    // Return null to proceed with normal load (v1 keys still work)
    return null;
  }

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
        "[SpellPersistence] Storage quota exceeded."
      );
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

    return {
      wizardPhase,
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
