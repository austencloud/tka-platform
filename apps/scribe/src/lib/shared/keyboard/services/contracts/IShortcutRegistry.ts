/**
 * IShortcutRegistry Contract
 *
 * Registry for storing and managing keyboard shortcuts.
 * Provides lookup and querying capabilities.
 *
 * Domain: Keyboard Shortcuts
 */

import type { Shortcut } from "../../domain/models/Shortcut";
import type {
  KeyModifier,
  ShortcutContext,
} from "../../domain/types/keyboard-types";

export interface IShortcutRegistry {
  /**
   * Add a shortcut to the registry
   * @param shortcut Shortcut to add
   */
  add(shortcut: Shortcut): void;

  /**
   * Remove a shortcut from the registry
   * @param id Shortcut ID
   */
  remove(id: string): void;

  /**
   * Get a shortcut by ID
   * @param id Shortcut ID
   */
  get(id: string): Shortcut | undefined;

  /**
   * Check if a shortcut exists
   * @param id Shortcut ID
   */
  has(id: string): boolean;

  /**
   * Get all shortcuts
   */
  getAll(): Shortcut[];

  /**
   * Find shortcuts that match the given key and modifiers
   * @param key Key pressed
   * @param modifiers Active modifiers
   * @param ctrlOrMeta Whether Ctrl or Meta was pressed
   * @param context Current context
   */
  findMatches(
    key: string,
    modifiers: KeyModifier[],
    ctrlOrMeta: boolean,
    context: ShortcutContext
  ): Shortcut[];

  /**
   * Get shortcuts for a specific context
   * @param context Context to filter by
   */
  getByContext(context: ShortcutContext): Shortcut[];

  /**
   * Get shortcuts by scope
   * @param scope Scope to filter by
   */
  getByScope(scope: string): Shortcut[];

  /**
   * Clear all shortcuts
   */
  clear(): void;

  /**
   * Get count of registered shortcuts
   */
  count(): number;
}
