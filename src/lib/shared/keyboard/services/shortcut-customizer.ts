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

  // Binding Management

  setCustomBinding(
    shortcutId: string,
    keyCombo: string
  ): ShortcutConflict | null {
    const conflicts = this.detectConflicts(shortcutId, keyCombo);
    const blockingConflict = conflicts.find(
      ({ severity }) => severity === "error"
    );
    if (blockingConflict) {
      return blockingConflict;
    }

    keyboardShortcutState.updateCustomBindings({
      [shortcutId]: this.bindingUpdateForCombo(shortcutId, keyCombo),
    });

    return conflicts[0] ?? null;
  }

  replaceBinding(shortcutId: string, keyCombo: string): ShortcutConflict[] {
    const conflicts = this.detectConflicts(shortcutId, keyCombo).filter(
      ({ severity }) => severity === "error"
    );
    const updates: Record<string, CustomBinding | null> = {
      [shortcutId]: this.bindingUpdateForCombo(shortcutId, keyCombo),
    };

    for (const conflict of conflicts) {
      const effectiveBinding = this.getEffectiveBinding(
        conflict.existingShortcutId
      );
      if (!effectiveBinding) continue;

      updates[conflict.existingShortcutId] = {
        keyCombo: buildKeyCombo(
          effectiveBinding.key,
          effectiveBinding.modifiers
        ),
        disabled: true,
      };
    }

    keyboardShortcutState.updateCustomBindings(updates);
    return conflicts;
  }

  swapBindings(
    shortcutId: string,
    otherShortcutId: string
  ): ShortcutConflict | null {
    const currentBinding = this.getEffectiveBinding(shortcutId);
    const otherBinding = this.getEffectiveBinding(otherShortcutId);
    if (!currentBinding || !otherBinding) return null;

    const currentCombo = buildKeyCombo(
      currentBinding.key,
      currentBinding.modifiers
    );
    const otherCombo = buildKeyCombo(otherBinding.key, otherBinding.modifiers);
    const blockingConflict = this.detectConflicts(
      otherShortcutId,
      currentCombo
    ).find(
      (conflict) =>
        conflict.severity === "error" &&
        conflict.existingShortcutId !== shortcutId
    );

    if (blockingConflict) return blockingConflict;

    keyboardShortcutState.updateCustomBindings({
      [shortcutId]: this.bindingUpdateForCombo(shortcutId, otherCombo),
      [otherShortcutId]: this.bindingUpdateForCombo(
        otherShortcutId,
        currentCombo
      ),
    });
    return null;
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
      keyboardShortcutState.updateCustomBindings({
        [shortcutId]: this.bindingUpdateForCombo(shortcutId, existing.keyCombo),
      });
    }
  }

  // Conflict Detection

  detectConflict(
    shortcutId: string,
    keyCombo: string
  ): ShortcutConflict | null {
    return this.detectConflicts(shortcutId, keyCombo)[0] ?? null;
  }

  detectConflicts(shortcutId: string, keyCombo: string): ShortcutConflict[] {
    const shortcut = this.registry.get(shortcutId);
    if (!shortcut) return [];

    const shortcutContexts = Array.isArray(shortcut.context)
      ? shortcut.context
      : [shortcut.context];
    const conflicts: ShortcutConflict[] = [];

    const allShortcuts = this.registry.getAll();

    for (const other of allShortcuts) {
      // Skip self
      if (other.id === shortcutId) continue;

      // Skip disabled shortcuts
      if (this.isDisabled(other.id)) continue;

      // Get effective binding for the other shortcut
      const matchesOtherBinding = this.getEffectiveBindings(other.id).some(
        (otherBinding) =>
          keyComboEquals(
            keyCombo,
            buildKeyCombo(otherBinding.key, otherBinding.modifiers)
          )
      );

      if (!matchesOtherBinding) continue;

      // Key combos match - check for context conflict
      const otherContexts = Array.isArray(other.context)
        ? other.context
        : [other.context];

      if (!contextsCanConflict(shortcutContexts, otherContexts)) continue;

      const directContext = shortcutContexts.find(
        (context) =>
          context === "global" ||
          otherContexts.includes("global") ||
          otherContexts.includes(context)
      );

      conflicts.push({
        existingShortcutId: other.id,
        existingShortcutLabel: other.label,
        keyCombo,
        context: directContext ?? shortcutContexts[0] ?? "global",
        severity: directContext ? "error" : "warning",
      });
    }

    return conflicts;
  }

  detectAllConflicts(): ShortcutConflict[] {
    const conflicts: ShortcutConflict[] = [];
    const allShortcuts = this.registry.getAll();
    const checked = new Set<string>();

    for (const shortcut of allShortcuts) {
      if (this.isDisabled(shortcut.id)) continue;

      const bindings = this.getEffectiveBindings(shortcut.id);
      if (bindings.length === 0) continue;
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

        const otherBindings = this.getEffectiveBindings(other.id);
        const conflictingKeyCombo = bindings
          .map((binding) => buildKeyCombo(binding.key, binding.modifiers))
          .find((keyCombo) =>
            otherBindings.some((otherBinding) =>
              keyComboEquals(
                keyCombo,
                buildKeyCombo(otherBinding.key, otherBinding.modifiers)
              )
            )
          );

        if (!conflictingKeyCombo) continue;

        const otherContexts = Array.isArray(other.context)
          ? other.context
          : [other.context];

        for (const context of contexts) {
          if (contextsCanConflict(context, otherContexts)) {
            const hasDirectOverlap = otherContexts.some(
              (c) => c === context || c === "global" || context === "global"
            );

            conflicts.push({
              existingShortcutId: other.id,
              existingShortcutLabel: other.label,
              keyCombo: conflictingKeyCombo,
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

  // Binding Resolution

  getEffectiveBinding(shortcutId: string): ParsedKeyCombo | null {
    const customBinding = this.getCustomBinding(shortcutId);
    if (customBinding) {
      return parseKeyCombo(customBinding.keyCombo);
    }

    return this.getDefaultBinding(shortcutId);
  }

  private getEffectiveBindings(shortcutId: string): ParsedKeyCombo[] {
    const customBinding = this.getCustomBinding(shortcutId);
    if (customBinding) {
      const parsed = parseKeyCombo(customBinding.keyCombo);
      return parsed ? [parsed] : [];
    }

    const shortcut = this.registry.get(shortcutId);
    if (!shortcut) return [];
    return [
      { key: shortcut.key, modifiers: [...shortcut.modifiers] },
      ...shortcut.alternateBindings.map((binding) => ({
        key: binding.key,
        modifiers: [...binding.modifiers],
      })),
    ];
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

  // Queries

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

      const options: ShortcutRegistrationOptions = {
        id: shortcut.id,
        label: shortcut.label,
        description: shortcut.description,
        key: shortcut.key,
        modifiers: shortcut.modifiers,
        alternateBindings: shortcut.alternateBindings,
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
    return this.getAllShortcutsWithBindings().filter(
      ({ isCustomized }) => isCustomized
    ).length;
  }

  getDisabledCount(): number {
    const bindings = keyboardShortcutState.settings.customBindings;
    return Object.values(bindings).filter((b) => b.disabled).length;
  }

  private bindingUpdateForCombo(
    shortcutId: string,
    keyCombo: string
  ): CustomBinding | null {
    const defaultBinding = this.getDefaultBinding(shortcutId);
    if (
      defaultBinding &&
      keyComboEquals(
        keyCombo,
        buildKeyCombo(defaultBinding.key, defaultBinding.modifiers)
      )
    ) {
      return null;
    }

    return { keyCombo };
  }
}
