import type { ParsedKeyCombo } from "$lib/shared/keyboard/domain/types/keyboard-types";
import type { ShortcutWithBinding } from "$lib/shared/keyboard/services/types";

export interface CreateAltShortcutHint {
  id: string;
  label: string;
  binding: ParsedKeyCombo;
}

export interface CreateAltShortcutHintModel {
  rotate: CreateAltShortcutHint[];
  transforms: CreateAltShortcutHint[];
  propSummary: ParsedKeyCombo | null;
}

const ROTATE_SHORTCUTS = [
  ["create.transform-rotate-ccw", "Rotate left"],
  ["create.transform-rotate-cw", "Rotate right"],
] as const;

const TRANSFORM_SHORTCUTS = [
  ["create.transform-mirror", "Mirror"],
  ["create.transform-flip", "Flip"],
  ["create.transform-swap-hands", "Swap"],
  ["create.transform-invert", "Invert"],
  ["create.transform-shift-start", "First step"],
  ["create.transform-rewind", "Rewind"],
] as const;

const PROP_SHORTCUT_IDS = Array.from(
  { length: 10 },
  (_, index) => `create.select-preset-${index}`
);

export function buildCreateAltShortcutHints(
  items: ShortcutWithBinding[]
): CreateAltShortcutHintModel {
  const byId = new Map(items.map((item) => [item.shortcut.id, item]));

  const resolve = ([id, label]: readonly [
    string,
    string,
  ]): CreateAltShortcutHint | null => {
    const item = byId.get(id);
    if (!item || item.isDisabled) return null;

    const altIndex = item.effectiveBinding.modifiers.indexOf("alt");
    if (altIndex === -1) return null;

    return {
      id,
      label,
      binding: {
        key: item.effectiveBinding.key,
        modifiers: item.effectiveBinding.modifiers.filter(
          (_, index) => index !== altIndex
        ),
      },
    };
  };

  const rotate = ROTATE_SHORTCUTS.map(resolve).filter(isPresent);
  const transforms = TRANSFORM_SHORTCUTS.map(resolve).filter(isPresent);
  const propBindings = PROP_SHORTCUT_IDS.map((id, index) =>
    resolve([id, `Prop preset ${index + 1}`])
  ).filter(isPresent);

  return {
    rotate,
    transforms,
    propSummary: summarizePropBindings(propBindings),
  };
}

function summarizePropBindings(
  hints: CreateAltShortcutHint[]
): ParsedKeyCombo | null {
  if (hints.length === 0) return null;

  const hasAdditionalModifiers = hints.some(
    ({ binding }) => binding.modifiers.length > 0
  );
  if (hasAdditionalModifiers) return null;

  const keys = hints.map(({ binding }) => binding.key.toLocaleUpperCase());
  const defaultKeys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  return {
    key:
      keys.length === defaultKeys.length &&
      keys.every((key, index) => key === defaultKeys[index])
        ? "1–0"
        : keys.join("·"),
    modifiers: [],
  };
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}
