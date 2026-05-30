// src/lib/features/choreo-card/domain/canonical-card-visibility.ts
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { TnDElement } from "./tnd-element";

/**
 * The fixed playing-card look for every LOCKED choreo-card render: released
 * decks, print preview, deck releaser, the whole Choreo-cards tab. This is the
 * single source of truth — change the card look by editing this one object.
 *
 * NOT used by the flexible sequence-viewer download (that reads the global
 * VisibilityStateManager). Keep the two domains separate on purpose.
 */
export const CANONICAL_DECK_CARD_PROFILE = Object.freeze({
  // Pictograph "Choreo parts"
  showGrid: true,
  showTKA: true,
  handPointVisibility: "all" as const,
  showNonRadialPoints: false,
  showReversals: true,
  showPositions: false,
  showTnD: false,
  // Composition flags that are always-on for deck cards
  addWord: true,
  showQRCode: true,
});

export interface CanonicalCardVisibility {
  /** Top-level compose option (NOT a visibilityOverrides member). */
  addWord: boolean;
  /** Spread into composeOptions.visibilityOverrides. */
  visibilityOverrides: {
    showGrid: boolean;
    showTKA: boolean;
    handPointVisibility: "all" | "active" | "none";
    showNonRadialPoints: boolean;
    showReversals: boolean;
    showPositions: boolean;
    showTnD: boolean;
    showElemental: boolean;
    showQRCode: boolean;
    printMode: boolean;
    darkMode: boolean;
    bluePropType?: PropType;
    redPropType?: PropType;
  };
}

/**
 * Build the complete locked visibility set for one card. `showElemental` is the
 * only per-card value: TnD-deck cards show each pictograph's element glyph.
 */
export function buildCanonicalCardVisibility(args: {
  tndElement?: TnDElement | null;
  bluePropType?: PropType;
  redPropType?: PropType;
}): CanonicalCardVisibility {
  return {
    addWord: CANONICAL_DECK_CARD_PROFILE.addWord,
    visibilityOverrides: {
      showGrid: CANONICAL_DECK_CARD_PROFILE.showGrid,
      showTKA: CANONICAL_DECK_CARD_PROFILE.showTKA,
      handPointVisibility: CANONICAL_DECK_CARD_PROFILE.handPointVisibility,
      showNonRadialPoints: CANONICAL_DECK_CARD_PROFILE.showNonRadialPoints,
      showReversals: CANONICAL_DECK_CARD_PROFILE.showReversals,
      showPositions: CANONICAL_DECK_CARD_PROFILE.showPositions,
      showTnD: CANONICAL_DECK_CARD_PROFILE.showTnD,
      showElemental: args.tndElement != null,
      showQRCode: CANONICAL_DECK_CARD_PROFILE.showQRCode,
      printMode: true,
      darkMode: false,
      ...(args.bluePropType && { bluePropType: args.bluePropType }),
      ...(args.redPropType && { redPropType: args.redPropType }),
    },
  };
}
