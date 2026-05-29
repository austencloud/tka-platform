/**
 * ShortcutCustomizer Implementation
 *
 * Manages custom keyboard shortcut bindings, conflict detection,
 * and effective binding resolution.
 *
 * Domain: Keyboard Shortcuts - Customization
 */

import type { ShortcutRegistry } from "./shortcut-registry";
import type { ShortcutWithBinding } from "./types";
import type {
  CustomBinding,
  ParsedKeyCombo,
  ShortcutConflict,
  ShortcutContext,
  ShortcutRegistrationOptions,
} from "../domain/types/keyboard-types";
import {
  buildKeyCombo,
  contextsCanConflict,
  keyComboEquals,
  parseKeyCombo,
} from "../utils/key-combo-utils";
import { keyboardShortcutState } from "../state/keyboard-shortcut-state.svelte";

export class ShortcutCustomizer {
  constructor(private readonly registry: ShortcutRegistry) {}

  // ============================================
  // Binding Management
  // ============================================

  setCustomBinding(
    shortcutId: string,
    keyCombo: string
  ): ShortcutConflict | null {
    // Check for conflicts first
    const conflict = this.detectConflict(shortcutId, keyCombo);
    if (conflict?.severity === "error") {
      return conflict;
    }

    // Set the custom binding
    const binding: CustomBinding = { keyCombo };
    keyboardShortcutState.setCustomBinding(shortcutId, binding);

    // Return warning-level conflict if exists
    return conflict;
  }

  removeCustomBinding(shortcutId: string): void {
    keyboardShortcutState.removeCustomBinding(shortcutId);
  }

  resetBinding(shortcutId: string): void {
    this.removeCustomBinding(shortcutId);
  }

  resetAllBindings(): void {
    keyboardShortcutState.resetAllCustomBindings();
  }

  disableShortcut(shortcutId: string): void {
    const existing = this.getCustomBinding(shortcutId);
    if (existing) {
      keyboardShortcutState.setCustomBinding(shortcutId, {
        ...existing,
        disabled: true,
      });
    } else {
      // Create a disabled binding with the default key combo
      const defaultBinding = this.getDefaultBinding(shortcutId);
      if (defaultBinding) {
        keyboardShortcutState.setCustomBinding(shortcutId, {
          keyCombo: buildKeyCombo(defaultBinding.key, defaultBinding.modifiers),
          disabled: true,
        });
      }
    }
  }

  enableShortcut(shortcutId: string): void {
    const existing = this.getCustomBinding(shortcutId);
    if (existing) {
      keyboardShortcutState.setCustomBinding(shortcutId, {
        ...existing,
        disabled: false,
      });
    }
  }

  // ============================================
  // Conflict Detection
  // ============================================

  detectConflict(
    shortcutId: string,
    keyCombo: string
  ): ShortcutConflict | null {
    const shortcut = this.registry.get(shortcutId);
    if (!shortcut) return null;

    const shortcutContexts = Array.isArray(shortcut.context)
      ? shortcut.context
      : [shortcut.context];

    // Get all registered shortcuts
    const allShortcuts = this.registry.getAll();

    for (const other of allShortcuts) {
      // Skip self
      if (other.id === shortcutId) continue;

      // Skip disabled shortcuts
      if (this.isDisabled(other.id)) continue;

      // Get effective binding for the other shortcut
      const otherBinding = this.getEffectiveBinding(other.id);
      if (!otherBinding) continue;

      const otherKeyCombo = buildKeyCombo(
        otherBinding.key,
        otherBinding.modifiers
      );

      // Check if key combos match
      if (!keyComboEquals(keyCombo, otherKeyCombo)) continue;

      // Key combos match - check for context conflict
      const otherContexts = Array.isArray(other.context)
        ? other.context
        : [other.context];

      // Find overlapping context
      for (const context of shortcutContexts) {
        if (contextsCanConflict(context, otherContexts)) {
          // Determine severity
          const hasDirectOverlap = otherContexts.some(
            (c) => c === context || c === "global" || context === "global"
          );

          return {
            existingShortcutId: other.id,
            existingShortcutLabel: other.label,
            keyCombo,
            context: context as ShortcutContext,
            severity: hasDirectOverlap ? "error" : "warning",
          };
        }
      }
    }

    return null;
  }

  detectAllConflicts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];
    const allShortcuts = this.registry.getAll();
    const checked = new Set<string>();

    for (const shortcut of allShortcuts) {
      if (this.isDisabled(shortcut.id)) continue;

      const binding = this.getEffectiveBinding(shortcut.id);
      if (!binding) continue;

      const keyCombo = buildKeyCombo(binding.key, binding.modifiers);
      const contexts = Array.isArray(shortcut.context)
        ? shortcut.context
        : [shortcut.context];

      // Check against all other shortcuts
      for (const other of allShortcuts) {
        if (other.id === shortcut.id) continue;
        if (this.isDisabled(other.id)) continue;

        // Skip if already checked this pair
        const pairKey = [shortcut.id, other.id].sort().join(":");
        if (checked.has(pairKey)) continue;
        checked.add(pairKey);

        const otherBinding = this.getEffectiveBinding(other.id);
        if (!otherBinding) continue;

        const otherKeyCombo = buildKeyCombo(
          otherBinding.key,
          otherBinding.modifiers
        );

        if (!keyComboEquals(keyCombo, otherKeyCombo)) continue;

        const otherContexts = Array.isArray(other.context)
          ? other.context
          : [other.context];

        // Check for context overlap
        for (const context of contexts) {
          if (contextsCanConflict(context, otherContexts)) {
            const hasDirectOverlap = otherContexts.some(
              (c) => c === context || c === "global" || context === "global"
            );

            conflicts.push({
              existingShortcutId: other.id,
              existingShortcutLabel: other.label,
              keyCombo,
              context: context as ShortcutContext,
              severity: hasDirectOverlap ? "error" : "warning",
            });
            break;
          }
        }
      }
    }

    return conflicts;
  }

  // ============================================
  // Binding Resolution
  // ============================================

  getEffectiveBinding(shortcutId: string): ParsedKeyCombo | null {
    const customBinding = this.getCustomBinding(shortcutId);
    if (customBinding && !customBinding.disabled) {
      return parseKeyCombo(customBinding.keyCombo);
    }

    return this.getDefaultBinding(shortcutId);
  }

  getDefaultBinding(shortcutId: string): ParsedKeyCombo | null {
    const shortcut = this.registry.get(shortcutId);
    if (!shortcut) return null;

    return {
      key: shortcut.key,
      modifiers: [...shortcut.modifiers],
    };
  }

  getCustomBinding(shortcutId: string): CustomBinding | null {
    const bindings = keyboardShortcutState.settings.customBindings;
    return bindings[shortcutId] || null;
  }

  isCustomized(shortcutId: string): boolean {
    const custom = this.getCustomBinding(shortcutId);
    if (!custom) return false;

    // Check if the custom binding differs from default
    const defaultBinding = this.getDefaultBinding(shortcutId);
    if (!defaultBinding) return true;

    const defaultCombo = buildKeyCombo(
      defaultBinding.key,
      defaultBinding.modifiers
    );

    return !keyComboEquals(custom.keyCombo, defaultCombo) || !!custom.disabled;
  }

  isDisabled(shortcutId: string): boolean {
    const custom = this.getCustomBinding(shortcutId);
    return custom?.disabled ?? false;
  }

  // ============================================
  // Queries
  // ============================================

  getAllShortcutsWithBindings(): ShortcutWithBinding[] {
    const allShortcuts = this.registry.getAll();

    return allShortcuts.map((shortcut) => {
      const defaultBinding: ParsedKeyCombo = {
        key: shortcut.key,
        modifiers: [...shortcut.modifiers],
      };

      const customBinding = this.getCustomBinding(shortcut.id);
      const effectiveBinding =
        this.getEffectiveBinding(shortcut.id) || defaultBinding;

      // Convert Shortcut to ShortcutRegistrationOptions
      const options: ShortcutRegistrationOptions = {
        id: shortcut.id,
        label: shortcut.label,
        description: shortcut.description,
        key: shortcut.key,
        modifiers: shortcut.modifiers,
        context: shortcut.context,
        scope: shortcut.scope,
        priority: shortcut.priority,
        preventDefault: shortcut.preventDefault,
        stopPropagation: shortcut.stopPropagation,
        condition: shortcut.condition,
        action: shortcut.action,
        enabled: shortcut.enabled,
      };

      return {
        shortcut: options,
        defaultBinding,
        effectiveBinding,
        customBinding,
        isCustomized: this.isCustomized(shortcut.id),
        isDisabled: this.isDisabled(shortcut.id),
      };
    });
  }

  getCustomizedCount(): number {
    return Object.keys(keyboardShortcutState.settings.customBindings).length;
  }

  getDisabledCount(): number {
    const bindings = keyboardShortcutState.settings.customBindings;
    return Object.values(bindings).filter((b) => b.disabled).length;
  }
}
