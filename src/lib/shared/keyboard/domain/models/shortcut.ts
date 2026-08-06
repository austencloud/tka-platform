/**
 * Shortcut Domain Model
 *
 * Represents a keyboard shortcut with all its properties and behavior.
 *
 * Domain: Keyboard Shortcuts
 */

import type {
  KeyModifier,
  ShortcutContext,
  ShortcutBinding,
  ShortcutDefinition,
  ShortcutPriority,
  ShortcutScope,
} from "../types/keyboard-types";

export class Shortcut implements ShortcutDefinition {
  id: string;
  label: string;
  description?: string;
  key: string;
  modifiers: KeyModifier[];
  alternateBindings: ShortcutBinding[];
  context: ShortcutContext | ShortcutContext[];
  scope: ShortcutScope;
  priority: ShortcutPriority;
  preventDefault: boolean;
  stopPropagation: boolean;
  condition?: () => boolean;
  action: (event: KeyboardEvent) => void | Promise<void>;
  enabled: boolean;
  isSingleKey: boolean;
  forceExecute: boolean;
  preserveDrawers: boolean;

  constructor(definition: ShortcutDefinition) {
    this.id = definition.id;
    this.label = definition.label;
    this.key = definition.key;
    this.modifiers = definition.modifiers;
    this.alternateBindings = definition.alternateBindings ?? [];
    this.context = definition.context;
    this.scope = definition.scope;
    this.priority = definition.priority;
    this.preventDefault = definition.preventDefault;
    this.stopPropagation = definition.stopPropagation;
    this.action = definition.action;
    this.enabled = definition.enabled;
    this.isSingleKey = definition.isSingleKey;
    this.forceExecute = definition.forceExecute;
    this.preserveDrawers = definition.preserveDrawers;

    // Only assign optional properties if they exist in the definition
    if ("description" in definition) {
      this.description = definition.description;
    }
    if ("condition" in definition) {
      this.condition = definition.condition;
    }
  }

  /**
   * Check if this shortcut matches the given keyboard event
   */
  matches(
    key: string,
    modifiers: KeyModifier[],
    _ctrlOrMeta: boolean
  ): boolean {
    if (!this.enabled) return false;

    // Normalize key comparison (case-insensitive for letters)
    const normalizedKey = this.normalizeKey(key);
    const normalizedShortcutKey = this.normalizeKey(this.key);

    if (
      normalizedKey === normalizedShortcutKey &&
      this.modifiersMatch(modifiers, this.modifiers)
    ) {
      return true;
    }

    return this.alternateBindings.some(
      (binding) =>
        normalizedKey === this.normalizeKey(binding.key) &&
        this.modifiersMatch(modifiers, binding.modifiers)
    );
  }

  /**
   * Check if this shortcut is active in the given context
   */
  isActiveInContext(currentContext: ShortcutContext): boolean {
    if (!this.enabled) return false;

    const contexts = Array.isArray(this.context)
      ? this.context
      : [this.context];

    return contexts.includes(currentContext) || contexts.includes("global");
  }

  /**
   * Check if the condition (if any) is met
   */
  isConditionMet(): boolean {
    if (!this.condition) return true;
    return this.condition();
  }

  /**
   * Execute the shortcut action
   */
  async execute(event: KeyboardEvent): Promise<void> {
    if (!this.enabled || !this.isConditionMet()) return;

    if (this.preventDefault) {
      event.preventDefault();
    }

    if (this.stopPropagation) {
      event.stopImmediatePropagation();
      event.stopPropagation();
    }

    await this.action(event);
  }

  /**
   * Get formatted shortcut string for display (e.g., "Cmd+K", "Alt+1")
   */
  getFormattedString(isMac: boolean): string {
    const modifierStrings = this.modifiers.map((mod) => {
      switch (mod) {
        case "ctrl":
          return isMac ? "⌃" : "Ctrl";
        case "meta":
          return isMac ? "⌘" : "Win";
        case "alt":
          return isMac ? "⌥" : "Alt";
        case "shift":
          return isMac ? "⇧" : "Shift";
        default:
          return mod;
      }
    });

    const keyString = this.getFormattedKey(this.key);

    return [...modifierStrings, keyString].join(isMac ? "" : "+");
  }

  /**
   * Normalize key for comparison
   */
  private normalizeKey(key: string): string {
    // Special keys that should remain case-sensitive
    const specialKeys = [
      "Enter",
      "Escape",
      "Tab",
      "Space",
      "Backspace",
      "Delete",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
    ];

    if (specialKeys.includes(key)) return key;

    // Normalize letters to lowercase
    return key.toLowerCase();
  }

  /**
   * Check if current modifiers match required modifiers
   */
  private modifiersMatch(
    current: KeyModifier[],
    required: KeyModifier[]
  ): boolean {
    // Both must have same length
    if (current.length !== required.length) return false;

    // All required modifiers must be present
    return required.every((mod) =>
      mod === "ctrl"
        ? current.includes("ctrl") || current.includes("meta")
        : current.includes(mod)
    );
  }

  /**
   * Format special keys for display
   */
  private getFormattedKey(key: string): string {
    const keyMap: Record<string, string> = {
      ArrowUp: "↑",
      ArrowDown: "↓",
      ArrowLeft: "←",
      ArrowRight: "→",
      Enter: "↵",
      Escape: "Esc",
      Backspace: "⌫",
      Delete: "⌦",
      Space: "Space",
      Tab: "⇥",
    };

    return keyMap[key] || key.toUpperCase();
  }

  /**
   * Get priority as numeric value for sorting
   */
  getPriorityValue(): number {
    switch (this.priority) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "medium":
        return 2;
      case "low":
        return 1;
      default:
        return 0;
    }
  }
}
