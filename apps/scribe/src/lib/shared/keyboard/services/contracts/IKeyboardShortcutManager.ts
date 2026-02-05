/**
 * IKeyboardShortcutManager Contract
 *
 * Manages keyboard shortcuts globally.
 * Handles registration, event listening, and execution of shortcuts.
 *
 * Domain: Keyboard Shortcuts
 */

import type {
  ShortcutContext,
  ShortcutRegistrationOptions,
} from "../../domain/types/keyboard-types";

export interface IKeyboardShortcutManager {
  /**
   * Initialize the service and start listening for keyboard events
   */
  initialize(): void;

  /**
   * Dispose the service and remove event listeners
   */
  dispose(): void;

  /**
   * Register a keyboard shortcut
   * @param options Shortcut registration options
   * @returns Unregister function
   */
  register(options: ShortcutRegistrationOptions): () => void;

  /**
   * Unregister a keyboard shortcut by ID
   * @param id Shortcut ID
   */
  unregister(id: string): void;

  /**
   * Enable a shortcut
   * @param id Shortcut ID
   */
  enable(id: string): void;

  /**
   * Disable a shortcut
   * @param id Shortcut ID
   */
  disable(id: string): void;

  /**
   * Set the current context (e.g., "create", "browse", etc.)
   * @param context Current context
   */
  setContext(context: ShortcutContext): void;

  /**
   * Get the current context
   */
  getContext(): ShortcutContext;

  /**
   * Check if a shortcut is registered
   * @param id Shortcut ID
   */
  isRegistered(id: string): boolean;

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): ShortcutRegistrationOptions[];

  /**
   * Get shortcuts for a specific context
   * @param context Context to filter by
   */
  getShortcutsForContext(
    context: ShortcutContext
  ): ShortcutRegistrationOptions[];
}
