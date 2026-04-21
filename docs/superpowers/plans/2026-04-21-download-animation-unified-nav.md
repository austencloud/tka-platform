# Download Animation — Unified 5-Pill Nav Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-tile mobile bento + flat desktop sidebar in `ExportVideoDrawer` with a unified 5-pill nav (Effects / Effort / Playback / Display / Export) that works identically on both viewports. Restore visibility of the Display toggles and Path Shape (orphaned when AnimationSettingsModal was nuked earlier in this branch).

**Spec:** `docs/superpowers/specs/2026-04-21-download-animation-unified-nav-design.md`

**Architecture:** Two new components (`DownloadPillNav` + `PillBody`) + one pure helper (`computeDisplaySummary`) + one CSS file, plus targeted hardening of three shared primitives (`rail-tile.css`, `RailBentoSheet.svelte`, focus management). ExportVideoDrawer's mobile and desktop branches collapse to a single shared template with one variant prop. Reuses 9 existing components (EffectsPanel, MobileEffectsPanel, EffortPanel, DisplayPanel, PathShapePanel, PlaybackModeToggle, TempoControl, RailBentoSheet, rail-tile.css).

**Tech Stack:** Svelte 5 (runes), TypeScript, vitest for the pure helpers, Chrome DevTools MCP for visual QA.

---

## ⚠️ Audit corrections — read this before executing

This plan has been audited twice. The corrections below override anything later in the doc that conflicts. Where the spec body and this plan disagree, this plan wins.

### Round 1 (design correctness)
1. Effects pill summary shows the active effect's NAME (`"Trails"`, `"Fire"`, `"Off"`), NEVER a count. The default `tipEffectMap` has one wildcard entry, so a count was meaningless.
2. All 3 fps options (30 / 60 / 120) and all 4 resolutions (720p / 1080p / 4K / 8K) are preserved on desktop. No regression.
3. Loops + Timing live in **Export** (they describe the output video file). Playback pill = Tempo + Mode only (in-canvas preview behavior).
4. Desktop Effects pill keeps the inline play/pause + tempo via `EffectsPanel`'s `showPlayback={!!(onPlaybackToggle && onBpmChange)}` branch.
5. Path shape (Arc/Linear) surfaces explicitly in the Display summary as `"<n> / 7 visible · <path>"`. Both arc and linear are valid, not on/off — they're not counted.
6. `PILL_ORDER` is type-enforced via `buildPillSpecs(Record<PillId, ...>)` — adding a pill without a spec is a compile error. No runtime DEV drift guard.
7. Orphan `PlaybackPanel.svelte` is deleted in pre-flight (no consumer).

### Round 2 (architecture, ARIA, contrast, touch targets)

8. **CRITICAL:** `.rt-section`, `.rt-section-label`, `.rt-chip-row`, `.rt-chip`, `.rt-row`, `.rt-row-label` exist ONLY inside `:global(.bento-sheet-body ...)` in `RailBentoSheet.svelte`. They DO NOT apply inside the desktop inline pill body — without the fix, the desktop Playback / Display / Export bodies render as unstyled `<button>` + `<div>` elements. Pre-flight Task 0e promotes these selectors into `rail-tile.css` so they apply in both contexts.
9. **CRITICAL:** Touch targets in shared primitives violate AAA: `.rt-step-btn` is 24×24, `.bento-sheet-close` is 28×28, `.rt-chip` is 38px tall. Pre-flight Task 0f bumps them to 44×44 (AAA).
10. **CRITICAL:** `RailBentoSheet` declares `aria-modal="true"` but does not trap focus, has no focus-visible style on its close button, and does not respect `prefers-reduced-motion` on its `fly`/`fade` transitions. Pre-flight Task 0g hardens it.
11. **CRITICAL:** `activePillId` cannot be a one-shot `$state(layout === ...)` initializer — that fires once. If `layout` flips between `"bottom"` and `"sidebar"` without a remount, desktop loses its always-on default. The script uses a `$effect` to keep them in sync (Task 6).
12. **HIGH:** Pills use `role="button"` + `aria-pressed` only (no `role="tab"` / `aria-selected`). The tabs ARIA pattern requires the panel to be a permanent DOM sibling linked via `aria-controls`; pill bodies are conditionally mounted (one at a time on desktop, in a portal'd dialog on mobile). Mobile pills also carry `aria-haspopup="dialog"`. PillBody desktop variant uses `role="region"` + `aria-live="polite"` (not `tabpanel`).
13. **HIGH:** Focus is restored to the activating pill button when the mobile sheet closes. ExportVideoDrawer keeps a `Map<PillId, HTMLButtonElement>` populated by DownloadPillNav and refocuses on close.
14. **HIGH:** Tasks 6 and 7 are merged into one atomic task ("rewrite script + template together"). The previous split left the working tree non-building between commits.
15. **HIGH:** Pill typography meets the project's 12px floor. `.pill-label` and `.pill-summary` use `var(--font-size-compact, 12px)`. Active-state foreground is solid white, not a color-mix that drifts below 7:1 contrast. Focus outlines use the opaque accent color (no 0.6 alpha).
16. **HIGH:** Display pill body wraps `DisplayPanel` and `PathShapePanel` in `role="group"` regions with explicit "Visibility" and "Motion paths" section labels (linked via `aria-labelledby`).
17. **HIGH:** DownloadPillNav implements WAI-ARIA toolbar keyboard pattern: ←/→ wrap focus, `Home`/`End` jump to first/last, `Enter` and `Space` activate. The legacy `"Spacebar"` key name is dropped.
18. **MEDIUM:** `computeDisplaySummary` signature takes a single record of all toggles (including grid) so the denominator is genuinely arity-derived, not hardcoded `+1`.
19. **MEDIUM:** `preventSpaceActivation` only fires when the event target is a non-interactive element — it does not swallow space on focused buttons / inputs / sliders inside the panel.
20. **MEDIUM:** Task 8 verification drops the "viewer URL grep" theatre (asks the user for a URL) and the "CSS brace-balance" theatre (relies on `npm run build` instead).

---

## Verification strategy

1. **Type check** — `npm run check 2>&1 | grep -E "ExportVideoDrawer|pill-nav"` must show zero errors for the touched files at every checkpoint.
2. **Build** — `npm run build` must succeed at the final task.
3. **Unit test** — `npx vitest run tests/unit/pill-nav/` for the one pure helper.
4. **Visual** — Chrome DevTools MCP at 393×709 (mobile) and 1400×900 (desktop) at the end. Ask the user before any interactive browser commands per project rules.

The user's dev server runs on port 5173. Never start it; use `curl localhost:5173/...` or `npm run build` for verification. If a dev server is needed, use `vite --port 5174`.

---

## Pre-flight verification

- [ ] **Step 0a: Confirm settings-panels exist with Panel suffix**

```bash
ls src/lib/shared/animation-engine/components/settings-panels/
```

Expected output (8 files):
```
CharcoalPanel.svelte
DisplayPanel.svelte
EffortPanel.svelte
FirePanel.svelte
LedPanel.svelte
PathShapePanel.svelte
PlaybackPanel.svelte
TrailsPanel.svelte
```

If any are missing, abort the plan — the cleanup commit that produced them must have been reverted.

- [ ] **Step 0a-bis: Delete orphan `PlaybackPanel.svelte`**

```bash
grep -rn "PlaybackPanel" src/ 2>/dev/null
```

Expected: no matches. The cleanup commit landed `settings-panels/PlaybackPanel.svelte` but nothing imports it (the Playback pill body inlines `TempoControl` + `PlaybackModeToggle` instead). Remove the orphan now to avoid dead code drift:

```bash
git rm src/lib/shared/animation-engine/components/settings-panels/PlaybackPanel.svelte
git commit -m "$(cat <<'EOF'
chore(settings-panels): remove orphan PlaybackPanel.svelte

No imports anywhere; the Playback pill body uses inline TempoControl +
PlaybackModeToggle. Removing before the pill-nav rewrite to avoid
shipping a stranded panel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If `grep` returns matches: stop. Re-investigate before deleting.

- [ ] **Step 0b: Confirm AnimationSettingsModal is gone**

```bash
ls src/lib/shared/animation-engine/components/animation-settings-modal/ 2>&1
```

Expected: `No such file or directory`. If the directory exists, abort the plan.

- [ ] **Step 0c: Confirm Bento primitives exist**

```bash
ls src/lib/shared/sequence-viewer/components/bento/
```

Expected output (at least):
```
RailBentoSheet.svelte
rail-tile.css
```

- [ ] **Step 0d: Confirm ExportVideoDrawer's current shape**

```bash
grep -nE "type SheetId|EffortPanel|MobileEffectsPanel|RailBentoSheet" \
  src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte | head
```

Expected: imports for `EffortPanel`, `MobileEffectsPanel`, `RailBentoSheet`; the line `type SheetId = "effects" | "effort" | "playback" | "export"` (this is what we're replacing).

If any line is missing, the file was edited since the spec was written — re-read it before continuing.

---

## Task 0e: Promote shared `.rt-*` selectors into rail-tile.css (CRITICAL)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/bento/rail-tile.css`
- Modify: `src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte`

**Why:** `.rt-section`, `.rt-section-label`, `.rt-chip-row`, `.rt-chip`, `.rt-row`, `.rt-row-label` are currently defined as `:global(.bento-sheet-body .rt-*)` inside `RailBentoSheet.svelte`'s scoped style block. The desktop pill body renders these classes inside `.pill-body-inline` (NOT inside `.bento-sheet-body`), so without this promotion the desktop Playback / Display / Export bodies render as unstyled `<button>` + `<div>` elements. Promote them to `rail-tile.css` so they apply equally in both contexts.

- [ ] **Step 1: Read both files**

```bash
cat src/lib/shared/sequence-viewer/components/bento/rail-tile.css | wc -l
```

Read the full RailBentoSheet style block (lines 90–249) and the full rail-tile.css.

- [ ] **Step 2: Append the promoted rules to `rail-tile.css`**

Append the following block at the end of `rail-tile.css` (before any final newline):

```css

/* ==========================================================================
   Sheet/panel body primitives — sections, chips, rows.
   Originally defined as :global(.bento-sheet-body .rt-*) inside
   RailBentoSheet.svelte. Promoted here so the same primitives apply inside
   the desktop inline pill body (.pill-body-inline) without requiring the
   .bento-sheet-body ancestor.
   ========================================================================== */

.rt-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rt-section-label {
  font-size: var(--font-size-compact, 12px);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.65);
}

.rt-chip-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.rt-chip {
  flex: 1;
  min-height: var(--min-touch-target, 44px);
  min-width: 44px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  font-size: var(--font-size-compact, 12px);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: all 150ms ease;
}

.rt-chip:hover:not([aria-pressed="true"]) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.95);
}

.rt-chip[aria-pressed="true"] {
  background: color-mix(in srgb, #4a9eff 22%, rgba(20, 22, 32, 0.6));
  border-color: color-mix(in srgb, #4a9eff 55%, transparent);
  color: #ffffff;
}

.rt-chip:focus-visible {
  outline: 2px solid #4a9eff;
  outline-offset: 2px;
}

.rt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 8px 12px;
  min-height: var(--min-touch-target, 44px);
}

.rt-row-label {
  font-size: var(--font-size-compact, 12px);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

@media (prefers-reduced-motion: reduce) {
  .rt-chip {
    transition: none;
  }
}
```

- [ ] **Step 3: Delete the now-redundant `:global(.bento-sheet-body .rt-*)` rules from `RailBentoSheet.svelte`**

Open `RailBentoSheet.svelte`. Find the block (currently lines 176–248) starting with `/* Common inner primitives used by sheet bodies */`. Delete every `:global(.bento-sheet-body .rt-section)` / `.rt-section-label` / `.rt-chip-row` / `.rt-chip` / `.rt-chip[aria-pressed="true"]` / `.rt-row` / `.rt-row-label` rule. Keep the `@media (prefers-reduced-motion: reduce)` block but remove the `:global(.bento-sheet-body .rt-chip)` line from it (just `.bento-sheet-close` remains). The promoted rules in `rail-tile.css` cover both contexts now.

The remaining style block in RailBentoSheet should only contain `.bento-portal`, `.bento-backdrop`, `.bento-sheet`, `.bento-sheet-head`, `.bento-sheet-title`, `.bento-sheet-close`, `.bento-sheet-body`, and the reduced-motion media query.

- [ ] **Step 4: Type check + build**

```bash
npm run check 2>&1 | grep -A 1 "RailBentoSheet\|rail-tile" | head -20
npm run build 2>&1 | tail -5
```

Expected: zero errors in either file. Build succeeds. Visual regression in any other consumer of `RailBentoSheet` is acceptable — the styles are now globally available, not narrowed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/bento/rail-tile.css \
        src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte
git commit -m "$(cat <<'EOF'
refactor(rail-tile): promote .rt-section/.rt-chip/.rt-row from sheet-scoped to global

The .rt-* primitives were :global(.bento-sheet-body .rt-*) inside
RailBentoSheet.svelte, so they only applied inside the bento sheet.
The new pill-nav design renders them inside .pill-body-inline on desktop,
which is NOT a .bento-sheet-body descendant. Promoting these rules to
rail-tile.css makes them apply in both contexts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 0f: Bump touch targets in shared primitives to AAA (CRITICAL)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/bento/rail-tile.css`
- Modify: `src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte`

**Why:** `.rt-step-btn` is `width: 24px; height: 24px` and `.bento-sheet-close` is `28×28`. Both fail AA (44×44) and AAA (48×48) touch-target standards. The Loops stepper and the sheet's close button are touch-only on mobile. Bump them to AAA.

- [ ] **Step 1: Edit `.rt-step-btn` in `rail-tile.css`**

Find the `.rt-step-btn` block (currently lines 133–147). Replace `width: 24px; height: 24px;` with `min-width: var(--min-touch-target, 44px); min-height: var(--min-touch-target, 44px);`. Bump `border-radius` to `10px` to match the larger tap area. Optionally raise `font-size` to `15px` for the `+`/`−` glyphs.

- [ ] **Step 2: Edit `.bento-sheet-close` in `RailBentoSheet.svelte`**

Find the `.bento-sheet-close` block (currently lines 145–165). Replace `width: 28px; height: 28px;` with `min-width: var(--min-touch-target, 44px); min-height: var(--min-touch-target, 44px);`. Replace `font-size: 11px` with `font-size: 14px` so the `×` glyph is readable in the larger button.

- [ ] **Step 3: Add focus-visible style to `.bento-sheet-close`**

Append inside the same style block:

```css
.bento-sheet-close:focus-visible {
  outline: 2px solid #4a9eff;
  outline-offset: 2px;
}
```

- [ ] **Step 4: Build + verify visually**

```bash
npm run build 2>&1 | tail -5
```

The Loops stepper buttons in any existing consumer (RightRail, RenderModeToggle, etc.) will become noticeably bigger. That is the intended fix — they were too small for mobile use.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/bento/rail-tile.css \
        src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte
git commit -m "$(cat <<'EOF'
fix(rail-tile, bento-sheet): bump touch targets to AAA 44px

.rt-step-btn was 24x24, .bento-sheet-close was 28x28 — both fail AA
(44x44) and AAA (48x48). Mobile is the only way to interact with these
controls, so the small targets were a real usability bug. Also adds a
focus-visible outline to the sheet close button.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 0g: Add focus trap, focus restoration, and reduced-motion to RailBentoSheet (CRITICAL)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte`

**Why:** The sheet declares `aria-modal="true"` but does not trap focus — Tab cycles into the underlying page. The `fly`/`fade` Svelte transitions ignore `prefers-reduced-motion`. And the calling code (ExportVideoDrawer) needs the sheet to return focus to the activating element on close.

- [ ] **Step 1: Add focus management + reduced-motion to the script block**

Replace the entire `<script lang="ts">` block in `RailBentoSheet.svelte` with:

```svelte
<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { Snippet } from "svelte";
  import { onMount, tick } from "svelte";

  interface Props {
    title: string;
    onClose: () => void;
    /** Optional: element to restore focus to when the sheet closes. */
    returnFocusTo?: HTMLElement | null;
    children: Snippet;
  }

  let { title, onClose, returnFocusTo = null, children }: Props = $props();

  let sheetEl: HTMLDivElement | undefined;

  // Honor prefers-reduced-motion for the entrance / exit transitions.
  let reduceMotion = $state(false);
  onMount(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion = mq.matches;
    const handler = (e: MediaQueryListEvent) => { reduceMotion = e.matches; };
    mq.addEventListener("change", handler);

    // Move initial focus into the sheet so the keyboard user lands inside it.
    void tick().then(() => {
      const first = sheetEl?.querySelector<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      first?.focus();
    });

    return () => {
      mq.removeEventListener("change", handler);
      // Restore focus to the activating element on unmount.
      if (returnFocusTo && typeof returnFocusTo.focus === "function") {
        returnFocusTo.focus();
      }
    };
  });

  function getFocusables(): HTMLElement[] {
    if (!sheetEl) return [];
    return Array.from(
      sheetEl.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      )
    ).filter((el) => el.offsetParent !== null);
  }

  function onBackdropClick() {
    onClose();
  }

  function onSheetKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;

    // Focus trap: keep Tab focus inside the sheet.
    const focusables = getFocusables();
    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || !sheetEl?.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !sheetEl?.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() { node.remove(); },
    };
  }
</script>
```

- [ ] **Step 2: Wire the new `bind:this` and the reduced-motion durations into the template**

Find the `<div class="bento-sheet" ...>` element. Add `bind:this={sheetEl}` and replace its `transition:fly={...}` with:

```svelte
transition:fly={{ y: reduceMotion ? 0 : 80, duration: reduceMotion ? 0 : 240, easing: cubicOut }}
```

Find the `<button class="bento-backdrop" ...>` and replace its `transition:fade={...}` with:

```svelte
transition:fade={{ duration: reduceMotion ? 0 : 180 }}
```

- [ ] **Step 3: Type check + build**

```bash
npm run check 2>&1 | grep "RailBentoSheet" | head
npm run build 2>&1 | tail -5
```

Expected: zero errors. Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/bento/RailBentoSheet.svelte
git commit -m "$(cat <<'EOF'
fix(bento-sheet): focus trap, focus restoration, and reduced-motion

aria-modal="true" promised behavior the sheet wasn't delivering: focus
escaped to the page beneath it, and Svelte's built-in fly/fade ignored
prefers-reduced-motion. Also accepts an optional returnFocusTo element
so callers can restore focus to the activating control on close.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 0h: Fix focus-indicator contrast in EffortPanel + PathShapePanel (HIGH)

**Files:**
- Modify: `src/lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte`
- Modify: `src/lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte`

**Why:** Both components use `outline: 2px solid color-mix(in srgb, var(--<color>) 50%, transparent)` for `:focus-visible`. The 50%-transparent outline composites against a near-black chip background at ~2.68:1, below the WCAG 2.4.11 AA minimum of 3:1 for non-text contrast. With darker effort/path colors the ratio drops further.

- [ ] **Step 1: Replace 50%-transparent outline with opaque colors**

In each file, find the `:focus-visible` rule that uses `color-mix(...50%, transparent)` and replace with `outline: 2px solid var(--effort-color, #94a3b8); outline-offset: 2px;` for EffortPanel and `outline: 2px solid var(--path-color, #60a5fa); outline-offset: 2px;` for PathShapePanel.

- [ ] **Step 2: Build**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte \
        src/lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte
git commit -m "$(cat <<'EOF'
fix(settings-panels): opaque focus outlines for AA contrast

50%-transparent focus outlines composited to ~2.68:1 against the chip
background, below the WCAG 2.4.11 AA minimum of 3:1. Use the opaque
accent color directly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 1: Create pill-nav directory + pill-types.ts

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/pill-types.ts`

- [ ] **Step 1: Write the type module**

Write `src/lib/shared/sequence-viewer/components/pill-nav/pill-types.ts`:

```ts
/**
 * Pill-nav contract for ExportVideoDrawer.
 *
 * PILL_ORDER is the single source of truth for which pills exist and
 * the order they render. PillId is derived from it so the two cannot
 * drift — adding a pill in only one place is a compile error.
 */

export const PILL_ORDER = [
  "effects",
  "effort",
  "playback",
  "display",
  "export",
] as const;

export type PillId = (typeof PILL_ORDER)[number];

export interface PillSpec {
  id: PillId;
  /** Uppercase short label (≤8 chars), e.g. "EFFECTS". */
  label: string;
  /** FontAwesome class, e.g. "fa-sparkles". Optional — Effort uses a color dot instead. */
  icon?: string;
  /** Live one-line summary of the section's current state, ≤24 chars (truncated with ellipsis if longer). */
  summary: string;
  /** Optional accent color override. Effort sets this to its color so the active glow matches. */
  accentColor?: string;
}

/**
 * Build the ordered PillSpec array from a PillId-keyed record.
 * Using a Record forces every PillId to be supplied at compile time, so
 * adding a new id to PILL_ORDER fails the type check until a spec is
 * provided. No runtime drift guard needed.
 */
export function buildPillSpecs(
  specs: Record<PillId, Omit<PillSpec, "id">>,
): PillSpec[] {
  return PILL_ORDER.map((id) => ({ id, ...specs[id] }));
}
```

- [ ] **Step 2: Type check**

```bash
npm run check 2>&1 | grep -E "pill-types|pill-nav" | head
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/pill-types.ts
git commit -m "$(cat <<'EOF'
feat(pill-nav): add PillId / PillSpec types for download nav

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add the pure summary helper + unit test

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/pill-summaries.ts`
- Create: `tests/unit/pill-nav/pill-summaries.test.ts`

The Display summary counts visibility flags — 7 things with clear on/off semantics: the 6 toggles exposed in `DisplayPanel` plus grid visibility. Path shape is a binary choice between two valid options (arc vs linear), not on/off, so it is shown explicitly in the summary rather than counted.

The denominator is derived from `Object.values(flags).length`, not hardcoded. Adding a future toggle requires only one change: add the field to the `DisplayFlags` interface. The `+ 1` for grid that the previous draft hardcoded is gone — grid is now a regular field in the same record.

- [ ] **Step 1: Write the failing test**

Write `tests/unit/pill-nav/pill-summaries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeDisplaySummary, type DisplayFlags } from "$lib/shared/sequence-viewer/components/pill-nav/pill-summaries";

const allOff: DisplayFlags = {
  tkaGlyph: false,
  stepNumbers: false,
  beatPosition: false,
  props: false,
  wordHeader: false,
  progressBar: false,
  grid: false,
};

const allOn: DisplayFlags = {
  tkaGlyph: true,
  stepNumbers: true,
  beatPosition: true,
  props: true,
  wordHeader: true,
  progressBar: true,
  grid: true,
};

describe("computeDisplaySummary", () => {
  it("reports 0 / 7 visible · arc when everything is off and path is arc", () => {
    expect(computeDisplaySummary(allOff, "arc")).toBe("0 / 7 visible · arc");
  });

  it("reports 7 / 7 visible · arc when every flag including grid is on", () => {
    expect(computeDisplaySummary(allOn, "arc")).toBe("7 / 7 visible · arc");
  });

  it("counts grid as a regular flag", () => {
    expect(computeDisplaySummary({ ...allOff, grid: true }, "arc")).toBe("1 / 7 visible · arc");
  });

  it("reports linear path explicitly without affecting the count", () => {
    expect(computeDisplaySummary(allOff, "linear")).toBe("0 / 7 visible · linear");
    expect(computeDisplaySummary(allOn, "linear")).toBe("7 / 7 visible · linear");
  });

  it("counts each visibility flag independently", () => {
    expect(
      computeDisplaySummary({ ...allOff, tkaGlyph: true, props: true }, "arc")
    ).toBe("2 / 7 visible · arc");
  });

  it("denominator follows DisplayFlags arity (regression guard)", () => {
    // If someone adds a field to DisplayFlags without updating allOff, this
    // test will fail because Object.values(...).length will jump to 8.
    expect(Object.keys(allOff).length).toBe(7);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
npx vitest run tests/unit/pill-nav/pill-summaries.test.ts 2>&1 | tail -15
```

Expected: FAIL — "Cannot find module '$lib/.../pill-summaries'".

- [ ] **Step 3: Write the implementation**

Write `src/lib/shared/sequence-viewer/components/pill-nav/pill-summaries.ts`:

```ts
/**
 * Pure helpers that turn AnimationVisibilityStateManager state into the
 * one-line summaries shown beneath each pill label.
 *
 * Only the Display summary has real logic worth testing — Effects, Effort,
 * Playback, and Export summaries are trivial template strings derived
 * inline in ExportVideoDrawer.
 */

/**
 * Single record of every boolean visibility flag the Display pill exposes.
 * Grid is included as a regular field so the denominator is genuinely
 * arity-derived from this record — no hardcoded `+1`.
 */
export interface DisplayFlags {
  tkaGlyph: boolean;
  stepNumbers: boolean;
  beatPosition: boolean;
  props: boolean;
  wordHeader: boolean;
  progressBar: boolean;
  grid: boolean;
}

export type PathShape = "arc" | "linear";

/**
 * Returns "<n> / <total> visible · <pathShape>".
 *
 * Path shape is a binary choice between two valid options (arc vs linear),
 * not on/off, so it is surfaced explicitly rather than counted.
 *
 * The denominator is derived from the input arity — adding a new field to
 * DisplayFlags automatically updates the "/ N" denominator.
 */
export function computeDisplaySummary(
  flags: DisplayFlags,
  pathShape: PathShape,
): string {
  const values = Object.values(flags);
  const on = values.filter(Boolean).length;
  const total = values.length;
  return `${on} / ${total} visible · ${pathShape}`;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

```bash
npx vitest run tests/unit/pill-nav/pill-summaries.test.ts 2>&1 | tail -15
```

Expected: 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/pill-summaries.ts \
        tests/unit/pill-nav/pill-summaries.test.ts
git commit -m "$(cat <<'EOF'
feat(pill-nav): add Display summary helper + unit tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add pill-nav.css

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/pill-nav.css`

The pill-specific styles extend `rail-tile.css`. Pills inherit hover, active, focus, and `prefers-reduced-motion` from the rail-tile cascade — `pill-nav.css` only adds layout (flex row, sizing) and the label/summary typography.

- [ ] **Step 1: Write the CSS file**

Write `src/lib/shared/sequence-viewer/components/pill-nav/pill-nav.css`:

```css
/* ==========================================================================
   pill-nav.css — extends rail-tile.css with the pill row layout
   Used by DownloadPillNav.svelte for both mobile and desktop variants.
   Typography: respects the project 12px floor (--font-size-compact).
   Contrast: meets WCAG AAA (7:1 body, 3:1 non-text) for the default
   blue accent and remains AA-or-better for any effort color.
   ========================================================================== */

.pill-nav {
  display: flex;
  gap: 6px;
  padding: 6px;
  background: rgba(20, 22, 32, 0.6);
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.pill-nav.variant-mobile {
  padding: 4px;
  gap: 4px;
}

.pill {
  flex: 1;
  min-width: 0;
  min-height: var(--min-touch-target, 48px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(20, 22, 32, 0.78);
  backdrop-filter: blur(20px) saturate(140%);
  -webkit-backdrop-filter: blur(20px) saturate(140%);
  border-radius: 10px;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-family: inherit;
  transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  -webkit-tap-highlight-color: transparent;
}

.pill-nav.variant-mobile .pill {
  min-height: 60px;
  padding: 10px 6px;
}

.pill:hover:not([aria-pressed="true"]) {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(28, 32, 44, 0.9);
  color: white;
}

/* Opaque focus outline. Default falls back to the brand blue at full alpha
   so the indicator never composites below 3:1 against any pill background. */
.pill:focus-visible {
  outline: 2px solid var(--pill-focus, #4a9eff);
  outline-offset: 2px;
}

.pill[aria-pressed="true"] {
  background: color-mix(in srgb, var(--pill-accent, #4a9eff) 22%, rgba(20, 22, 32, 0.85));
  border-color: color-mix(in srgb, var(--pill-accent, #4a9eff) 60%, transparent);
  color: white;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--pill-accent, #4a9eff) 30%, transparent);
}

.pill-icon-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.pill-icon-row .effort-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pill-accent, currentColor);
  box-shadow: 0 0 6px var(--pill-accent, currentColor);
  flex-shrink: 0;
}

.pill-label {
  font-size: var(--font-size-compact, 12px);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  line-height: 1;
}

.pill[aria-pressed="true"] .pill-label {
  color: white;
}

.pill-summary {
  font-size: var(--font-size-compact, 12px);
  font-weight: 600;
  color: rgba(255, 255, 255, 0.92);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  line-height: 1.2;
}

.pill[aria-pressed="true"] .pill-summary {
  color: white;
}

/* "—" placeholder when a pill has no current value. Use a single explicit
   color rather than stacking opacity on the parent (which would land at
   3.6:1 — below AA). */
.pill-summary.empty {
  color: rgba(255, 255, 255, 0.55);
}

@media (prefers-reduced-motion: reduce) {
  .pill {
    transition: none;
  }
}
```

- [ ] **Step 2: No standalone CSS check needed**

The CSS is consumed by `vite build` in Task 6/7. If anything is malformed the build fails with a real CSS parse error. Skipping the brace-balance heuristic — it can pass when CSS is invalid (missing colons, unclosed strings, etc.).

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/pill-nav.css
git commit -m "$(cat <<'EOF'
feat(pill-nav): add pill-nav.css extending rail-tile primitive

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: DownloadPillNav.svelte

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/DownloadPillNav.svelte`

- [ ] **Step 1: Write the component**

Write `src/lib/shared/sequence-viewer/components/pill-nav/DownloadPillNav.svelte`:

```svelte
<!--
  DownloadPillNav.svelte

  Horizontal row of 5 pills (Effects / Effort / Playback / Display / Export)
  shown above the download button on mobile and at the top of the sidebar
  on desktop. Pure presentational — all state is owned by the parent.

  ARIA semantics: button + aria-pressed (NOT tab + aria-selected). The
  ARIA tabs pattern requires the panel to be a permanent DOM sibling
  linked via aria-controls. Pill bodies are conditionally mounted (one at
  a time on desktop) and on mobile they live inside a portal'd
  role="dialog" — neither is a tabpanel. On mobile the pill button also
  carries aria-haspopup="dialog" so screen readers announce the popup
  intent.

  Focus management: the parent gets the `navEl` reference via the
  `onMount` callback (passed in `Props.onMount`) and can call
  `findPillButton(id)` to restore focus to a specific pill when needed.
-->
<script lang="ts">
  import type { PillId, PillSpec } from "./pill-types";

  interface Props {
    pills: PillSpec[];
    activeId: PillId | null;
    onSelect: (id: PillId) => void;
    variant: "mobile" | "desktop";
    /** Optional: parent receives the nav root element on mount so it can
     *  restore focus to a specific pill button via
     *  `el.querySelector('[data-pill-id="<id>"]')`. */
    onNavMount?: (el: HTMLDivElement) => void;
  }

  const { pills, activeId, onSelect, variant, onNavMount }: Props = $props();

  // Local element reference — arrow-key focus moves are scoped to THIS nav
  // only, so multiple DownloadPillNav instances on the same page (e.g. a
  // mid-resize transition where mobile + desktop briefly co-mount) cannot
  // steal focus from each other.
  let navEl: HTMLDivElement | undefined = $state();
  $effect(() => {
    if (navEl) onNavMount?.(navEl);
  });

  function focusPillAt(idx: number) {
    if (!navEl || pills.length === 0) return;
    const wrapped = ((idx % pills.length) + pills.length) % pills.length;
    const target = navEl.querySelector<HTMLButtonElement>(
      `[data-pill-id="${pills[wrapped].id}"]`,
    );
    target?.focus();
  }

  function handleKeydown(e: KeyboardEvent, id: PillId) {
    // Enter / Space activate. Space's default on a focused <button> is to
    // fire click on keyup — preventing default on keydown stops the page
    // from scrolling without breaking activation (we call onSelect ourselves).
    if (e.key === " ") {
      e.preventDefault();
      onSelect(id);
      return;
    }
    if (e.key === "Enter") {
      onSelect(id);
      return;
    }

    const idx = pills.findIndex((p) => p.id === id);
    if (idx < 0) return;

    // Arrow keys move focus along the row, do NOT activate.
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusPillAt(idx + 1);
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusPillAt(idx - 1);
      return;
    }
    // Home / End jump to first / last per WAI-ARIA toolbar pattern.
    if (e.key === "Home") {
      e.preventDefault();
      focusPillAt(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      focusPillAt(pills.length - 1);
      return;
    }
  }
</script>

<div
  bind:this={navEl}
  class="pill-nav variant-{variant}"
  role="group"
  aria-label="Download settings"
>
  {#each pills as pill (pill.id)}
    <button
      type="button"
      class="pill"
      data-pill-id={pill.id}
      aria-label={pill.label}
      aria-pressed={activeId === pill.id}
      aria-haspopup={variant === "mobile" ? "dialog" : undefined}
      style:--pill-accent={pill.accentColor ?? null}
      onclick={() => onSelect(pill.id)}
      onkeydown={(e) => handleKeydown(e, pill.id)}
    >
      <span class="pill-icon-row">
        {#if pill.icon}
          <i class="fas {pill.icon}" aria-hidden="true"></i>
        {:else if pill.accentColor}
          <span class="effort-dot" aria-hidden="true"></span>
        {/if}
        <span class="pill-label">{pill.label}</span>
      </span>
      <span class="pill-summary" class:empty={!pill.summary || pill.summary === "—"}>
        {pill.summary || "—"}
      </span>
    </button>
  {/each}
</div>
```


- [ ] **Step 2: Type check**

```bash
npm run check 2>&1 | grep -E "DownloadPillNav|pill-nav" | head
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/DownloadPillNav.svelte
git commit -m "$(cat <<'EOF'
feat(pill-nav): DownloadPillNav with keyboard nav and aria semantics

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: PillBody.svelte

**Files:**
- Create: `src/lib/shared/sequence-viewer/components/pill-nav/PillBody.svelte`

- [ ] **Step 1: Write the component**

Write `src/lib/shared/sequence-viewer/components/pill-nav/PillBody.svelte`:

```svelte
<!--
  PillBody.svelte

  Layout wrapper for the active pill's body. The only thing that differs
  between mobile and desktop is *where* the body is mounted:

  - mobile: rendered inside a RailBentoSheet that slides up from the
    bottom of the canvas. Closes via the sheet's ✕ / backdrop / Escape.
    Sheet handles aria-modal + focus trap.
  - desktop: rendered inline in a flex-grow scrollable region between
    the pill row and the download footer. Always visible — never closes.
    Wrapped in role="region" with aria-live="polite" so content swaps
    are announced to screen readers (the pill itself stays focused after
    activation; the body content changes silently otherwise).

  NOT role="tabpanel" — see DownloadPillNav for the rationale (the panel
  is conditionally mounted, not a permanent DOM sibling).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import RailBentoSheet from "../bento/RailBentoSheet.svelte";

  interface Props {
    title: string;
    variant: "mobile" | "desktop";
    onClose?: () => void;
    /** Mobile only: element to restore focus to when the sheet closes
     *  (typically the activating pill button). Forwarded to RailBentoSheet. */
    returnFocusTo?: HTMLElement | null;
    children: Snippet;
  }

  const { title, variant, onClose, returnFocusTo = null, children }: Props = $props();
</script>

{#if variant === "mobile"}
  <RailBentoSheet
    {title}
    onClose={onClose ?? (() => {})}
    {returnFocusTo}
  >
    {@render children()}
  </RailBentoSheet>
{:else}
  <div
    class="pill-body-inline"
    role="region"
    aria-label={title}
    aria-live="polite"
  >
    {@render children()}
  </div>
{/if}

<style>
  /* No internal padding — the active pill's content owns its own chrome
     (EffectsPanel renders self-padded .sb-section blocks; the inline
     pill bodies wrap themselves in a .pill-inline-pad div, see Task 6).
     PillBody only manages flex sizing and scroll. */
  .pill-body-inline {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
  }
</style>
```

- [ ] **Step 2: Type check**

```bash
npm run check 2>&1 | grep -E "PillBody|pill-nav" | head
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/pill-nav/PillBody.svelte
git commit -m "$(cat <<'EOF'
feat(pill-nav): PillBody wrapper (mobile sheet vs desktop inline)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Rewrite ExportVideoDrawer — script + template (atomic)

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`

This task rewrites both the `<script>` block and the template in one atomic commit. The previous draft split this into two tasks, which left the working tree non-building between commits — the new agent might `/compact` mid-rewrite and lose the in-flight state. Style block follows in **Task 7**.

- [ ] **Step 1: Replace the import block**

Open `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte`. Find the imports (lines ~10–28) and replace them with:

```ts
  import { fade } from "svelte/transition";
  import type {
    ExportOptionsStateManager,
    VideoFps,
    VideoResolution,
  } from "../state/export-options-state.svelte";
  import type { VideoExportProgress } from "$lib/features/compose/services/contracts/IVideoExportOrchestrator";
  import { estimateExportTime, hasDeviceMetrics } from "../state/export-timing-tracker";
  import EffectsPanel from "$lib/shared/animation-engine/components/effects-panel/EffectsPanel.svelte";
  import MobileEffectsPanel from "$lib/shared/animation-engine/components/effects-panel/MobileEffectsPanel.svelte";
  import PlaybackModeToggle from "$lib/features/compose/components/controls/PlaybackModeToggle.svelte";
  import type { PlaybackMode } from "$lib/features/compose/state/animation-panel-state.svelte";
  import "./bento/rail-tile.css";
  import "./pill-nav/pill-nav.css";
  import TempoControl from "./TempoControl.svelte";
  import { getAnimationVisibilityManager } from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";
  import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
  import { EFFECT_LABELS } from "$lib/shared/animation-engine/components/effects-panel/effect-registry";
  import EffortPanel from "$lib/shared/animation-engine/components/settings-panels/EffortPanel.svelte";
  import DisplayPanel from "$lib/shared/animation-engine/components/settings-panels/DisplayPanel.svelte";
  import PathShapePanel from "$lib/shared/animation-engine/components/settings-panels/PathShapePanel.svelte";
  import DownloadPillNav from "./pill-nav/DownloadPillNav.svelte";
  import PillBody from "./pill-nav/PillBody.svelte";
  import { type PillId, type PillSpec, buildPillSpecs } from "./pill-nav/pill-types";
  import { computeDisplaySummary } from "./pill-nav/pill-summaries";
  import { onDestroy } from "svelte";
```

`RailBentoSheet` is no longer imported here — `PillBody` consumes it internally. The previous `import RailBentoSheet ...` line is removed by replacing the whole block above.

- [ ] **Step 2: Replace the SheetId state with PillId state, with $effect-driven layout sync and pill-ref tracking**

Find the block (currently lines ~70–78):

```ts
  type SheetId = "effects" | "effort" | "playback" | "export";
  let openSheet = $state<SheetId | null>(null);
  function toggleSheet(id: SheetId) {
    openSheet = openSheet === id ? null : id;
  }
  function closeSheet() {
    openSheet = null;
  }
```

Replace with:

```ts
  // Mobile: null = no sheet open. Desktop: always has one pill active.
  // Use $effect to keep activePillId in sync with the layout prop. A one-shot
  // $state(layout === ...) initializer would only fire at component init —
  // if the parent flips layout from "bottom" to "sidebar" without remounting,
  // desktop would render with no active pill (empty body). The effect repairs
  // the state on every layout change.
  let activePillId = $state<PillId | null>(layout === "sidebar" ? "effects" : null);
  $effect(() => {
    if (layout === "sidebar" && activePillId === null) {
      activePillId = "effects";
    }
  });

  // Track each pill button so we can restore focus when the mobile sheet
  // closes. DownloadPillNav passes its root element on mount; we querySelector
  // for the right pill button when needed.
  let pillNavEl: HTMLDivElement | null = $state(null);
  function findPillButton(id: PillId): HTMLButtonElement | null {
    return pillNavEl?.querySelector<HTMLButtonElement>(`[data-pill-id="${id}"]`) ?? null;
  }
  let lastActivatedPillEl: HTMLButtonElement | null = $state(null);

  function selectPill(id: PillId): void {
    if (layout === "bottom") {
      // Mobile toggles the sheet; tapping the active pill closes it.
      const wasOpen = activePillId === id;
      activePillId = wasOpen ? null : id;
      // Capture the activating pill button so the sheet can restore focus on close.
      lastActivatedPillEl = wasOpen ? null : findPillButton(id);
    } else {
      // Desktop is always-on; tapping the active pill is a no-op.
      activePillId = id;
    }
  }

  function closePill(): void {
    if (layout === "bottom") {
      activePillId = null;
      // Focus restoration happens inside RailBentoSheet via returnFocusTo,
      // but we also clear the ref so a re-open re-captures fresh.
      lastActivatedPillEl = null;
    }
  }
```

- [ ] **Step 3: Add the pill summary derivations**

Right after the existing `effectsCount` derivation (current line ~96–100), append:

```ts
  // ── Pill summaries — recomputed when vmVersion ticks or props change ──

  /** Effects pill shows the active effect's display name (e.g. "Trails",
   *  "Fire"), or "Off" when none is set. The legacy effectsCount stat was
   *  meaningless because the default tipEffectMap is { "*": { effect: "trails" } }
   *  so a count of 1 vs 0 didn't reflect any user action. */
  const effectsSummary = $derived.by(() => {
    void vmVersion;
    const active = vm.getActiveEffect();
    if (active === "none") return "Off";
    return EFFECT_LABELS[active] ?? active;
  });

  const effortSummary = $derived(activeEffort.label);
  const effortAccent = $derived(activeEffort.color);

  const playbackSummary = $derived.by(() => {
    void vmVersion;
    const mode = vm.getPlaybackMode() === "step" ? "Step" : "Cont.";
    return `${bpm} BPM • ${mode}`;
  });

  const displaySummary = $derived.by(() => {
    void vmVersion;
    const s = vm.getSettings();
    return computeDisplaySummary(
      {
        tkaGlyph: s.tkaGlyph,
        stepNumbers: s.stepNumbers,
        beatPosition: s.beatPosition,
        props: s.props,
        wordHeader: s.wordHeader,
        progressBar: s.progressBar,
        grid: vm.isGridVisible(),
      },
      vm.getPathShape(),
    );
  });

  /** Export pill shows resolution + fps + loop count.
   *  Loops live in Export because they describe the OUTPUT video, not the
   *  preview playback (Playback pill controls in-canvas behavior only). */
  const exportSummary = $derived.by(() => {
    const r = exportOptions.videoResolution;
    const resLabel = renderMode === "3d"
      ? `${r}×${r}`
      : (r >= 4320 ? "8K" : r >= 2160 ? "4K" : `${r}p`);
    const loops = exportOptions.videoLoopCount;
    const loopLabel = loops > 1 ? ` • ${loops}×` : "";
    return `${resLabel} • ${exportOptions.videoFps} fps${loopLabel}`;
  });

  /** PillSpec map keyed by PillId. Compiler enforces every PillId has a
   *  spec — adding to PILL_ORDER without updating this object fails the
   *  type check, so no runtime drift guard is needed.
   *
   *  Note: "export" is quoted defensively. JS / TS allow reserved words as
   *  object literal keys, but some lint configs (e.g. strict
   *  no-restricted-syntax rules) flag unquoted reserved words in property
   *  positions. Quoting is unambiguous in every config. */
  const pills = $derived<PillSpec[]>(
    buildPillSpecs({
      effects:    { label: "EFFECTS",  icon: "fa-sparkles",   summary: effectsSummary },
      effort:     { label: "EFFORT",   summary: effortSummary, accentColor: effortAccent },
      playback:   { label: "PLAYBACK", icon: "fa-play",       summary: playbackSummary },
      display:    { label: "DISPLAY",  icon: "fa-eye",        summary: displaySummary },
      "export":   { label: "EXPORT",   icon: "fa-sliders",    summary: exportSummary },
    }),
  );
```

- [ ] **Step 3-bis: Scope `preventSpaceActivation` so it doesn't swallow Space on focused buttons / inputs**

Find the existing function (currently lines ~102–106):

```ts
  function preventSpaceActivation(event: KeyboardEvent) {
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
    }
  }
```

Replace with:

```ts
  /**
   * Prevent Space-initiated page scroll when focus is on a non-interactive
   * descendant of the export panel. Critically, do NOT preventDefault when
   * the focused element is a button/input/textarea/select — Space on those
   * elements is meant to activate the control, and preventDefault on the
   * bubbled keydown blocks that activation.
   */
  function preventSpaceActivation(event: KeyboardEvent) {
    if (event.key !== " " && event.code !== "Space") return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    const tag = target.tagName;
    if (tag === "BUTTON" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (target.isContentEditable) return;
    event.preventDefault();
  }
```

- [ ] **Step 4: Delete obsolete derivations**

Delete each of the following blocks (line ranges are approximate, locate by content):

1. The `fpsOptions` array literal:

```ts
  const fpsOptions: { value: VideoFps; label: string; badge?: string }[] = [
    { value: 30, label: "30" },
    { value: 60, label: "60" },
    { value: 120, label: "120" },
  ];
```

2. The `resOptions` array literal:

```ts
  const resOptions: { value: VideoResolution; label: string }[] = [
    { value: 720, label: "720p" },
    { value: 1080, label: "1080p" },
    { value: 2160, label: "4K" },
    { value: 4320, label: "8K" },
  ];
```

3. The `resOptionsWithDims` derivation:

```ts
  /** Resolution label with pixel dimensions for square (3D) exports */
  const resOptionsWithDims = $derived(
    resOptions.map((opt) => ({
      ...opt,
      label: renderMode === '3d' ? `${opt.value}x${opt.value}` : opt.label,
    }))
  );
```

4. The `settingsSummary` derivation:

```ts
  /** Summary of current settings for the bottom bar chip */
  const settingsSummary = $derived(
    `${exportOptions.videoResolution >= 2160 ? (exportOptions.videoResolution >= 4320 ? "8K" : "4K") : exportOptions.videoResolution + "p"} · ${exportOptions.videoFps}fps`
  );
```

The new template (Step 5 below) iterates inline literals for fps and resolution chips, so these arrays become dead. `exportSummary` replaces `settingsSummary`.

- [ ] **Step 5: Replace the entire template (everything between `</script>` and `<style>`)**

Find the line `</script>` (around line 172). Find the matching `<style>` opener (around line 656). Replace everything between them (inclusive of the surrounding markers' adjacent newlines but not the markers themselves) with:

```svelte
{#snippet pillBody()}
  {#if activePillId === "effects"}
    <!-- EffectsPanel manages its own .sb-section padding/borders;
         render it flat without a wrapping .pill-inline-pad. -->
    {#if layout === "bottom"}
      <MobileEffectsPanel />
    {:else}
      <EffectsPanel
        {bpm}
        onBpmChange={onBpmChange ?? (() => {})}
        {isPlaying}
        onPlaybackToggle={onPlaybackToggle ?? (() => {})}
        showPlayback={!!(onPlaybackToggle && onBpmChange)}
      />
    {/if}
  {:else if activePillId === "effort"}
    <div class="pill-inline-pad">
      <EffortPanel />
    </div>
  {:else if activePillId === "playback"}
    <!-- Playback = how the canvas previews the sequence: tempo + mode.
         Loops and start/end hold belong in Export because they describe
         the OUTPUT video, not in-canvas playback. -->
    <div class="pill-inline-pad">
      <div class="rt-section">
        <span class="rt-section-label">Tempo</span>
        <TempoControl
          {bpm}
          onBpmChange={onBpmChange ?? (() => {})}
          showPresets={false}
          showPractice={false}
          presetsMode="popover"
        />
      </div>

      {#if onPlaybackModeChange}
        <div class="rt-section">
          <span class="rt-section-label">Mode</span>
          <PlaybackModeToggle
            {playbackMode}
            {isPlaying}
            {onPlaybackModeChange}
            onPlaybackToggle={onPlaybackToggle ?? (() => {})}
          />
        </div>
      {/if}
    </div>
  {:else if activePillId === "display"}
    <div class="pill-inline-pad">
      <div class="rt-section" role="group" aria-labelledby="display-visibility-label">
        <span class="rt-section-label" id="display-visibility-label">Visibility</span>
        <DisplayPanel />
      </div>
      <div class="rt-section" role="group" aria-labelledby="display-paths-label">
        <span class="rt-section-label" id="display-paths-label">Motion paths</span>
        <PathShapePanel />
      </div>
    </div>
  {:else if activePillId === "export"}
    <div class="pill-inline-pad">
      <div class="rt-section">
        <span class="rt-section-label">Frame rate</span>
        <div class="rt-chip-row">
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoFps === 30}
            onclick={() => exportOptions.setVideoFps(30)}
          >30 fps</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoFps === 60}
            onclick={() => exportOptions.setVideoFps(60)}
          >60 fps</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoFps === 120}
            onclick={() => exportOptions.setVideoFps(120)}
          >120 fps</button>
        </div>
      </div>

      <div class="rt-section">
        <span class="rt-section-label">Resolution</span>
        <div class="rt-chip-row">
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 720}
            onclick={() => exportOptions.setVideoResolution(720)}
          >{renderMode === '3d' ? '720×720' : '720p'}</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 1080}
            onclick={() => exportOptions.setVideoResolution(1080)}
          >{renderMode === '3d' ? '1080×1080' : '1080p'}</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 2160}
            onclick={() => exportOptions.setVideoResolution(2160)}
          >{renderMode === '3d' ? '2160×2160' : '4K'}</button>
          <button type="button" class="rt-chip"
            aria-pressed={exportOptions.videoResolution === 4320}
            onclick={() => exportOptions.setVideoResolution(4320)}
          >{renderMode === '3d' ? '4320×4320' : '8K'}</button>
        </div>
      </div>

      {#if renderMode === '3d'}
        <div class="rt-section">
          <span class="rt-section-label">Quality</span>
          <div class="rt-chip-row">
            <button type="button" class="rt-chip"
              aria-pressed={exportOptions.videoQuality === 'standard'}
              onclick={() => exportOptions.setVideoQuality('standard')}
            >Standard</button>
            <button type="button" class="rt-chip"
              aria-pressed={exportOptions.videoQuality === 'cinema'}
              onclick={() => exportOptions.setVideoQuality('cinema')}
            ><i class="fas fa-film" aria-hidden="true"></i> Cinema</button>
          </div>
        </div>
      {/if}

      <div class="rt-section">
        <span class="rt-section-label">Timing</span>
        <div class="rt-chip-row">
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoIncludeStartPosition}
            onclick={() => exportOptions.setVideoIncludeStartPosition(!exportOptions.videoIncludeStartPosition)}
          >
            <i class="fas fa-step-backward" aria-hidden="true"></i> Start Hold
          </button>
          <button
            type="button"
            class="rt-chip"
            aria-pressed={exportOptions.videoIncludeEndHold}
            onclick={() => exportOptions.setVideoIncludeEndHold(!exportOptions.videoIncludeEndHold)}
          >
            <i class="fas fa-step-forward" aria-hidden="true"></i> End Hold
          </button>
        </div>
      </div>

      <div class="rt-row">
        <span class="rt-row-label">Loops</span>
        <div class="rt-stepper">
          <button
            type="button"
            class="rt-step-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount - 1)}
            disabled={exportOptions.videoLoopCount <= 1}
            aria-label="Decrease loop count"
          ><i class="fas fa-minus" aria-hidden="true"></i></button>
          <span class="rt-val">{exportOptions.videoLoopCount}×</span>
          <button
            type="button"
            class="rt-step-btn"
            onclick={() => exportOptions.setVideoLoopCount(exportOptions.videoLoopCount + 1)}
            disabled={exportOptions.videoLoopCount >= 10}
            aria-label="Increase loop count"
          ><i class="fas fa-plus" aria-hidden="true"></i></button>
        </div>
      </div>

      {#if timeEstimateLabel}
        <div class="video-duration-line">
          <i class="fas fa-clock" aria-hidden="true"></i>
          {timeEstimateLabel}
        </div>
      {/if}
      {#if totalVideoDuration}
        <div class="video-duration-line">
          <i class="fas fa-film" aria-hidden="true"></i>
          Video length: {totalVideoDuration}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

{#if layout === "bottom"}
  <!-- ============================================================
       MOBILE: pill row + download button at bottom; sheet pops up
       over the canvas when a pill is active.
       ============================================================ -->
  <div
    class="mobile-export"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Animation export"
  >
    {#if isExporting}
      <div class="mobile-progress" role="status" aria-live="polite">
        <div class="progress-info">
          <span class="progress-stage">
            {#if !exportProgress}Starting...{:else}Exporting{/if}
          </span>
          <span class="progress-pct">{exportProgress ? Math.round(exportProgress.progress * 100) : 0}%</span>
        </div>
        <div
          class="progress-bar"
          role="progressbar"
          aria-valuenow={exportProgress ? Math.round(exportProgress.progress * 100) : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Export progress"
        >
          <div class="progress-fill" style="width: {exportProgress ? exportProgress.progress * 100 : 0}%"></div>
        </div>
        {#if onCancel}
          <button
            type="button"
            class="cancel-btn"
            onclick={onCancel}
            aria-label="Cancel export"
          >
            <i class="fas fa-times" aria-hidden="true"></i>
            Cancel
          </button>
        {/if}
      </div>
    {:else}
      {#if activePillId !== null}
        <PillBody
          title={pills.find((p) => p.id === activePillId)?.label ?? ""}
          variant="mobile"
          onClose={closePill}
          returnFocusTo={lastActivatedPillEl}
        >
          {@render pillBody()}
        </PillBody>
      {/if}

      <div class="rt-zone" onkeydown={preventSpaceActivation} role="group" aria-label="Animation export">
        <DownloadPillNav
          {pills}
          {activePillId}
          onSelect={selectPill}
          variant="mobile"
          onNavMount={(el) => (pillNavEl = el)}
        />

        <button
          type="button"
          class="rt-download"
          onclick={onExport}
          disabled={exportDisabled}
          aria-label={exportButtonLabel}
        >
          {#if !canvasReady}
            <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
            Preparing export...
          {:else}
            <i class="fas {renderMode === '3d' ? 'fa-circle' : 'fa-download'}" aria-hidden="true"></i>
            {exportButtonLabel}
          {/if}
        </button>
      </div>
    {/if}
  </div>
{:else}
  <!-- ============================================================
       DESKTOP SIDEBAR: pill row at top, body inline, download in footer.
       ============================================================ -->
  <div
    class="export-panel sidebar"
    transition:fade={{ duration: 200 }}
    role="region"
    aria-label="Animation export settings"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="panel-body" onkeydown={preventSpaceActivation}>
      <DownloadPillNav
        {pills}
        {activePillId}
        onSelect={selectPill}
        variant="desktop"
        onNavMount={(el) => (pillNavEl = el)}
      />

      <PillBody
        title={pills.find((p) => p.id === activePillId)?.label ?? ""}
        variant="desktop"
      >
        {@render pillBody()}
      </PillBody>
    </div>

    <div class="panel-footer">
      {#if isExporting}
        <div class="export-progress-row" role="status" aria-live="polite">
          <div class="progress-info">
            <span class="progress-stage">
              {#if !exportProgress}Starting...{:else}Exporting{/if}
            </span>
            <span class="progress-pct">{exportProgress ? Math.round(exportProgress.progress * 100) : 0}%</span>
          </div>
          <div
            class="progress-bar"
            role="progressbar"
            aria-valuenow={exportProgress ? Math.round(exportProgress.progress * 100) : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Export progress"
          >
            <div class="progress-fill" style="width: {exportProgress ? exportProgress.progress * 100 : 0}%"></div>
          </div>
          {#if onCancel}
            <button
              type="button"
              class="cancel-btn"
              onclick={onCancel}
              aria-label="Cancel export"
            >
              <i class="fas fa-times" aria-hidden="true"></i>
              Cancel
            </button>
          {/if}
        </div>
      {:else}
        <div class="export-row">
          <button
            type="button"
            class="export-btn"
            onclick={onExport}
            disabled={exportDisabled}
            aria-label={exportButtonLabel}
          >
            {#if !canvasReady}
              <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
              Preparing export...
            {:else}
              <i class="fas {renderMode === '3d' ? 'fa-circle' : 'fa-download'}" aria-hidden="true"></i>
              {exportButtonLabel}
            {/if}
          </button>
          {#if timeEstimateLabel && !exportDisabled}
            <span class="time-estimate">{timeEstimateLabel}</span>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
```

This single template uses one `{#snippet pillBody}` with the pill body content shared between mobile and desktop. The mobile branch wraps `pillBody` in a sheet; the desktop branch renders it inline.

- [ ] **Step 6: Type check**

```bash
npm run check 2>&1 | grep -A 2 "ExportVideoDrawer" | head -40
```

Expected: zero errors. If there are errors, fix them before proceeding. Common ones:
- "openSheet is not defined" — leftover reference from Step 2's cleanup. Search the file for `openSheet`, `toggleSheet`, `closeSheet`, `SheetId` and replace any survivors.
- "settingsSummary is not defined" — leftover template binding. Same fix.

- [ ] **Step 7: Build**

```bash
npm run build 2>&1 | tail -15
```

Expected: build succeeds. Look for "built in Xs" line.

- [ ] **Step 8: Commit (script + template together)**

```bash
git add src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
git commit -m "$(cat <<'EOF'
refactor(export-video): unify mobile + desktop on 5-pill nav

Replaces the 4-tile mobile bento and the flat desktop sidebar with one
shared 5-pill nav (Effects / Effort / Playback / Display / Export).
Display + Path Shape come back into the UI (orphaned when the modal was
nuked).

- Effects pill summary shows the active effect's name (e.g. "Trails"),
  not a meaningless count derived from the wildcard tipEffectMap entry.
- Loops + Timing live in Export (they describe the output video).
  Playback pill = Tempo + Mode (in-canvas preview behavior).
- Pills use role=button + aria-pressed (not the broken role=tab pattern;
  pill bodies are conditionally mounted, not permanent tabpanels).
- Mobile pill carries aria-haspopup="dialog"; the bento sheet handles
  focus trap + restoration via PillBody's returnFocusTo prop.
- $effect keeps activePillId in sync with the layout prop so a runtime
  layout flip doesn't leave the desktop sidebar with no active pill.

Mobile keeps the slide-up sheet pattern via PillBody(variant=mobile).
Desktop renders the active body inline in the sidebar via
PillBody(variant=desktop). Single download button, always visible on
both viewports.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Replace dead CSS in ExportVideoDrawer with pill-only chrome

**Files:**
- Modify: `src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte` (style block only)

Task 6 leaves the old desktop chip/setting-row chrome orphaned and adds the new `.pill-inline-pad` wrapper. Replace the `<style>` block contents with the explicit final form below — no heuristic scan, no fragile class detection.

- [ ] **Step 1: Replace the `<style>` block**

Locate the `<style>` opener and `</style>` closer in the file. Replace **everything between them** with:

```css
  /* ============================================================
   * MOBILE BOTTOM CONTAINER
   * ============================================================ */

  .mobile-export {
    position: relative;
    flex-shrink: 0;
    border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    z-index: 10;
  }

  .mobile-progress {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 16px 12px;
  }

  /* ============================================================
   * DESKTOP SIDEBAR
   * ============================================================ */

  .export-panel {
    background: var(--theme-panel-bg, rgba(18, 18, 28, 0.98));
    display: flex;
    flex-direction: column;
    z-index: 10;
  }

  .export-panel.sidebar {
    position: relative;
    width: 100%;
    max-width: 100%;
    border-left: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    overflow: hidden;
  }

  /* Desktop body becomes a vertical flex container: pill nav row at top,
     PillBody fills remaining space and scrolls internally. */
  .panel-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 12px;
    padding: 12px;
  }

  /* Wrapper used by inline pill bodies (everything except Effects).
     Effects renders its own .sb-section padding, so it skips this wrapper. */
  :global(.pill-body-inline .pill-inline-pad) {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
  }

  .video-duration-line {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    padding: 4px 0;
  }

  .video-duration-line i {
    font-size: 11px;
    opacity: 0.6;
  }

  /* ============================================================
   * Footer (desktop sidebar)
   * ============================================================ */

  .panel-footer {
    padding: 12px 20px 16px;
    flex-shrink: 0;
  }

  .export-row {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .time-estimate {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
  }

  .export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 12px 24px;
    border: none;
    border-radius: 12px;
    background: var(--theme-accent, #6366f1);
    color: white;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .export-btn:hover:not(:disabled) {
    filter: brightness(1.1);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--theme-accent, #6366f1) 40%, transparent);
  }

  .export-btn:active:not(:disabled) {
    transform: scale(0.98);
    transition-duration: 50ms;
  }

  .export-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Progress (shared between mobile + desktop) */
  .export-progress-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .progress-stage {
    font-size: var(--font-size-compact, 12px);
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  .progress-pct {
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text, white);
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border-radius: 3px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--theme-accent, #6366f1);
    border-radius: 3px;
    transition: width 0.2s ease;
  }

  .cancel-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    min-height: var(--min-touch-target);
    padding: 10px 20px;
    background: transparent;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 12px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 14px);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cancel-btn:hover {
    background: color-mix(in srgb, var(--semantic-error, #f87171) 15%, transparent);
    border-color: var(--semantic-error, #f87171);
    color: var(--semantic-error, #f87171);
  }

  @media (prefers-reduced-motion: reduce) {
    .export-btn,
    .cancel-btn,
    .progress-fill {
      transition: none !important;
      animation: none !important;
    }

    .export-btn:active {
      transform: none !important;
    }
  }
```

This deletes (vs the original): `.setting-row`, `.setting-label`, `.chip-group`, `.chip`, `.chip:hover`, `.chip:active`, `.chip.active`, `.chip:focus-visible`, `.chip-badge`, `.loop-count-row`, `.loop-btn`, `.loop-btn:hover`, `.loop-btn:disabled`, `.loop-count-value`, plus removes the `.chip` references from the reduced-motion block. The new `.pill-inline-pad` rule is added globally so it applies inside `PillBody.svelte`'s `.pill-body-inline` wrapper. `.rt-zone`, `.rt-download`, `.rt-tile`, `.rt-section`, `.rt-chip`, `.rt-row`, `.rt-stepper` are inherited from `rail-tile.css` (already imported) and the global RailBentoSheet rules.

- [ ] **Step 2: Type check + build**

```bash
npm run check 2>&1 | grep -A 2 "ExportVideoDrawer" | head -10
npm run build 2>&1 | tail -5
```

Expected: zero errors, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
git diff --cached --stat
git commit -m "$(cat <<'EOF'
chore(export-video): replace style block with pill-only chrome

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Visual QA via Chrome DevTools MCP

**Files:** none (verification only)

**Permission gate:** per project rules, ask the user before any interactive Chrome DevTools commands. Read-only commands (`take_snapshot`, `take_screenshot`, `list_console_messages`) are fine without asking. Interactive commands (`navigate_page`, `click`, `fill`, `type_text`) require explicit verbal permission in the conversation.

If the user has not granted browser permission yet, post a single message:

> "Visual QA needs to drive Chrome DevTools — navigate to a viewer URL, click pills, and screenshot at two viewports. May I proceed?"

Wait for an affirmative response before continuing. If the user declines, mark this task complete with a note and proceed to Task 9 with a self-check via `curl localhost:5173/...` for HTTP-200 and `npm run build` only.

- [ ] **Step 1: Verify dev server is running**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
```

Expected: `200`. If not, ask the user to start their dev server (don't start a competing one on 5173).

- [ ] **Step 2: Get a viewer URL from the user**

Grepping `src/` for `/viewer/<code>` literals does not produce live URLs — strings in source aren't guaranteed to resolve to real shortcodes. Just ask:

> "What viewer URL should I QA against? (e.g. `http://localhost:5173/viewer/9stG`)"

If the user offers nothing, default to navigating to the create flow at `http://localhost:5173/` and triggering the export from there.

- [ ] **Step 3: Mobile viewport (393×709)**

Use `mcp__chrome-devtools__new_page` to open the viewer URL.
Use `mcp__chrome-devtools__resize_page` with `{ width: 393, height: 709 }`.
Use `mcp__chrome-devtools__take_snapshot` to confirm the viewer loaded.
Use `mcp__chrome-devtools__take_screenshot` for the resting state.

Trigger the Download Animation flow (the user knows how — typically a button labeled "Download" or similar in the viewer's UI). If unsure, take a snapshot, identify the trigger from the DOM, ask the user to confirm.

Once the panel is open, screenshot. Confirm:
- 5 pills visible in a row (Effects / Effort / Playback / Display / Export)
- Each pill shows label + summary
- Download Animation button below the pill row
- Canvas still visible above

Tap each pill in turn (`mcp__chrome-devtools__click` requires permission per the gate above):
- Effects → sheet opens with `MobileEffectsPanel` content
- Effort → sheet shows 8 effort buttons
- Playback → sheet shows Tempo + Mode (Loops/Timing are NOT here — they live in Export)
- Display → sheet shows Visibility section + Motion paths section
- Export → sheet shows FPS + Resolution + (Quality if 3D) + Timing + Loops + duration line

Tap the active pill again — sheet closes.

Save mobile screenshots to `.claude-tmp/qa-mobile-*.png`.

- [ ] **Step 4: Desktop viewport (1400×900)**

`mcp__chrome-devtools__resize_page` to `{ width: 1400, height: 900 }`.

Trigger the Download Animation panel. Screenshot. Confirm:
- 5 pills at the top of the sidebar
- "Effects" is active by default (rail-chip blue tint)
- Pill body renders inline below the pill row
- Download button + time estimate at the footer

Click each pill in turn — body swaps inline without layout shift. Confirm the active pill border and the body content match.

Save desktop screenshots to `.claude-tmp/qa-desktop-*.png`.

- [ ] **Step 5: Confirm "Animation Settings" canvas-menu entry is gone**

Synthetic `contextmenu` dispatch via `evaluate_script` is unreliable (the real handler may bind native events that don't trigger from a JS-dispatched MouseEvent). Verify by source inspection — cheaper and authoritative:

```bash
grep -nE "Animation Settings|open-animation-settings|onOpenSettings" \
  src/lib/shared/animation-engine/components/canvas-context-menu/ \
  src/lib/shared/animation-engine/components/AnimatorCanvas.svelte 2>&1
```

Expected: zero matches. The cleanup commit earlier in this branch removed the entry; this confirms it stayed gone after the pill-nav rewrite.

- [ ] **Step 6: Behavioral checks**

For each:
1. Toggle a Display visibility flag in the Display pill body. Confirm the Display pill summary count updates (e.g. `4 / 7 visible · arc` → `3 / 7 visible · arc`).
2. Switch path shape from Arc to Linear in the Display pill body's "Motion paths" section. Confirm the summary text changes from `· arc` to `· linear` without changing the count.
3. Change Effort to a different preset (e.g. Punch). Confirm the Effort pill border + dot recolor and the summary changes to the new label.
4. Change Effects from Trails to Fire (or any other). Confirm the Effects pill summary updates from "Trails" to "Fire".
5. Change FPS or resolution in the Export pill. Confirm the Export pill summary updates with the new values (covers all 3 fps + 4 resolution options).
6. Step the Loops counter in the Export pill up/down. Confirm value changes, disabled state on min/max, and the Export pill summary appends `• Nx` when count > 1.
7. On desktop only: confirm the Effects pill body shows the inline play/pause + tempo control row (driven by `EffectsPanel`'s `showPlayback` branch).
8. Switch between viewports (mobile ↔ desktop simulated by resizing). Confirm desktop defaults to Effects pill open; mobile defaults to no pill open.
9. **Keyboard a11y check:** Tab into the pill row, press `→` `→` `Home` `End` `←` — focus moves accordingly. Press `Enter` on a focused pill — that pill activates. Press `Space` on a focused pill — same. Press `Escape` while a mobile sheet is open — sheet closes AND focus returns to the activating pill button (verify via `document.activeElement` in the console).
10. **Touch target check:** With DevTools' Inspect tool, hover the `+`/`−` Loops stepper buttons and the sheet `×` close button — DevTools should show ≥44×44 hit areas.

- [ ] **Step 7: Console clean check**

```bash
mcp__chrome-devtools__list_console_messages
```

Expected: no errors related to pill-nav. Warnings are acceptable but log them.

- [ ] **Step 8: Take notes**

If any step revealed a visual or behavioral bug, note it. Fix in a follow-up commit before Task 9.

No commit needed for QA — screenshots are temp artifacts.

---

## Task 9: Final cleanup + verification

**Files:** any straggling orphaned imports

- [ ] **Step 1: Grep for orphaned references**

```bash
grep -nE "SheetId|openSheet|toggleSheet|closeSheet|settingsSummary" \
  src/lib/shared/sequence-viewer/components/ExportVideoDrawer.svelte
```

Expected: no matches.

```bash
grep -nE "animation-settings-modal|AnimationSettingsModal" src/ 2>/dev/null
```

Expected: no matches (cleanup from earlier in branch should be complete).

- [ ] **Step 2: Full type check**

```bash
npm run check 2>&1 | tail -25
```

Note: there are 8 pre-existing project-wide errors documented in the prior cleanup commit (ArrowSvg, ThreeDControlsLab, vm-shim, EffectsSettingsPanel) — those are NOT introduced by this work. Confirm:

- Errors in `ExportVideoDrawer.svelte`: zero
- Errors in `pill-nav/`: zero
- Errors in `settings-panels/`: zero
- Total errors: ≤ 8 (matching the pre-existing baseline)

If new errors appeared in any of the four scopes above, fix before final commit.

- [ ] **Step 3: Full build**

```bash
npm run build 2>&1 | tail -10
```

Expected: success.

- [ ] **Step 4: Run all tests**

```bash
npx vitest run tests/unit/pill-nav/ 2>&1 | tail -10
```

Expected: 5 tests passed (from Task 2).

- [ ] **Step 5: Final commit if anything changed**

```bash
git add -u
git diff --cached --stat
```

If anything is staged:

```bash
git commit -m "$(cat <<'EOF'
chore(pill-nav): tidy up after QA pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Otherwise skip.

---

## Success criteria

### Build / type / test
- `npm run check` passes with no NEW errors (matches the 8-error pre-existing baseline noted in Task 9).
- `npm run build` succeeds.
- `npx vitest run tests/unit/pill-nav/` passes (6 tests including the arity guard).

### Layout + nav
- At 393×709, the Download Animation panel shows a 5-pill row + download button. Tapping a pill opens a sheet over the canvas.
- At 1400×900, the sidebar shows a 5-pill row at the top, active body inline, download in the footer. Switching pills swaps the body without layout shift.
- **Effects pill summary** shows the active effect *name* ("Trails", "Fire", …) or "Off" — never a count.
- **Effort pill** border and dot are tinted with the active effort's color.
- **Playback pill** body has Tempo + Mode only (no Loops, no Timing — those describe the output video, not preview).
- **Display pill** exposes the 6 visibility toggles + Grid (under "Visibility" group label) + Path Shape Arc/Linear (under "Motion paths" group label). Summary reads `<n> / 7 visible · <path>`.
- **Export pill** body has FPS (30/60/120) + Resolution (720p/1080p/4K/8K) + Quality (3D only) + Timing (Start/End hold) + Loops + duration line. Summary appends `• Nx` when loops > 1. **No frame-rate or resolution options were dropped vs the old desktop sidebar.**
- Desktop Effects pill body still surfaces the inline play/pause + tempo via `EffectsPanel`'s `showPlayback` branch (no regression vs prior desktop UX).
- Right-click on the canvas does NOT show "Animation Settings…" anymore (verified by grep, not synthetic event).
- Orphan `PlaybackPanel.svelte` is gone (deleted in Pre-flight Step 0a-bis).

### Architecture / state
- All settings persist through their existing managers — a toggle in the pill body updates the canvas immediately.
- `activePillId` reactively tracks `layout` via `$effect` — flipping `layout="bottom"` → `"sidebar"` without remount still defaults the desktop sidebar to "effects".
- Shared `.rt-section`, `.rt-chip`, `.rt-row`, `.rt-stepper` primitives are defined in `rail-tile.css` and apply equally inside `.bento-sheet-body` and `.pill-body-inline`.

### Accessibility (AAA where reachable, never below AA)
- Pills are `role="button"` with `aria-pressed`. NO `role="tab"` / `aria-selected` (the tab pattern is broken for conditionally-mounted panels).
- Mobile pills carry `aria-haspopup="dialog"`.
- DownloadPillNav supports `←`/`→` (with wrap), `Home`, `End`, `Enter`, and `Space` keyboard navigation. No legacy `"Spacebar"` key name.
- Mobile sheet (`RailBentoSheet`) traps focus, restores focus to the activating pill on close, and respects `prefers-reduced-motion` on its `fly`/`fade` transitions.
- Touch targets in shared primitives meet AAA: `.rt-step-btn` ≥44×44, `.bento-sheet-close` ≥44×44, `.rt-chip` ≥44px tall, `.bento-sheet-close` has a focus-visible outline.
- Pill typography uses the project's 12px floor (`var(--font-size-compact)`) for both label and summary.
- Pill active state uses solid white text for AAA contrast (no color-mix that drifts below 7:1).
- Pill focus outline uses opaque accent (no 0.6 alpha that composites below 3:1).
- `EffortPanel` and `PathShapePanel` focus outlines are opaque (Task 0h).
- DisplayPanel + PathShapePanel are wrapped in `role="group"` with `aria-labelledby` to their section labels.

---

## Self-review checklist (run this after drafting)

- [x] **Spec coverage:** every section of the spec has at least one task.
  - DownloadPillNav → Task 4
  - PillBody → Task 5
  - pill-types (with `buildPillSpecs` type-enforced ordering) → Task 1
  - pill-summaries (Display arity helper + tests) → Task 2
  - pill-nav.css → Task 3
  - ExportVideoDrawer rewrite (script + template, atomic) → Task 6
  - Display section (Visibility group + Motion paths group) → embedded in Task 6
  - Loops + Timing in Export pill (NOT Playback — they describe output video) → embedded in Task 6
  - Dead CSS removal via explicit replacement → Task 7
  - Visual QA → Task 8
  - Final verification → Task 9
- [x] **Audit Round 1 fixes applied:**
  - Effects summary: name (`EFFECT_LABELS[active]`) not misleading count
  - 120 fps + 4K + 8K resolution chips preserved
  - Loops + Timing kept in Export (not Playback)
  - Desktop play/pause restored via `showPlayback={!!(onPlaybackToggle && onBpmChange)}`
  - Orphan `PlaybackPanel.svelte` deleted in Pre-flight 0a-bis
  - Import contradiction in Task 6 step 1 removed
  - `fpsOptions` / `resOptions` / `resOptionsWithDims` deletions added to Task 6 step 4
  - PILL_ORDER → `buildPillSpecs` Record-keyed function (compile-time enforcement); `"export"` quoted defensively
  - Path shape removed from "/N on" count; surfaced explicitly as `· arc` / `· linear`
  - Display summary denominator genuinely arity-derived (grid is now a regular field of `DisplayFlags`, no hardcoded `+1`)
  - Arrow-key `querySelector` scoped to local `bind:this` element
  - PillBody desktop variant has no padding; inline pill bodies wrap in `.pill-inline-pad`
  - Task 7 dead-CSS heuristic replaced with explicit final `<style>` block
  - Task 8 step 5 contextmenu verification done by grep, not synthetic dispatch
- [x] **Audit Round 2 fixes applied:**
  - `.rt-section` / `.rt-chip` / `.rt-row` primitives promoted from `RailBentoSheet` scope to `rail-tile.css` (Task 0e) so the desktop pill body actually gets styled
  - `.rt-step-btn` (24→44), `.bento-sheet-close` (28→44), `.rt-chip` (38→44 tall) bumped to AAA touch targets (Task 0f)
  - `RailBentoSheet` adds focus trap, focus restoration via `returnFocusTo`, and reduced-motion (Task 0g)
  - `EffortPanel` + `PathShapePanel` opaque focus outlines (Task 0h)
  - DownloadPillNav switches from `role="tab"` + `aria-selected` to `role="button"` + `aria-pressed`; mobile pills carry `aria-haspopup="dialog"`
  - PillBody desktop uses `role="region"` + `aria-live="polite"` (NOT `role="tabpanel"`)
  - Home / End keys added; legacy `"Spacebar"` dropped
  - `activePillId` synchronized to `layout` via `$effect` (not a one-shot `$state` initializer)
  - ExportVideoDrawer captures `pillNavEl` and `lastActivatedPillEl` so mobile sheet can restore focus on close
  - `preventSpaceActivation` scoped to non-interactive event targets (does NOT swallow Space on focused buttons / inputs)
  - Tasks 6 + 7 merged into a single atomic Task 6 (no half-built intermediate tree)
  - `.pill-label` and `.pill-summary` use 12px (project floor); active text uses solid white; focus outline uses opaque accent
  - Display pill body wraps DisplayPanel in `role="group"` "Visibility" + PathShapePanel in `role="group"` "Motion paths"
  - Task 8 viewer-URL grep theatre dropped (asks the user); Task 3 brace-balance theatre dropped (relies on `vite build`)
  - Task 8 step 6 includes keyboard a11y check + touch target check
- [x] **No placeholders:** every code block is complete, no `...`, no `TBD`.
- [x] **All file paths absolute-from-repo-root.**
- [x] **Each step is atomic** (1–10 minutes of work).
- [x] **Pre-flight verification (Steps 0a–0h)** confirms file structure, removes the orphan PlaybackPanel, hardens the shared primitives (CSS scoping, touch targets, focus trap, focus indicators) BEFORE the new pill-nav components consume them.
- [x] **Permission gates** for browser commands (Task 8) per project rules — never assume browser-control consent.
