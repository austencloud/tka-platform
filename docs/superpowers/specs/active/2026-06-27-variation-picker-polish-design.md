---
status: active
value: 3
effort: S
remaining: "Body status: Approved (Austen, \"go nuts\")"
depends_on: ""
plan_path: ""
tags: []
last_triaged: 2026-07-25
---
# Variation Picker Polish — Design

Date: 2026-06-27
Status: Approved (Austen, "go nuts")
Feedback: HmSkI2QahxHyYVU8JTsj — "Audit and polish browse gallery variation picker"

## Scope

Audit pass on the two variation surfaces in Browse/Gallery, verified live on a
multi-variation word (AABB ×2) at `https://localhost:5173/browse/gallery`.

| Surface | Role |
|---|---|
| `VariationPill` | "1/2" pill on a grid card; taps cycle variations inline (crossfade) |
| `VariationPickerDrawer` | centered `BaseModal` grid of all variations; tap one → viewer |

The active-state-indicator idea from the original feedback was **dropped on
review**: the modal is a fresh chooser, not a selection surface. The pill happens
to land on a variation while cycling, but that variation is not "selected" — ring­ing
it would imply default/recommended, which is misleading. Inline position is already
shown by the pill before opening.

## Changes (verified against live BEFORE state)

### 1. Header subtitle — `VariationPickerDrawer.svelte`
BEFORE: header renders bare "Variations". The `t('browse_variations_title', {count, word})`
call passes args the en string has no placeholders for, so count/word are silently
dropped.
- Add `subtitle={t('browse_choose_variation')}` ("Choose a variation") — the key
  already exists (`messages/en.json:197`) and was orphaned by the drawer→modal port.
- Drop the dead `{count, word}` args from the title call and the now-unused `word`
  derived.

### 2. Remove redundant author label — `VariationPickerDrawer.svelte`
BEFORE: a `.picker-author` span under each card prints `variation.author ?? "Unknown"`.
For the AABB variations it printed "Unknown" while the card's own baked footer showed
"Austen Cloud / The Kinetic Alphabet / 2026" — redundant and contradictory.
- Remove the `.picker-author` span and its style. The composite card is
  self-describing (author / source / year baked into the image). No i18n key added —
  translating a wrong, redundant label is not the fix.

### 3. Card entrance stagger — `VariationPickerDrawer.svelte`
Reuse the existing BaseModal entrance system (`modal-tokens.css:223-232`): any
descendant with `data-animate="1..6"` gets `modalContentFadeUp` with
`--modal-stagger-base` delays, gated on `[data-entered="true"]`, and already killed
under `prefers-reduced-motion` (`modal-tokens.css:300-302`). Content remounts each
open (`BaseModal` uses `{#if shouldRender}`), so it refires every open.
- Add `data-animate={Math.min(i + 1, 6)}` to each `.picker-item` (cap at the defined
  range). No new keyframes.

### 4. Pill transition — `VariationPill.svelte`
BEFORE: `transition: all var(--duration-fast) ease` animates every property incl.
`backdrop-filter` / `background`.
- Narrow to `transform, background-color, border-color`. Behavior identical, no wasted
  compositing on the blur.

### 5. Pill overlap (#6) — verification only, NO change
Verified live: the pill sits bottom-center over the lower pictograph cells; the
glassmorphic background keeps it legible. It does **not** collide with the QR
(bottom-left) or the word (top-center). No fix warranted.

## Files
- `src/lib/features/browse/sequences/display/components/VariationPickerDrawer.svelte`
- `src/lib/shared/browse/components/ChoreoCardThumbnail/VariationPill.svelte`

No state, event-handler, grid, or `messages/*.json` changes — the active-state drop
and the author-removal eliminated all plumbing/i18n work from the original scope.

## Out of scope
Active-state indicator (dropped), modal→viewer flow, QR system, the card composite
itself, the inline pill's cycle behavior.

## Verification
BEFORE/AFTER screenshots of the modal and a pill card, plus `npm run check` green.
