/**
 * Key Combo Utilities
 *
 * Utilities for parsing, formatting, normalizing, and comparing keyboard shortcuts.
 *
 * Domain: Keyboard Shortcuts - Utilities
 */

import type {
  KeyModifier,
  ParsedKeyCombo,
} from "../domain/types/keyboard-types";

/**
 * Order of modifiers for consistent formatting and comparison
 */
const MODIFIER_ORDER: KeyModifier[] = ["ctrl", "alt", "shift", "meta"];

/**
 * Parse a key combo string into its components
 *
 * @example
 * parseKeyCombo("ctrl+shift+k") // { key: "k", modifiers: ["ctrl", "shift"] }
 * parseKeyCombo("Space") // { key: "Space", modifiers: [] }
 * parseKeyCombo("alt+ArrowUp") // { key: "ArrowUp", modifiers: ["alt"] }
 */
export function parseKeyCombo(combo: string): ParsedKeyCombo {
  if (!combo || combo.trim() === "") {
    return { key: "", modifiers: [] };
  }

  const parts = combo
    .toLowerCase()
    .split("+")
    .map((p) => p.trim());
  const modifiers: KeyModifier[] = [];
  let key = "";

  for (const part of parts) {
    if (part === "ctrl" || part === "control") {
      modifiers.push("ctrl");
    } else if (part === "alt" || part === "option") {
      modifiers.push("alt");
    } else if (part === "shift") {
      modifiers.push("shift");
    } else if (
      part === "meta" ||
      part === "cmd" ||
      part === "command" ||
      part === "win"
    ) {
      modifiers.push("meta");
    } else {
      // This is the main key - preserve case for special keys
      key = normalizeKeyName(part);
    }
  }

  // Sort modifiers for consistent ordering
  modifiers.sort(
    (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b)
  );

  return { key, modifiers };
}

/**
 * Normalize a key name to a consistent format
 * Handles variations like "space" → "Space", "arrowleft" → "ArrowLeft"
 */
function normalizeKeyName(key: string): string {
  const lowerKey = key.toLowerCase();

  // Special keys mapping
  const specialKeys: Record<string, string> = {
    space: "Space",
    " ": "Space",
    enter: "Enter",
    return: "Enter",
    escape: "Escape",
    esc: "Escape",
    backspace: "Backspace",
    delete: "Delete",
    del: "Delete",
    tab: "Tab",
    arrowup: "ArrowUp",
    arrowdown: "ArrowDown",
    arrowleft: "ArrowLeft",
    arrowright: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    pageup: "PageUp",
    pagedown: "PageDown",
    home: "Home",
    end: "End",
    insert: "Insert",
    "?": "/",
  };

  // Function keys
  const fnMatch = lowerKey.match(/^f(\d+)$/);
  if (fnMatch) {
    return `F${fnMatch[1]}`;
  }

  return specialKeys[lowerKey] || key.toUpperCase();
}

/**
 * Build a key combo string from components
 *
 * @example
 * buildKeyCombo("k", ["ctrl", "shift"]) // "ctrl+shift+k"
 * buildKeyCombo("Space", []) // "Space"
 */
export function buildKeyCombo(key: string, modifiers: KeyModifier[]): string {
  const sortedModifiers = [...modifiers].sort(
    (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b)
  );

  const parts = [...sortedModifiers, key];
  return parts.join("+");
}

/**
 * Format a key combo for display, with platform-specific symbols
 *
 * @example
 * formatKeyComboForDisplay("ctrl+shift+k", true) // "^⇧K" (Mac)
 * formatKeyComboForDisplay("ctrl+shift+k", false) // "Ctrl+Shift+K" (Windows)
 */
export function formatKeyComboForDisplay(
  combo: string,
  isMac: boolean
): string {
  const { key, modifiers } = parseKeyCombo(combo);
  return formatParsedKeyCombo(key, modifiers, isMac);
}

/**
 * Format a parsed key combo for display
 */
export function formatParsedKeyCombo(
  key: string,
  modifiers: KeyModifier[],
  isMac: boolean
): string {
  const modifierLabels: Record<KeyModifier, string> = isMac
    ? { ctrl: "⌃", alt: "⌥", shift: "⇧", meta: "⌘" }
    : { ctrl: "Ctrl", alt: "Alt", shift: "Shift", meta: "Win" };

  const sortedModifiers = [...modifiers].sort(
    (a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b)
  );

  const modifierStrings = sortedModifiers.map((m) => modifierLabels[m]);
  const keyLabel = formatKeyForDisplay(key, isMac);

  if (isMac) {
    // Mac style: ⌘⇧K (no separators)
    return [...modifierStrings, keyLabel].join("");
  } else {
    // Windows style: Ctrl+Shift+K
    return [...modifierStrings, keyLabel].join("+");
  }
}

/**
 * Format a single key for display
 */
export function formatKeyForDisplay(key: string, isMac: boolean): string {
  const keyMap: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Enter: isMac ? "↵" : "Enter",
    Escape: "Esc",
    Backspace: isMac ? "⌫" : "Backspace",
    Delete: isMac ? "⌦" : "Delete",
    Space: "Space",
    Tab: isMac ? "⇥" : "Tab",
    PageUp: "PgUp",
    PageDown: "PgDn",
  };

  return keyMap[key] || key.toUpperCase();
}

/**
 * Normalize a key combo string for comparison
 * Ensures consistent casing and modifier ordering
 */
export function normalizeKeyCombo(combo: string): string {
  const { key, modifiers } = parseKeyCombo(combo);
  return buildKeyCombo(key, modifiers).toLowerCase();
}

/**
 * Check if two key combos are equal (case-insensitive, order-independent for modifiers)
 */
export function keyComboEquals(a: string, b: string): boolean {
  return normalizeKeyCombo(a) === normalizeKeyCombo(b);
}

/**
 * Check if a key combo is a single key (no modifiers)
 */
export function isSingleKeyCombo(combo: string): boolean {
  const { modifiers } = parseKeyCombo(combo);
  return modifiers.length === 0;
}

/**
 * Get modifiers from a keyboard event
 */
export function getModifiersFromEvent(event: KeyboardEvent): KeyModifier[] {
  const modifiers: KeyModifier[] = [];

  if (event.ctrlKey) modifiers.push("ctrl");
  if (event.altKey) modifiers.push("alt");
  if (event.shiftKey) modifiers.push("shift");
  if (event.metaKey) modifiers.push("meta");

  return modifiers;
}

/**
 * Build a key combo string from a keyboard event
 */
export function keyComboFromEvent(event: KeyboardEvent): string {
  const modifiers = getModifiersFromEvent(event);

  // Don't include modifier keys as the main key
  if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) {
    return "";
  }

  const key = normalizeKeyName(event.key);
  return buildKeyCombo(key, modifiers);
}

/**
 * Validate that a key combo string is well-formed
 */
export function isValidKeyCombo(combo: string): boolean {
  if (!combo || combo.trim() === "") {
    return false;
  }

  const { key, modifiers } = parseKeyCombo(combo);

  // Must have a main key
  if (!key) {
    return false;
  }

  // Check for duplicate modifiers
  const uniqueModifiers = new Set(modifiers);
  if (uniqueModifiers.size !== modifiers.length) {
    return false;
  }

  return true;
}

/**
 * Check if two contexts can conflict (overlap)
 * Returns true if shortcuts in these contexts could both be active at the same time
 */
export function contextsCanConflict(
  contextA: string | string[],
  contextB: string | string[]
): boolean {
  const contextsA = Array.isArray(contextA) ? contextA : [contextA];
  const contextsB = Array.isArray(contextB) ? contextB : [contextB];

  // "global" conflicts with everything
  if (contextsA.includes("global") || contextsB.includes("global")) {
    return true;
  }

  // Check for direct overlap
  for (const a of contextsA) {
    if (contextsB.includes(a)) {
      return true;
    }
  }

  // Module contexts and their panel contexts can overlap
  const modulePanelMap: Record<string, string[]> = {
    create: ["edit-panel"],
    compose: ["animation-panel", "share-panel"],
    browse: ["share-panel"],
  };

  for (const a of contextsA) {
    const relatedPanels = modulePanelMap[a] || [];
    for (const panel of relatedPanels) {
      if (contextsB.includes(panel)) {
        return true;
      }
    }
  }

  for (const b of contextsB) {
    const relatedPanels = modulePanelMap[b] || [];
    for (const panel of relatedPanels) {
      if (contextsA.includes(panel)) {
        return true;
      }
    }
  }

  return false;
}
