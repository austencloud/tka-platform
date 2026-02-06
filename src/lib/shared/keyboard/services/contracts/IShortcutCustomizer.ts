/**
 * IShortcutCustomizer Contract
 *
 * Manages custom keyboard shortcut bindings.
 * Handles rebinding shortcuts, conflict detection, and effective binding resolution.
 *
 * Domain: Keyboard Shortcuts - Customization
 */

import type {
  CustomBinding,
  ParsedKeyCombo,
  ShortcutConflict,
  ShortcutRegistrationOptions,
} from "../../domain/types/keyboard-types";

export interface IShortcutCustomizer {
  // ============================================
  // Binding Management
  // ============================================

  /**
   * Set a custom binding for a shortcut
   * @param shortcutId The ID of the shortcut to customize
   * @param keyCombo The new key combo string (e.g., "ctrl+shift+k")
   * @returns Conflict if the key combo conflicts with another shortcut, null otherwise
   */
  setCustomBinding(
    shortcutId: string,
    keyCombo: string
  ): ShortcutConflict | null;

  /**
   * Remove a custom binding, reverting to the default
   * @param shortcutId The ID of the shortcut
   */
  removeCustomBinding(shortcutId: string): void;

  /**
   * Reset a single shortcut binding to its default
   * @param shortcutId The ID of the shortcut
   */
  resetBinding(shortcutId: string): void;

  /**
   * Reset all custom bindings to defaults
   */
  resetAllBindings(): void;

  /**
   * Disable a shortcut (different from removing custom binding)
   * @param shortcutId The ID of the shortcut
   */
  disableShortcut(shortcutId: string): void;

  /**
   * Enable a previously disabled shortcut
   * @param shortcutId The ID of the shortcut
   */
  enableShortcut(shortcutId: string): void;

  // ============================================
  // Conflict Detection
  // ============================================

  /**
   * Check if a key combo would conflict with existing shortcuts
   * @param shortcutId The shortcut being edited (excluded from conflict check)
   * @param keyCombo The proposed key combo
   * @returns Conflict information if one exists, null otherwise
   */
  detectConflict(shortcutId: string, keyCombo: string): ShortcutConflict | null;

  /**
   * Get all current conflicts in the shortcut system
   * @returns Array of all conflicts
   */
  detectAllConflicts(): ShortcutConflict[];

  // ============================================
  // Binding Resolution
  // ============================================

  /**
   * Get the effective binding for a shortcut (custom if set, otherwise default)
   * @param shortcutId The ID of the shortcut
   * @returns Parsed key combo or null if shortcut not found
   */
  getEffectiveBinding(shortcutId: string): ParsedKeyCombo | null;

  /**
   * Get the default (registered) binding for a shortcut
   * @param shortcutId The ID of the shortcut
   * @returns Parsed key combo or null if shortcut not found
   */
  getDefaultBinding(shortcutId: string): ParsedKeyCombo | null;

  /**
   * Get the custom binding for a shortcut if one exists
   * @param shortcutId The ID of the shortcut
   * @returns Custom binding or null if not customized
   */
  getCustomBinding(shortcutId: string): CustomBinding | null;

  /**
   * Check if a shortcut has a custom binding
   * @param shortcutId The ID of the shortcut
   */
  isCustomized(shortcutId: string): boolean;

  /**
   * Check if a shortcut is disabled
   * @param shortcutId The ID of the shortcut
   */
  isDisabled(shortcutId: string): boolean;

  // ============================================
  // Queries
  // ============================================

  /**
   * Get all shortcuts with their effective bindings
   * @returns Array of shortcuts with resolved bindings
   */
  getAllShortcutsWithBindings(): ShortcutWithBinding[];

  /**
   * Get count of customized shortcuts
   */
  getCustomizedCount(): number;

  /**
   * Get count of disabled shortcuts
   */
  getDisabledCount(): number;
}

/**
 * Shortcut with its resolved (effective) binding
 */
export interface ShortcutWithBinding {
  /** Original shortcut registration */
  shortcut: ShortcutRegistrationOptions;

  /** Default binding from registration */
  defaultBinding: ParsedKeyCombo;

  /** Effective binding (custom if set, otherwise default) */
  effectiveBinding: ParsedKeyCombo;

  /** Custom binding if set */
  customBinding: CustomBinding | null;

  /** Whether this shortcut has a custom binding */
  isCustomized: boolean;

  /** Whether this shortcut is disabled */
  isDisabled: boolean;
}
