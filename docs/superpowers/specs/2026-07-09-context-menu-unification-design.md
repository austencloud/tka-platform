# Context Menu Unification — Additive Pictograph + Card Sections

**Date:** 2026-07-09
**Status:** Approved (Austen: "yes, do that, full send")
**Feedback:** `O7E62E7aN358Uc19LIOm` — "Right-clicking a pictograph inside a card should show both Pictograph Settings and Card Settings. The context should be additive."
**Unblocks:** `3IPLlE7L6LGblCjqfuTG` (three-tier start-position layout settings)

## Problem

Right-click menus on pictographs and choreo cards are built in four separate
places with no overlap:

| Surface | Menu today | Built by |
|---|---|---|
| Workspace pictograph (StepCell), option picker | Grid & Points, Glyphs, Step Numbers (+admin arrow adjust) | `pictograph-context-menu-builder.ts` |
| Sequence-viewer card (split pane, /sequence/[id]) | Columns, Re-render, Send to, Sticker Lab | `card-designer-context-menu-builder.ts` |
| Shared ChoreoCard fallback (fuse, landing, compose cells…) | admin Save/Copy/Claude + Re-render | `choreo-card-context-menu.ts` (a **second**, near-identically-named card builder) |
| Browse/library thumbnail | Send to, Re-render, admin trio, collection ops | hand-rolled inline in `ChoreoCardThumbnail.svelte` |
| Deck releaser / print preview | Re-render only | `card-designer-context-menu-builder.ts` (stepCount never passed → no columns) |

A card never shows pictograph settings; the two card builders drift; the
"Card Settings…" entry in the builder is dead code (no caller passes
`onOpenSettings`); compose cells double-fire two menus (ChoreoCard fallback +
CompositionGrid cell menu, no suppression between them).

## Key facts discovered (ground truth)

- **Pictograph settings are global** (`VisibilityStateManager`) — no per-cell
  hit-testing is needed. Right-click anywhere on a card can offer the
  pictograph section.
- **Sequence-viewer ChoreoCard cells live-follow** the visibility manager
  (observer on `["glyph","non_radial","all"]` → cells re-render). Pictograph
  toggles on that surface are real.
- **Deck/print/catalog cards are deliberately frozen**
  (`CANONICAL_DECK_CARD_PROFILE` — "keep the two domains separate on
  purpose"). Pictograph toggles must NOT appear there (approved decision).
- **Browse thumbnails are static cached images** (`PropAwareThumbnail`) — they
  don't re-render on visibility changes. No pictograph section there either.
- The shared `ContextMenu.svelte` primitive (bits-ui) already supports
  headers, separators, submenus, checked states, `keepOpen`. No widget work.

## Design

### 1. Generic composition helper (widget layer)

`src/lib/shared/components/context-menu/compose-menu.ts`

```ts
export interface MenuSection {
  /** Optional section header rendered as ContextMenuHeader */
  header?: string;
  entries: ContextMenuEntry[];
}
/** Concatenate sections: skip empties, insert header + separator boundaries. */
export function composeMenu(sections: MenuSection[]): ContextMenuEntry[];
```

Rules: empty sections vanish; a header renders only when the section has
entries; separators go between sections, never leading/trailing; a section
whose entries already start with a separator is normalized. When only ONE
section survives, its header is still shown IF another surface shows the
composed pair — consistency beats cleverness — except: single-section menus
built from a lone card section (thumbnail, releaser) keep headers OFF to avoid
a pointless "Card" label over the whole menu. Concretely: headers render only
when ≥2 sections have entries.

### 2. Pictograph section (existing, reused)

`buildPictographContextMenuItems(deps)` is already section-shaped. It becomes
the pictograph section verbatim. `PictographContextMenuHost` behavior is
unchanged (workspace pictographs aren't inside a card — nothing additive).

### 3. One canonical card section (merge the two builders)

New: `src/lib/shared/choreo-card/services/card-menu-section.ts`

```ts
export interface CardMenuSectionDeps {
  stepCount?: number;                 // enables columns submenu (>=4)
  onColumnCountChange?: () => void;
  onRerender?: () => void;
  onSendTo?: () => void;
  onSendToStickerLab?: () => void;
  /** Admin image actions operate on this sequence when provided */
  sequenceForImageActions?: SequenceData;
  isAdmin?: boolean;
}
export function buildCardMenuSection(deps: CardMenuSectionDeps): ContextMenuEntry[];
```

Content order: columns submenu → Re-render → Send to… → Send to Sticker Lab →
(admin, when `isAdmin && sequenceForImageActions`) Save image / Copy image /
Copy for Claude. Internals lifted from the two existing builders unchanged.

Deleted: `choreo-card-context-menu.ts` (absorbed) and the deprecated
`CardDesignerContextMenuDeps` alias. `card-designer-context-menu-builder.ts`
is replaced by `card-menu-section.ts` (the dead `onOpenSettings` entry is
dropped — the three-tier feedback item will add its tier submenu to
`CardMenuSectionDeps` later; this deps object is the seam).

### 4. Surface wiring

| Surface | Menu after |
|---|---|
| `ChoreoCardContextMenuHost` (viewer shell + /sequence/[id]) | `composeMenu([pictograph, card])` — headers "Pictograph" / "Card". Host gains the visibility-manager observer (same bump pattern as `PictographContextMenuHost`). |
| Shared `ChoreoCard.svelte` internal fallback | `composeMenu([pictograph, card(admin-gated image trio + rerender)])`. Fuse, landing, video-lab, session viewer inherit automatically. |
| `ChoreoCardThumbnail` | Rebased: `composeMenu([card(sendTo, rerender, admin trio)])` + its collection/library entries appended as today. No pictograph section (static images). |
| `ChoreoCardTab` (releaser / print preview / inspect modal) | Card section only (frozen canonical profile). `PrintPreviewPages` already passes `sequence` through `onCardContextMenu` — thread `stepCount` so the releaser gains the columns submenu, plus Send to. |
| `CompositionGrid` cells (`CellCanvas` → ChoreoCard) | Double-fire fixed: `CellCanvas` passes a no-op `onContextMenu` so ChoreoCard renders no menu; the event bubbles to the cell menu as intended. |
| Workspace / option picker pictographs | Unchanged content; already the pictograph section. |
| Out of scope | Mandala fill menu, animation-canvas menu, compose cell menu content, write sheets (deliberately menu-less), collection folder tiles. |

### 5. Step Numbers caveat (known, accepted)

The pictograph section's "Step Numbers" toggle drives
`VisibilityStateManager.stepNumbers`, which viewer cards do NOT read (their
step-number overlay reads `ImageCompositionStateManager.addStepNumbers`).
On card surfaces the composed pictograph section therefore HIDES the Step
Numbers item (it would be a lying toggle) — the section builder gains
`includeStepNumbers?: boolean` (default true; card hosts pass false).
No-layout-shift / no-lying-controls discipline.

## Testing

- Unit: `compose-menu.test.ts` — empty-section skipping, header ≥2 rule,
  separator normalization.
- Unit: `card-menu-section.test.ts` — columns gating (stepCount <4 / >=4),
  admin gating, dep-driven entry presence; port existing builder tests.
- Existing consumers' tests updated where imports move.
- Manual: right-click viewer card (both sections), releaser card (card only,
  columns now present), workspace pictograph (unchanged), browse thumbnail
  (unchanged content), compose cell (single menu).

## Out of scope (explicit)

- Three-tier start-position layout settings (3IPLlE7L) — unblocked, not built.
- Any change to what deck/print cards render (canonical profile stays frozen).
- Long-press parity work beyond what surfaces already have.
