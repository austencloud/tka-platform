import {
  getSettings,
  updateSettings,
} from "$lib/shared/application/state/app-state.svelte";

export interface PropChiralitySeam {
  /** Current chirality of the hand this seam addresses. */
  readonly flipped: boolean;
  /** Which hand the seam writes. Omitted means both. */
  readonly hand?: "blue" | "red";
  onChange: (flipped: boolean) => void;
}

/**
 * The chirality seam for hosts whose prop picker edits the global preference —
 * which is all of them except the deck releaser, whose cards are canonical.
 *
 * `flipped` is a getter rather than a snapshot so a seam built inline in markup
 * still tracks the setting: the picker reads it during its own render, which is
 * what registers the dependency.
 *
 * Passing no hand writes both, matching what `handlePropTypeChange` already
 * does for prop type itself in the single-prop hosts. Blue is then the value
 * read back, because a host that writes both can never have them disagree
 * through this control.
 */
export function createGlobalChiralitySeam(
  hand?: "blue" | "red"
): PropChiralitySeam {
  return {
    get flipped() {
      const settings = getSettings();
      return (
        (hand === "red"
          ? settings.redBuugengFlipped
          : settings.blueBuugengFlipped) ?? false
      );
    },
    hand,
    onChange(flipped: boolean) {
      if (hand === "blue") {
        updateSettings({ blueBuugengFlipped: flipped });
      } else if (hand === "red") {
        updateSettings({ redBuugengFlipped: flipped });
      } else {
        updateSettings({
          blueBuugengFlipped: flipped,
          redBuugengFlipped: flipped,
        });
      }
    },
  };
}
