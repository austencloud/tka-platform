# Prop Unlock Reward System — Design

> **Status:** Design approved 2026-06-20. Next: implementation plan via `superpowers:writing-plans`.

## Goal

Reward engagement by letting users **unlock new props through play**. After a user
creates a milestone number of sequences, surprise them with *"Congratulations —
pick a new prop to add,"* a delightful pick screen, and a tunnel reveal that shows
the prop off. Props are granted as **delight, never gated as restriction** — the
everyday core props are always open, so this preserves "play with everything, pay
to take it home."

## Philosophy fit

- Core spinning props are **always selectable** from second one. No functional
  capability is ever locked.
- The unlock pool is **flavor/novelty/variant** props — visually distinct but not
  required to make any sequence. Locking these reads as a reward to earn, not a
  capability withheld.
- Everyone participates (guest + member). Guests keep their collection in
  localStorage with a soft "sign up to keep" nudge; members persist to Firestore
  and sync across devices; an anonymous guest who signs up carries their
  collection over.

---

## Grounding (verified in code)

- **No prop lock/entitlement/premium-prop concept exists today.** `access-tier.ts`
  gates module access + beat caps only; there is no per-prop gate anywhere. Clean
  slate. (There is also no existing Scribe cosmetic-prop perk to reconcile against
  — the play-unlock pool only needs to stay disjoint from any *future* one.)
- **Gamification is member-only.** `AchievementManager` and siblings return early
  when `auth.currentUser` is null and persist to Firestore + Dexie — no localStorage,
  no guest path (`achievement-manager.ts:65`). Therefore this feature owns its **own**
  guest-capable counter; it does **not** ride the achievement `sequence_count`
  counter.
- **PropType enum:** `src/lib/shared/pictograph/prop/domain/enums/prop-type.ts`.
- **Variant/base metadata:** `prop-type-display-registry.ts` (`VARIANT_PROP_TYPES`,
  `VARIANT_TO_BASE`, `BASE_TO_VARIANTS`, `PROP_PICKER_SECTIONS`,
  `PropTypeDisplayInfo.image`). Deactivated props (`GUITAR`, `UKULELE`,
  `FRACTALGENG`, `POI`, etc.) stay hidden — not used by this feature.
- **Picker UI:** `PropSelectionSheet.svelte` → `BentoPropGrid.svelte`; opened via
  `propDrawerState` and the `PropIndicatorButton`.
- **Sequence rotation:** `rotateSequence(sequence, rotationAmount, motionQueryHandler, targetHand?)`
  in `src/lib/shared/create/services/sequence-transforms.ts:164`. 45° steps —
  `2`=90°, `4`=180°, `6`=270°. Pure, runtime-cheap, returns new `SequenceData`.
- **Canvas multi-layer overlay:** `AdditionalLayerProps` (`{ blueProp, redProp }`)
  in `animation-engine/domain/types/trail-capture-types.ts:4`, passed as
  `additionalLayers` to `AnimatorCanvas`. Unlimited layers, lockstep. Pattern in
  `TunnelRenderer.svelte:136`.
- **Embeddable looping animator:** `AnimatorCanvas` with `fillContainer`,
  `hideHeader`, `hideProgressBar`, `bluePropType`/`redPropType` strings. Canonical
  small-box looping usage: `PovAnimatorPreview.svelte:98`.
- **No canned demo sequence ships, and MCP generation is not available at runtime.**
  The reveal uses **one shipped loopable `SequenceData` constant**, verified once
  via `isSeamlesslyLoopable()` (`compose/services/sequence-loopability-checker`).

---

## The prop pool

**Default-open (always unlocked, never stored):** the everyday core spinning props.
```
STAFF, CLUB, FAN, BUUGENG, TRIAD, MINIHOOP
```
Any sequence is fully makeable with these. No functional capability is ever gated.

**Unlockable pool (earned via play):** visually distinct + variant + big props, all
currently active.
```
SWORD, CHICKEN, DOUBLESTAR, QUIAD, TRIQUETRA, TRIQUETRA2,
TRIGENG, EIGHTRINGS, TORCH, DOUBLECONTACTBALL,
BIGSTAFF, BIGCLUB, BIGTRIAD, BIGHOOP, BIGBUUGENG,
BIGEIGHTRINGS, BIGTORCH, BIGCHICKEN, BIGDOUBLESTAR
```
~19 unlockables. Deactivated props are excluded (not re-enabled blind). Both lists
are tunable data tables, not hardcoded logic.

---

## Architecture

A dedicated service + a rune-state module, isolated from the member-only
gamification services. One responsibility: track creations, fire milestones, own
the unlocked set.

### `PropUnlockManager` (service)

`src/lib/shared/gamification/services/prop-unlock-manager.ts` (singleton via
`get-prop-unlock-manager.ts`, matching the sibling getter pattern).

Responsibilities:
- `recordCreation(source: "generate" | "construct"): void` — increment
  `creationCount`, evaluate milestone crossings, increment `pendingPicks` on each
  crossing (capped at remaining locked-pool size), persist.
- `claimPick(prop: PropType): void` — add `prop` to `unlockedPropTypes`, decrement
  `pendingPicks`, persist, fire success.
- `mergeGuestCollection(): Promise<void>` — on account upgrade, merge localStorage
  into Firestore (union / max / sum), then clear localStorage.
- Persistence read/write (guest localStorage vs member Firestore — see below).

### `prop-collection-state.svelte.ts` (rune state)

`src/lib/shared/gamification/state/prop-collection-state.svelte.ts`. Reactive view
the UI binds to:
- `unlockedPropTypes: Set<PropType>` (earned only)
- `creationCount: number`
- `pendingPicks: number`
- derived `isUnlocked(prop): boolean` = `prop ∈ CORE || unlockedPropTypes.has(prop)`
- derived `remainingLocked: PropType[]` = pool − unlocked

### Data shape (`PropCollection`)

```ts
interface PropCollection {
  unlockedPropTypes: PropType[]; // EARNED only; core-6 implicit, never stored
  creationCount: number;
  pendingPicks: number;
}
```

Effective selectable = `CORE ∪ unlockedPropTypes`.

### Milestone cadence

Triangular thresholds. Milestone *n* fires when `creationCount` reaches
`n(n+1)/2`:

| n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | … | 19 |
|---|---|---|---|---|---|---|---|---|---|----|
| creations | 1 | 3 | 6 | 10 | 15 | 21 | 28 | 36 | … | 190 |

- First unlock at creation **#1** — instant onboarding delight.
- Fast early hits, widening gaps — paces the ~19-prop pool over real engagement.
- Stops firing when the pool is exhausted (`pendingPicks` never exceeds remaining
  locked props). Collection-complete state shows in the picker.

`MILESTONE = (n) => (n * (n + 1)) / 2` — pure helper, unit-tested.

---

## Trigger (counting a "creation")

A single explicit call `propUnlockManager.recordCreation(source)` at two sites
(exact lines pinned in planning):
- **generate-completion** — literal to the request ("after they generate"); fires
  for guests who never save.
- **construct-completion** — so manual builders are included.

**Saving is NOT counted** (avoids double-count with generate; save is a different
gate). Works for guests and members alike — generation/construction run pre-auth.

---

## The pick + tunnel reveal (`PropUnlockCelebration.svelte`)

New component. A two-state celebration modal using `BaseModal class="chromeless"`
(reuses the backdrop-dismiss + card-guard pattern already in the codebase).

### State A — PICK
- Heading: *"You've earned a new prop. Pick one to add."*
- Grid of `remainingLocked` props as **static SVG tiles** (`PropTypeDisplayInfo.image`
  — no pictograph prep needed). Label under each.
- Hover/focus: tile scales + glows (cheap CSS, `prefers-reduced-motion` guarded).
  Staggered entry via the modal's existing `[data-animate]` system.
- Tap a tile → State B (selection not committed yet).

### State B — REVEAL (the tunnel)
- Heading: *"Meet your [PropLabel]."*
- A small square `AnimatorCanvas` box (the `PovAnimatorPreview` pattern:
  `fillContainer`, `hideHeader`, `hideProgressBar`) renders the **tunnel**:
  - Base = the one shipped canned loop.
  - Build `original + rotateSequence(·,2) + rotateSequence(·,4) + rotateSequence(·,6)`
    → 4 lockstep layers via `additionalLayers`, all rendering the **chosen prop**.
  - Result: a 4-fold undulating kaleidoscope tunnel of that prop.
  - v1 uses the prop's own single color across all 4 rotations (no per-layer tint).
- Confetti burst on entry.
- **Confirm** (*"Add to my props"*) → `claimPick(prop)`, success toast, modal closes.
- **Back** → returns to PICK (pick is not locked until Confirm).

### Layout stability
PICK grid and REVEAL box live in one fixed-size modal frame; State B swaps content
inside the reserved box so siblings never move (per `no-layout-shift.md`).

### Reduced motion / perf
- `prefers-reduced-motion` → tunnel steps down to 2-fold (180°) or original-only,
  no confetti, no tile animation.
- Perf is fine — tunnel mode already runs multi-layer live on a canvas.

### When it opens
- **Milestone #1 auto-opens** the celebration (onboarding delight).
- **Later milestones:** soft toast + redemption badge (Section: picker), opens on
  tap. Respects the flow of someone deep in creating.

---

## Picker integration

### Locked states in `BentoPropGrid`
- Read `isUnlocked(prop)` from `prop-collection-state`.
- Core + earned props: render normally, selectable.
- Locked pool props: dimmed + small lock glyph, not selectable. Tap → tiny inline
  tip *"Earn by creating"* (no purchase, no Scribe pitch). The full pool stays
  visible so users see what's coming.

### Redemption badge (deferred picks)
- When `pendingPicks > 0`: a dot/badge on the `PropIndicatorButton`.
- Opening the picker surfaces a *"Claim your new prop"* affordance → opens the same
  `PropUnlockCelebration` PICK modal. Nothing new built for redemption.

---

## Persistence

### Guest → localStorage
- Key `tka-prop-collection-v1`. Synchronous, no network, works pre-auth.

### Member → Firestore
- Single doc `users/{uid}/gamification/propCollection`. Firestore is source of
  truth, syncs across devices. Writes debounced; counter increment is cheap.
- **No Dexie cache** — the Firestore SDK's built-in offline persistence covers a
  19-item set. (Intentional simplification vs. the heavier sibling-service pattern.)
- Does **not** overload existing `propsISpinWith[]`/`favoriteProp`/`activeProp` —
  those are the IRL identity collection, a different concept. Isolated doc.

### Carryover on account upgrade (anon → full)
On link / sign-in success, `mergeGuestCollection()`:
- `unlockedPropTypes` = **union** (never lose a prop)
- `creationCount` = **max**(guest, member) (no double-count)
- `pendingPicks` = **sum** (every earned pick honored)
- write Firestore → clear localStorage. Member thereafter reads Firestore only.

Exact auth seam (link/sign-in success hook) pinned in planning.

### "Sign up to keep" nudge (guest only, not a gate)
- The celebration/confirm screen shows a guest-only footer line: *"Sign up to keep
  your collection."* → `authDrawerState.show("signup")` (reuses the auth drawer).
- After Confirm, if guest collection ≥ 2 props, a soft toast reinforces it.
- Members never see it.

---

## File map

**Create:**
- `src/lib/shared/gamification/services/prop-unlock-manager.ts`
- `src/lib/shared/gamification/get-prop-unlock-manager.ts`
- `src/lib/shared/gamification/state/prop-collection-state.svelte.ts`
- `src/lib/shared/gamification/domain/prop-pool.ts` — `CORE_PROPS`,
  `UNLOCKABLE_POOL`, `MILESTONE(n)` helper
- `src/lib/shared/gamification/domain/prop-collection.ts` — `PropCollection` type +
  pure milestone/merge helpers
- `src/lib/shared/gamification/components/PropUnlockCelebration.svelte`
- One shipped canned loop constant (e.g.
  `src/lib/shared/gamification/data/prop-demo-loop.ts`), verified loopable.

**Modify:**
- generate-completion call site → `recordCreation("generate")`
- construct-completion call site → `recordCreation("construct")`
- `BentoPropGrid.svelte` → locked states
- `PropIndicatorButton` (or its host) → redemption badge + claim affordance
- auth link/sign-in success seam → `mergeGuestCollection()`

---

## Testing

- **Pure helpers (unit):** `MILESTONE(n)` triangular values; milestone-crossing
  detection given old/new counts; merge logic (union/max/sum); `isUnlocked`;
  `remainingLocked`; pool-exhaustion cap on `pendingPicks`.
- **Persistence:** guest write/read round-trip (localStorage); member write/read
  (Firestore mock); merge on upgrade clears localStorage and unions correctly.
- **Loop integrity:** the canned demo sequence passes `isSeamlesslyLoopable()`.
- **Reveal:** `rotateSequence` produces the 4 layers; `additionalLayers` array has
  3 entries; reduced-motion path drops to 2-fold/none.
- **Runtime (DevTools):** guest generates → milestone #1 auto-opens → pick → tunnel
  reveal → prop selectable in grid; defer a later milestone → badge persists →
  claim from picker; guest→signup carries collection over; locked tiles
  non-selectable with tip.

---

## Out of scope (v1)

- Per-layer tunnel tinting (mono is fine).
- Re-enabling deactivated props as unlockables.
- Any Scribe/premium prop tier (none exists; stay disjoint if one is added later).
- Skins distinct from prop types (the pool is prop types only for v1).
- Dexie offline cache for the collection.
