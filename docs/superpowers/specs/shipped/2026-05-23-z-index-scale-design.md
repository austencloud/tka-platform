# Z-Index Scale Design

**Status:** Backlog
**Date:** 2026-05-23

## Problem

64 unique z-index values across `src/`, ranging from `-9999` to `2147483646` (one below MAX_INT32). 725 total z-index declarations. No centralized scale, no constants file, no coordination between layers.

### Symptoms

1. **Arms race values.** `9997`, `9998`, `9999`, `10000`, `10001` show developers incrementing past each other. `RailBentoSheet` uses `2147483645` and `2147483646` — nowhere left to go.

2. **Semantic collisions.** `z-index: 100` is used by 65 declarations across unrelated concerns: bottom navigation, popovers, fullscreen panels, drawers, map controls, timeline playheads, floating headers, and more. `z-index: 1000` appears in 42 declarations spanning modals, sheets, toasts, admin panels, and overlays.

3. **Partial systematization.** Three independent z-index subsystems exist but don't coordinate:
   - `DrawerStack.ts` — base `200`, increments by `10` per nested drawer
   - `ModalStack.ts` — base `1000`, increments by `10` per nested modal
   - `app.css` sheet variables — `--sheet-z-low: 150`, `--sheet-z-base: 1000`, `--sheet-z-overlay: 1100`, `--sheet-z-modal: 1200`
   - Retro module tokens — `--retro-z-desktop: 0` through `--retro-z-boot: 1000` (self-contained, no conflict)

4. **`!important` workarounds.** Six declarations use `z-index: N !important` to force stacking past other components: `OrientationExplainer` (`300`), `MyFeedbackDetail` (`109`, `110`), `SequenceActionsPanel` (`210`), `CreatePanelDrawer` (`150`, `49`).

5. **No constant for "above everything."** Components that need top-level stacking independently pick `9999`, `10000`, `99999`, `100000`, or MAX_INT32. Seventeen files use `9999`; eighteen use `10000`.

### Distribution by band

| Band | Range | Count | Examples |
|------|-------|-------|----------|
| Intra-component | -1 to 9 | ~340 | List items, overlays within a card, canvas layers |
| Local UI | 10-49 | ~100 | Toolbars, handles, badges, local popovers |
| Navigation | 50-199 | ~60 | Sidebar (150), bottom nav (100), sticky headers |
| Drawers | 200-299 | ~20 | DrawerStack base (200), word input overlay |
| Modals/Sheets | 1000-1200 | ~60 | ModalStack base (1000), sheets, confirm dialogs |
| Voice/Gamification | 2000-3000 | ~10 | VoiceControlIndicator (2000), AchievementToast |
| Nuclear | 9000-100000 | ~60 | Error toasts, confetti, command palette, debug overlay |
| MAX_INT32 | 2147483645-46 | 3 | RailBentoSheet |

## Design

### Layer scale

Eight named layers with 100-unit gaps. Each layer accommodates 99 sub-values for nested stacking (DrawerStack and ModalStack already use increment-by-10 within their bands).

```
Layer           Token                   Value   Purpose
-------         -----                   -----   -------
base            --z-base                0       Default content, intra-component ordering
sticky          --z-sticky              100     Sticky headers, bottom nav, floating controls
sidebar         --z-sidebar             200     Desktop navigation sidebar
dropdown        --z-dropdown            300     Popovers, dropdowns, context menus, search results
drawer          --z-drawer              400     Drawer base (DrawerStack manages sub-values)
overlay         --z-overlay             500     Full-screen overlays, tour backdrops, onboarding
modal           --z-modal               600     Modal base (ModalStack manages sub-values)
toast           --z-toast               700     Toast notifications, achievement toasts, XP toasts
tooltip         --z-tooltip             800     Tooltips, command palette, keyboard help
priority        --z-priority            900     Error modals, in-app-browser prompts, first-run wizard
debug           --z-debug               1000    Debug overlays, admin toolbars, dev-only UI
```

### Why this ordering

- **Drawers (400) below modals (600).** A modal opened from within a drawer must render above it. This matches the current `DrawerStack` (200) < `ModalStack` (1000) relationship.
- **Toasts (700) above modals (600).** Toast notifications must remain visible even when a modal is open — they're non-blocking feedback.
- **Tooltips (800) above toasts (700).** Tooltip content should never be clipped by a toast.
- **Priority (900) for genuinely urgent UI.** Error modals, browser-escape prompts, and first-run wizards. Nothing else.
- **Debug (1000) for dev-only.** Admin toolbars and debug overlays. Stripped in production builds.

### Constants file

**Path:** `src/lib/shared/ui/z-index.ts`

```ts
/**
 * Centralized z-index scale.
 *
 * Rules:
 * 1. Never use a raw z-index number in a component. Import from here.
 * 2. Intra-component ordering (1, 2, 3) is fine without this file —
 *    those are relative within a stacking context, not global.
 * 3. If you need a value between layers, you're in the wrong layer.
 * 4. DrawerStack and ModalStack use their own base + increment logic.
 *    Their base values come from this file.
 */

export const Z = {
  /** Default content. Intra-component stacking uses raw 0-9. */
  BASE: 0,

  /** Sticky headers, bottom navigation, floating action buttons. */
  STICKY: 100,

  /** Desktop navigation sidebar, side panels. */
  SIDEBAR: 200,

  /** Popovers, dropdowns, context menus, search result panels. */
  DROPDOWN: 300,

  /** Drawer base. DrawerStack adds 10 per nesting level. */
  DRAWER: 400,

  /** Full-screen overlays: tours, onboarding backdrops, loading curtains. */
  OVERLAY: 500,

  /** Modal base. ModalStack adds 10 per nesting level. */
  MODAL: 600,

  /** Toast notifications, achievement toasts, XP toasts. */
  TOAST: 700,

  /** Tooltips, command palette, keyboard shortcuts help. */
  TOOLTIP: 800,

  /** Urgent UI: error modals, in-app-browser escape, first-run wizard. */
  PRIORITY: 900,

  /** Dev-only: debug overlays, admin toolbars. Stripped in prod. */
  DEBUG: 1000,
} as const;

export type ZLayer = keyof typeof Z;
```

### CSS custom properties

Declared in `src/app.css` alongside existing design tokens:

```css
:root {
  /* Z-Index Scale */
  --z-base: 0;
  --z-sticky: 100;
  --z-sidebar: 200;
  --z-dropdown: 300;
  --z-drawer: 400;
  --z-overlay: 500;
  --z-modal: 600;
  --z-toast: 700;
  --z-tooltip: 800;
  --z-priority: 900;
  --z-debug: 1000;
}
```

Both the TS constants and CSS custom properties exist. Components in `.svelte` `<style>` blocks use the CSS variables. TypeScript code (DrawerStack, ModalStack, inline styles) uses the TS constants. They stay in sync because both are defined from the same scale — the CSS file is the source of truth for values, and the TS file mirrors them with a comment pointing to `app.css`.

### Integration with DrawerStack.ts

Current:
```ts
const BASE_Z_INDEX = 200;
const Z_INDEX_INCREMENT = 10;
```

After:
```ts
import { Z } from '$lib/shared/ui/z-index';

const BASE_Z_INDEX = Z.DRAWER; // 400
const Z_INDEX_INCREMENT = 10;
```

DrawerStack continues to manage its own sub-stacking. Max nesting of 9 drawers (400 + 9*10 = 490) stays below `OVERLAY` (500).

### Integration with ModalStack.ts

Current:
```ts
const BASE_Z_INDEX = 1000;
const Z_INDEX_INCREMENT = 10;
```

After:
```ts
import { Z } from '$lib/shared/ui/z-index';

const BASE_Z_INDEX = Z.MODAL; // 600
const Z_INDEX_INCREMENT = 10;
```

Max nesting of 9 modals (600 + 9*10 = 690) stays below `TOAST` (700).

### Replacing `--sheet-z-*` variables

The existing `--sheet-z-low`, `--sheet-z-base`, `--sheet-z-overlay`, `--sheet-z-modal` variables in `app.css` get replaced:

| Old variable | Old value | New mapping |
|---|---|---|
| `--sheet-z-low` | 150 | `var(--z-sticky)` (100) or `var(--z-sidebar)` (200) depending on usage |
| `--sheet-z-base` | 1000 | `var(--z-drawer)` (400) — most sheets are drawers |
| `--sheet-z-overlay` | 1100 | `var(--z-overlay)` (500) |
| `--sheet-z-modal` | 1200 | `var(--z-modal)` (600) |

`Drawer.css` references `--sheet-z-index` and `--sheet-z-base`. These get migrated to `--z-drawer` with the DrawerStack providing computed values.

### Retro module: no changes needed

The retro module (`src/lib/features/retro/win95/styles/retro-tokens.css`) already has its own token system (`--retro-z-*`) with values 0-1000. These are scoped to the retro lab's stacking context and don't conflict with the global scale. Leave them as-is.

### Intra-component stacking: no changes needed

Values 1-9 used for ordering elements within a single component (canvas layers, card front/back, progress bar segments) are local to that component's stacking context. These don't need the global scale and should stay as raw numbers with a comment explaining the local ordering.

### The RailBentoSheet problem

`RailBentoSheet.svelte` uses `2147483645` and `2147483646`. This is the bento export sheet that must render above absolutely everything. Under the new scale, this becomes `Z.PRIORITY` (900) with a `+1` for the content above the backdrop:

```css
.bento-portal { z-index: var(--z-priority); }       /* 900 */
.bento-backdrop { z-index: var(--z-priority); }      /* 900 */
.bento-sheet { z-index: calc(var(--z-priority) + 1); } /* 901 */
```

This works because nothing above `PRIORITY` except `DEBUG` should exist in production.

## Migration plan

### Phase 1: Foundation (non-breaking)

1. Create `src/lib/shared/ui/z-index.ts` with the `Z` constant object.
2. Add CSS custom properties to `src/app.css` under the existing design tokens section.
3. Update `DrawerStack.ts` and `ModalStack.ts` to import from `z-index.ts`.
4. Add ESLint rule (or a comment-based convention) documenting that raw z-index values >9 should use the scale.

**Verification:** `npm run check` passes. DrawerStack and ModalStack unit behavior unchanged.

### Phase 2: Nuclear values (highest-impact, ~20 files)

Replace `z-index: 9999`, `10000`, `99999`, `100000`, and `2147483646` with appropriate layer tokens. These are the most dangerous values — if any two collide, one element is invisible.

Target files (from grep):
- `ConfettiBurst.svelte`, `AchievementToast.svelte` -> `--z-toast`
- `ErrorToast.svelte`, `ErrorModal.svelte`, `ToastContainer.svelte` -> `--z-toast` / `--z-priority`
- `CommandPalette.svelte`, `ShortcutsHelp.svelte` -> `--z-tooltip`
- `FirstRunWizard.svelte`, `CreateTutorialWizard.svelte`, `TutorialPrompt.svelte` -> `--z-priority`
- `FullscreenPrompt.svelte`, `InAppBrowserPrompt.svelte`, `InAppBrowserModal.svelte` -> `--z-priority`
- `DebugPictographOverlay.svelte`, `AdminToolbarMobile.svelte`, `AdminToolbarDesktop.svelte` -> `--z-debug`
- `RailBentoSheet.svelte` -> `--z-priority`
- `MobileInputToolbar.svelte`, `SpellInputToolbar.svelte`, `BpmChips.svelte` -> `--z-tooltip`
- `WhatsNewModal.svelte`, `AnnouncementModal.svelte` -> `--z-modal`
- `AttributionPrompt.svelte`, `ContextMenu.svelte` -> `--z-dropdown` / `--z-overlay`
- `ModalUrlRestorer.svelte`, `MainInterface.svelte` -> `--z-priority`

**Verification:** Visual spot-check of toast, modal, command palette, and first-run wizard stacking. Open each layer type simultaneously and confirm ordering.

### Phase 3: Mid-range values (~60 files)

Replace `z-index: 100-999` with layer tokens. Primary targets:

- Navigation components (`z-index: 100`, `150`) -> `--z-sticky`, `--z-sidebar`
- Popovers and dropdowns (`z-index: 50`, `100`, `200`) -> `--z-dropdown`
- Sheet/drawer overrides -> `--z-drawer`
- Modal/dialog components (`z-index: 1000`, `1001`) -> `--z-modal`
- Voice/gamification (`z-index: 2000`, `2100`, `3000`) -> `--z-toast`

**Verification:** Navigation sidebar renders below drawers. Drawers render below modals. Popovers close when a drawer opens.

### Phase 4: Cleanup (~50 files)

- Remove `!important` declarations (all 6 become unnecessary once values are coordinated).
- Remove `--sheet-z-*` variables from `app.css` (replaced by `--z-*`).
- Update `Drawer.css` to use new variables.
- Replace `--sheet-z-index` custom property on `InviteCollaboratorsSheet` with `--z-modal`.

### Phase 5: Lint guard

Add a stylelint or custom lint rule that flags:
- Raw `z-index` values > 9 in any `.svelte` or `.css` file outside `retro-tokens.css`
- Any `z-index` value that doesn't use `var(--z-*)` or is not in the 0-9 intra-component range

This prevents regression. New components must use the scale.

## Risks

1. **Stacking context boundaries.** Z-index only competes within the same stacking context. Some components create new stacking contexts via `transform`, `opacity`, `filter`, or `will-change`. Migration must verify each component's actual stacking context, not just its z-index number. A `z-index: 9999` inside an `opacity: 0.99` wrapper might render below a `z-index: 100` at the root.

2. **DrawerStack/ModalStack base shift.** Changing DrawerStack from base 200 to 400 and ModalStack from 1000 to 600 means any component that hard-codes a z-index relative to the old values (e.g., "must be above drawer at 200, so I'll use 250") will need updating in the same pass.

3. **Third-party library z-index.** Leaflet maps, Threlte overlays, and any injected DOM (e.g., Google sign-in iframes) have their own z-index values that this scale can't control. Document known third-party z-index ranges and ensure the scale doesn't collide.

## Non-goals

- Refactoring components to use fewer stacking contexts. That's a separate concern.
- Changing the retro module's `--retro-z-*` tokens. They're self-contained.
- Eliminating intra-component z-index values (0-9). Those are correct as-is.
- Removing z-index from canvas layer stacking (video trails, effect layers). Those are within isolated stacking contexts and use sequential values (1, 2, 3, 4, 5).
