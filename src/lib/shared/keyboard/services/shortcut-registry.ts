/**
 * ShortcutRegistry Implementation
 *
 * Registry for storing and managing keyboard shortcuts.
 * Supports custom bindings from keyboard-shortcut-state.
 *
 * Domain: Keyboard Shortcuts
 */

import type { Shortcut } from "../domain/models/shortcut";
import type {
  KeyModifier,
  ShortcutContext,
} from "../domain/types/keyboard-types";
import { keyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";
import { keyComboEquals, buildKeyCombo } from "../utils/key-combo-utils";

export class ShortcutRegistry {
  private shortcuts: Map<string, Shortcut> = new Map();
  private listeners = new Set<() => void>();

  add(shortcut: Shortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
    this.notify();
  }

  remove(id: string): void {
    if (this.shortcuts.delete(id)) {
      this.notify();
    }
  }

  get(id: string): Shortcut | undefined {
    return this.shortcuts.get(id);
  }

  has(id: string): boolean {
    return this.shortcuts.has(id);
  }

  getAll(): Shortcut[] {
    return Array.from(this.shortcuts.values());
  }

  findMatches(
    key: string,
    modifiers: KeyModifier[],
    ctrlOrMeta: boolean,
    context: ShortcutContext
  ): Shortcut[] {
    const matches: Shortcut[] = [];
    const customBindings = keyboardShortcutState.settings.customBindings;

    // Build the incoming key combo for comparison
    const incomingKeyCombo = buildKeyCombo(key, modifiers);

    for (const shortcut of this.shortcuts.values()) {
      // Check if shortcut is active in current context
      if (!shortcut.isActiveInContext(context)) continue;

      // Check if condition is met
      if (!shortcut.isConditionMet()) continue;

      // Check for custom binding
      const customBinding = customBindings[shortcut.id];

      if (customBinding) {
        // Shortcut has a custom binding
        if (customBinding.disabled) {
          // Skip disabled shortcuts
          continue;
        }

        // Match against custom binding
        if (keyComboEquals(incomingKeyCombo, customBinding.keyCombo)) {
          matches.push(shortcut);
        }
      } else {
        // No custom binding - use default matching
        if (shortcut.matches(key, modifiers, ctrlOrMeta)) {
          matches.push(shortcut);
        }
      }
    }

    // Sort by priority (highest first)
    return matches.sort((a, b) => b.getPriorityValue() - a.getPriorityValue());
  }

  getByContext(context: ShortcutContext): Shortcut[] {
    return this.getAll().filter((shortcut) =>
      shortcut.isActiveInContext(context)
    );
  }

  getByScope(scope: string): Shortcut[] {
    return this.getAll().filter((shortcut) => shortcut.scope === scope);
  }

  clear(): void {
    if (this.shortcuts.size > 0) {
      this.shortcuts.clear();
      this.notify();
    }
  }

  count(): number {
    return this.shortcuts.size;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
