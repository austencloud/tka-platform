# Performer Hub Rethink Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 3D PerformerHub detail dock so it reads as a designed product: fluid 4K-aware width, flat panel surface, TKA glyph words everywhere, one continuous prop grid, a Sims-style avatar-select modal with a live 3D preview and natural-pose thumbnails, a real sequence pane with a ChoreoCard preview step in the picker, beginner-legible planes controls, and effects that grow horizontally.

**Architecture:** All changes live under `src/lib/shared/3d/components/` (dock + tabs) plus two shared consumers (`SequencePickerModal`, `EffectPresetsSection`) and the thumbnail render pipeline (`scripts/`). Two new components: `AvatarSelectModal` (BaseModal host) + `AvatarPreviewStage` (standalone Threlte canvas), and `PlanesDiagram` (inline SVG). Existing behavior owners are reused, never forked: `TKAWordGlyph` for word rendering, `PerformerAvatarPicker` for the grid, `PropAwareThumbnail` for the card front, `BaseModal` for dialogs.

**Tech Stack:** Svelte 5 runes, Threlte (`@threlte/core`, `@threlte/extras`), `@austencloud/scene-3d` (Avatar3D, AVATAR_DEFINITIONS, PLANE_COLORS, prepareAvatarForDisplay), Blender + sharp + wrangler for thumbnails.

**Spec:** `docs/superpowers/specs/2026-08-18-performer-hub-rethink-design.md`

**Rules in force for every task:** `commit-only-your-own-changes.md` (explicit pathspec commits), `no-checkboxes.md`, `no-layout-shift.md`, `simplified-word-display.md` (TKAWordGlyph compresses repeats internally via `compressWord` — never render a raw repeated word), `4k-native-layout.md` (rem sizing, pinned column counts, no auto-fit for known counts), `visual-verification-mandatory.md` (Task 9 sweep). Do NOT touch the dev server on :5173. Do NOT add new browser component tests (`component-test-discipline.md` — verification here is grep proofs + `npm run check` + screenshots).

---

### Task 1: Dock shell — fluid 4K width, flat surface, no gradient seam

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PerformerHub.svelte` (styles ~96–143)
- Modify: `src/lib/shared/3d/components/controls/PerformerHubDetail.svelte:497`

- [x] **Step 1: Widen the detail dock**

In `PerformerHubDetail.svelte`, the `.hub-detail` rule currently reads:

```css
    width: clamp(520px, 34vw, 720px);
    max-width: 100%;
```

Replace the width line:

```css
    width: clamp(32.5rem, 44vw, 68.75rem);
    max-width: 100%;
```

(32.5rem = 520px floor unchanged; 44vw ≈ 845px at 1920, ≈ 1690px at 3840; 68.75rem = 1100px ceiling that grows with the root ramp.)

- [x] **Step 2: Flatten the spine panel surface**

In `PerformerHub.svelte`, `.spine-panel` currently has:

```css
    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, var(--panel-color) 9%, var(--theme-panel-bg)),
        color-mix(in srgb, var(--panel-color) 3%, var(--theme-panel-bg))
      ),
      black;
```

Replace with a flat wash (keep the opaque `black` underlay — `--theme-panel-bg` is translucent):

```css
    background:
      linear-gradient(
        color-mix(in srgb, var(--panel-color) 6%, var(--theme-panel-bg)),
        color-mix(in srgb, var(--panel-color) 6%, var(--theme-panel-bg))
      ),
      black;
```

- [x] **Step 3: Flatten the detail panel + restore its left seam**

In the same file, `.detail-panel` currently has:

```css
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--panel-color) 11%, var(--theme-panel-bg)),
        color-mix(in srgb, var(--panel-color) 3%, var(--theme-panel-bg))
      ),
      black;
    border: 1px solid
      color-mix(in srgb, var(--panel-color) 28%, var(--theme-stroke));
    border-left: none;
```

Replace the background with the SAME flat wash as the spine (identical color = no visible seam mismatch), and give the left edge a subtle 1px seam instead of nothing:

```css
    background:
      linear-gradient(
        color-mix(in srgb, var(--panel-color) 6%, var(--theme-panel-bg)),
        color-mix(in srgb, var(--panel-color) 6%, var(--theme-panel-bg))
      ),
      black;
    border: 1px solid
      color-mix(in srgb, var(--panel-color) 28%, var(--theme-stroke));
    border-left: 1px solid
      color-mix(in srgb, var(--panel-color) 14%, transparent);
```

Leave `border-radius`, `box-shadow`, `max-width: calc(100vw - 140px)`, and the `.spine-panel.has-detail` fused-corner rules untouched.

- [x] **Step 4: Verify with grep**

```bash
grep -n "linear-gradient(" src/lib/shared/3d/components/controls/PerformerHub.svelte
```

Expected: only the two flat (no-angle, same-color) gradients from Steps 2–3, plus any gradient on `.close-tab`-unrelated rules that already existed WITHOUT an angle keyword. No `135deg` / `180deg` hits remain in `.spine-panel`/`.detail-panel`.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(3d): performer dock widens fluidly and drops the directional gradient" -- src/lib/shared/3d/components/controls/PerformerHub.svelte src/lib/shared/3d/components/controls/PerformerHubDetail.svelte
```

---

### Task 2: TKA glyph for the header word chip

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PerformerIdentityHeader.svelte` (markup ~line 149, styles ~282–296)

- [x] **Step 1: Import the glyph**

Add to the `<script>` block:

```ts
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
```

- [x] **Step 2: Replace the raw word span**

Current markup:

```svelte
        <div class="sub-row">
          {#if sequenceWord}
            <span class="sequence-chip">{sequenceWord}</span>
            <span class="sequence-dot" aria-hidden="true">·</span>
          {/if}
```

Replace the chip line:

```svelte
        <div class="sub-row">
          {#if sequenceWord}
            <span class="sequence-chip" title={sequenceWord}>
              <TKAWordGlyph word={sequenceWord} height={16} darkMode fitToParent />
            </span>
            <span class="sequence-dot" aria-hidden="true">·</span>
          {/if}
```

`TKAWordGlyph` collapses repeated words internally (`compressWord`), so "FΨFΨFΨFΨ" renders as FΨ with a repeat dot — do NOT pre-simplify the string (the glyph needs the full word to detect repeats).

- [x] **Step 3: Adjust the chip CSS**

The `.sequence-chip` rule currently ellipsizes text:

```css
  .sequence-chip {
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
```

Replace with a flex box that lets `fitToParent` do the shrinking:

```css
  .sequence-chip {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    max-width: 14rem;
    overflow: hidden;
  }
```

Also remove `.sequence-chip` from the shared color/font-size selector group (`.all-hint, .sequence-chip, .sequence-dot, .sequence-steps { ... }`) — the glyph is an image row, the text styles are dead weight on it. Leave `.sequence-dot`/`.sequence-steps` in that group.

- [x] **Step 4: Grep proof (simplified-word-display self-check)**

```bash
grep -n "sequenceWord" src/lib/shared/3d/components/controls/PerformerIdentityHeader.svelte
```

Expected: hits only in props/`title=` attribute and the `<TKAWordGlyph word={sequenceWord}` line — no raw `{sequenceWord}` text node remains.

- [x] **Step 5: Commit**

```bash
git commit -m "feat(3d): performer header renders the word as TKA glyphs" -- src/lib/shared/3d/components/controls/PerformerIdentityHeader.svelte
```

---

### Task 3: Prop tab — one continuous grid, pinned columns

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PropFamilyPicker.svelte`

- [ ] **Step 1: Flatten the category islands into one grid**

Replace the entire `{:else}` branch (the `.picker-intro` + `.family-groups` block, lines ~94–143) with:

```svelte
  {:else}
    <div class="picker-intro">
      <strong>Choose a prop</strong>
      <span>Families with variants open a focused second page.</span>
    </div>

    <div class="family-grid" role="group" aria-label="Prop families">
      {#each PROP_CATEGORIES as category}
        {@const bases = propCategories.get(category.id) ?? []}
        {#if bases.length > 0}
          <h3 class="category-label" id={`prop-category-${category.id}`}>
            {category.label}
          </h3>
          {#each bases as base}
            {@const info = getPropTypeDisplayInfo(base)}
            {@const variantTotal = activeVariants(base).length}
            <button
              class="prop-choice family-choice"
              class:selected={selectedBase === base}
              type="button"
              aria-pressed={selectedBase === base}
              aria-describedby={`prop-category-${category.id}`}
              onclick={() => chooseFamily(base)}
            >
              {#if variantTotal > 1}
                <span class="variant-count" aria-label={`${variantTotal} variants`}>
                  {variantTotal}
                </span>
              {/if}
              <PropCompositionPreview propType={base} size={42} darkBackground />
              <span>{info.label}</span>
              {#if variantTotal > 1}
                <i class="fas fa-chevron-right" aria-hidden="true"></i>
              {/if}
            </button>
          {/each}
        {/if}
      {/each}
    </div>
  {/if}
```

(The `<section>`/`aria-labelledby` wrappers go away; each button carries `aria-describedby` to its category label instead.)

- [ ] **Step 2: Replace the grid CSS**

Delete the `.family-groups`, `.family-group`, `.family-group h3` rules and the `@container (min-width: 600px) { .family-groups { ... } }` block. Replace the shared `.family-grid, .variant-grid` rule (currently `repeat(auto-fit, minmax(88px, 1fr))`) with pinned counts:

```css
  .family-grid,
  .variant-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .category-label {
    grid-column: 1 / -1;
    margin: 6px 0 0;
    color: var(--theme-text-dim);
    font-size: 14px;
    font-weight: 700;
  }
  .family-grid > .category-label:first-child {
    margin-top: 0;
  }
  @container (min-width: 640px) {
    .family-grid,
    .variant-grid {
      grid-template-columns: repeat(6, minmax(0, 1fr));
    }
  }
  @container (min-width: 960px) {
    .family-grid {
      grid-template-columns: repeat(8, minmax(0, 1fr));
    }
  }
```

- [ ] **Step 3: Grep proof (no auto-fit against a known count)**

```bash
grep -n "auto-fit\|auto-fill" src/lib/shared/3d/components/controls/PropFamilyPicker.svelte
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(3d): prop picker is one continuous grid with inline category labels" -- src/lib/shared/3d/components/controls/PropFamilyPicker.svelte
```

---

### Task 4: Planes tab — diagram, labeled hand chips, no iOS toggle, reset in header

**Files:**
- Create: `src/lib/shared/3d/components/PlanesDiagram.svelte`
- Modify: `src/lib/shared/3d/components/PlanesPopover.svelte`

Keep-separate note (chip-primitives.md): the Blue/Red hand chips form a per-column radio MATRIX across three rows — an assignment model `SegmentedControl` cannot express and `FilterChipBase` toggles would mis-model (exactly-one-per-hand across rows). They stay hand-built, colored by the shared `--prop-blue`/`--prop-red` semantics.

- [ ] **Step 1: Create the inline SVG diagram**

`src/lib/shared/3d/components/PlanesDiagram.svelte`:

```svelte
<script lang="ts">
  import { Plane, PLANE_COLORS } from "@austencloud/scene-3d";

  interface Props {
    bluePlane: Plane | null;
    redPlane: Plane | null;
    visiblePlanes: ReadonlySet<Plane>;
  }

  let { bluePlane, redPlane, visiblePlanes }: Props = $props();

  function planeOpacity(plane: Plane): number {
    if (bluePlane === plane || redPlane === plane) return 1;
    return visiblePlanes.has(plane) ? 0.7 : 0.28;
  }
</script>

<!-- Isometric legend: wall faces the viewer, wheel is edge-on, floor lies flat. -->
<svg
  class="planes-diagram"
  viewBox="0 0 200 148"
  role="img"
  aria-label="Diagram of the wall, wheel, and floor planes around the performer"
>
  <!-- Floor: flat ellipse at the feet -->
  <ellipse
    cx="100" cy="120" rx="58" ry="15"
    fill="none" stroke={PLANE_COLORS[Plane.FLOOR]} stroke-width="3"
    opacity={planeOpacity(Plane.FLOOR)}
  />
  <!-- Wheel: edge-on vertical circle (narrow ellipse) -->
  <ellipse
    cx="100" cy="66" rx="12" ry="46"
    fill="none" stroke={PLANE_COLORS[Plane.WHEEL]} stroke-width="3"
    opacity={planeOpacity(Plane.WHEEL)}
  />
  <!-- Wall: circle facing the viewer -->
  <circle
    cx="100" cy="66" r="46"
    fill="none" stroke={PLANE_COLORS[Plane.WALL]} stroke-width="3"
    opacity={planeOpacity(Plane.WALL)}
  />
  <!-- Performer: head + torso + legs, neutral color -->
  <g stroke="var(--theme-text-dim)" stroke-width="3" stroke-linecap="round" fill="none">
    <circle cx="100" cy="42" r="7" fill="var(--theme-text-dim)" stroke="none" />
    <line x1="100" y1="50" x2="100" y2="92" />
    <line x1="100" y1="92" x2="90" y2="116" />
    <line x1="100" y1="92" x2="110" y2="116" />
    <line x1="100" y1="60" x2="86" y2="78" />
    <line x1="100" y1="60" x2="114" y2="78" />
  </g>
</svg>

<style>
  .planes-diagram {
    display: block;
    width: 100%;
    max-width: 13.75rem;
    height: auto;
  }
</style>
```

- [ ] **Step 2: Restructure the popover markup**

In `PlanesPopover.svelte`, add the import:

```ts
  import PlanesDiagram from "./PlanesDiagram.svelte";
```

Replace everything from `<div class="plane-matrix">` through the closing `{/if}` of the `planes-footer` block (i.e. the matrix, the `label-toggle-row`, and the footer — keep the `CascadeBadge` block above untouched) with:

```svelte
<div class="planes-header">
  <p class="planes-hint">
    Each hand spins in one plane. Tap <strong>Blue</strong> or
    <strong>Red</strong> to move that hand; the eye shows or hides a plane's
    guide ring.
  </p>
  {#if isPlaneStateNonDefault}
    <button
      class="reset-btn"
      class:with-overrides={hasStepOverrides}
      onclick={handleResetPlanesClick}
      aria-label={hasStepOverrides
        ? "Reset all planes and clear step overrides"
        : "Reset all planes"}
      title={hasStepOverrides
        ? "Reset all planes and clear step overrides"
        : "Reset all planes"}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-15-6.7L3 13" />
      </svg>
      Reset
      {#if hasStepOverrides}
        <span class="override-badge" aria-hidden="true"></span>
      {/if}
    </button>
  {/if}
</div>

<div class="planes-body">
  <PlanesDiagram {bluePlane} {redPlane} visiblePlanes={viewer.visiblePlanes} />

  <div class="plane-matrix">
    {#each PLANES as { plane, label }}
      {@const visible = isVisible(plane)}
      {@const handAssigned = hasHandOnPlane(plane)}
      {@const color = PLANE_COLORS[plane]}
      <div
        class="plane-row"
        class:with-hand={handAssigned}
        class:hidden-row={!visible}
      >
        <button
          class="plane-left"
          onclick={(e) => handlePlaneToggleClick(e, plane)}
          aria-pressed={visible}
          aria-label={`${label} plane - ${visible ? "visible, click to hide" : "hidden, click to show"}`}
        >
          <span
            class="plane-toggle"
            class:visible
            class:hidden={!visible}
            style="--dot-color: {color};"
          >
            <i
              class="plane-eye {visible ? 'fas fa-eye' : 'fas fa-eye-slash'}"
              aria-hidden="true"
            ></i>
          </span>
          <span class="plane-name">
            <span class="plane-label">{label}</span>
            <span class="eye-state">{visible ? "Shown" : "Hidden"}</span>
          </span>
        </button>
        <div class="plane-right">
          <button
            class="hand-chip blue"
            class:filled={bluePlane === plane}
            onclick={(e) => handleHandSlotClick(e, "blue", plane)}
            aria-pressed={bluePlane === plane}
            aria-label={`Blue hand on ${label}`}
          >
            Blue
          </button>
          <button
            class="hand-chip red"
            class:filled={redPlane === plane}
            onclick={(e) => handleHandSlotClick(e, "red", plane)}
            aria-pressed={redPlane === plane}
            aria-label={`Red hand on ${label}`}
          >
            Red
          </button>
        </div>
      </div>
    {/each}
  </div>
</div>

<button
  class="setting-toggle"
  class:active={viewer.showGridLabels}
  onclick={toggleGridLabels}
  aria-pressed={viewer.showGridLabels}
>
  <i
    class="toggle-glyph {viewer.showGridLabels
      ? 'fas fa-check-circle'
      : 'far fa-circle'}"
    aria-hidden="true"
  ></i>
  <span class="setting-label">Location labels</span>
  <span class="state-word">{viewer.showGridLabels ? "On" : "Off"}</span>
</button>
```

- [ ] **Step 3: Replace the affected CSS**

Delete these rules from `PlanesPopover.svelte`: `.hand-slot` and every `.hand-slot.*` variant, `.planes-footer`, `.label-toggle-row`, `.toggle-label`, `.label-toggle`, `.toggle-track`, `.label-toggle.active .toggle-track`, `.toggle-thumb`, `.label-toggle.active .toggle-thumb`. Keep `.plane-matrix`, `.plane-row*`, `.plane-left`, `.plane-right`, `.plane-toggle*`, `.plane-eye`, `.plane-label`, `.reset-btn*`, `.override-badge` as they are, and add:

```css
  .planes-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }

  .planes-hint {
    margin: 0;
    color: var(--theme-text-dim);
    font-size: 14px;
    line-height: 1.45;
    max-width: 34rem;
  }

  .planes-hint strong {
    color: var(--theme-text);
    font-weight: 700;
  }

  .planes-body {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .planes-body :global(.planes-diagram) {
    flex: 0 0 auto;
    width: clamp(7rem, 26%, 13.75rem);
  }

  .plane-matrix {
    flex: 1;
    min-width: 0;
  }

  .plane-name {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .eye-state {
    /* "Hidden" is the widest state; reserve it so rows never shift. */
    min-width: 3.5rem;
    color: var(--theme-text-tertiary);
    font-size: 12px;
    font-weight: 600;
  }

  .hand-chip {
    min-width: 3.75rem;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 22px;
    border: 2px solid;
    background: transparent;
    cursor: pointer;
    font-size: 13px;
    font-weight: 750;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
    flex-shrink: 0;
  }

  .hand-chip.blue {
    border-color: color-mix(in srgb, var(--prop-blue) 45%, transparent);
    color: color-mix(in srgb, var(--prop-blue) 80%, var(--theme-text));
  }

  .hand-chip.red {
    border-color: color-mix(in srgb, var(--prop-red) 45%, transparent);
    color: color-mix(in srgb, var(--prop-red) 80%, var(--theme-text));
  }

  .hand-chip:hover:not(.filled).blue {
    border-color: color-mix(in srgb, var(--prop-blue) 75%, transparent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--prop-blue) 20%, transparent);
  }

  .hand-chip:hover:not(.filled).red {
    border-color: color-mix(in srgb, var(--prop-red) 75%, transparent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--prop-red) 20%, transparent);
  }

  .hand-chip.filled.blue {
    background: var(--prop-blue);
    border-color: var(--prop-blue);
    color: white;
    box-shadow: 0 0 12px color-mix(in srgb, var(--prop-blue) 50%, transparent);
  }

  .hand-chip.filled.red {
    background: var(--prop-red);
    border-color: var(--prop-red);
    color: white;
    box-shadow: 0 0 12px color-mix(in srgb, var(--prop-red) 50%, transparent);
  }

  .setting-toggle {
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    min-height: 44px;
    margin-top: 10px;
    padding: 0 12px;
    border-radius: 10px;
    background: var(--surface-inset);
    border: 1px solid var(--theme-stroke);
    color: var(--theme-text-dim);
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
  }

  .setting-toggle:hover {
    background: var(--theme-card-hover-bg);
    border-color: var(--theme-stroke-strong);
    color: var(--theme-text);
  }

  .setting-toggle.active {
    color: var(--theme-text);
    border-color: color-mix(in srgb, var(--theme-accent) 45%, var(--theme-stroke));
  }

  .setting-toggle.active .toggle-glyph {
    color: var(--theme-accent);
  }

  .setting-label {
    flex: 1;
    text-align: left;
  }

  .state-word {
    min-width: 2.2rem;
    text-align: right;
    color: var(--theme-text-tertiary);
    font-weight: 700;
  }

  .setting-toggle.active .state-word {
    color: var(--theme-text);
  }

  @container (max-width: 460px) {
    .planes-body {
      flex-direction: column;
      align-items: stretch;
    }
    .planes-body :global(.planes-diagram) {
      width: clamp(7rem, 45%, 10rem);
      margin: 0 auto;
    }
  }
```

Also move the `.reset-btn` `margin-top` off (it was in the footer context): change `.planes-footer`-era spacing by ensuring `.reset-btn` has `flex-shrink: 0;` added to its existing rule (it now sits in the header row).

- [ ] **Step 4: Grep proofs**

```bash
grep -n "toggle-track\|toggle-thumb\|type=\"checkbox\"" src/lib/shared/3d/components/PlanesPopover.svelte
```

Expected: no matches (iOS switch gone, no checkboxes introduced).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(3d): planes tab gets a diagram, labeled hand chips, and a proper toggle button" -- src/lib/shared/3d/components/PlanesPopover.svelte src/lib/shared/3d/components/PlanesDiagram.svelte
```

---

### Task 5: Effects — LOOKS grid grows to 4 columns on wide docks

**Files:**
- Modify: `src/lib/shared/animation-engine/components/effects-panel/EffectPresetsSection.svelte:76-78` (script) and ~452–456 (styles)

This component is shared with other effects hosts; the change is purely additive (a wider container tier), so other consumers only gain the tier if their `looks` container ever exceeds 40rem.

- [ ] **Step 1: Add the wide-tier column derivation**

Current:

```ts
  const wideCols = $derived(
    presetModels.length % 3 === 1 && presetModels.length % 2 === 0 ? 2 : 3
  );
```

Add directly below it:

```ts
  /* Fourth column on genuinely wide docks (the performer hub at 4K). Skip it
   * when it would strand one card on the last row — those counts stay at 3. */
  const ultraCols = $derived(
    presetModels.length >= 4 && presetModels.length % 4 !== 1 ? 4 : 3
  );
```

- [ ] **Step 2: Emit it on the grid**

Current:

```svelte
      <div class="preset-grid" data-cols={wideCols}>
```

Replace:

```svelte
      <div class="preset-grid" data-cols={wideCols} data-cols-wide={ultraCols}>
```

- [ ] **Step 3: Add the container tier**

Directly after the existing block:

```css
  @container looks (min-width: 26rem) {
    .preset-grid[data-cols="3"] {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
```

add:

```css
  @container looks (min-width: 40rem) {
    .preset-grid[data-cols-wide="4"] {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(effects): looks grid steps to four columns on wide containers" -- src/lib/shared/animation-engine/components/effects-panel/EffectPresetsSection.svelte
```

---

### Task 6: Avatar select modal with live 3D preview

**Files:**
- Create: `src/lib/shared/3d/components/controls/avatar-select/AvatarPreviewStage.svelte`
- Create: `src/lib/shared/3d/components/controls/avatar-select/AvatarSelectModal.svelte`
- Modify: `src/lib/shared/3d/components/controls/PerformerHubDetail.svelte` (avatar tab pane ~342–358, imports, state)

Discovery statement (never-hand-roll): Composing existing owners — `BaseModal` (dialog), `PerformerAvatarPicker` (grid + keyboard nav + prewarm intents), `Avatar3D` from scene-3d (rendering), `prepareAvatarForDisplay` (shared GLTF cache warmup). New capability is only the focused-preview stage.

- [ ] **Step 1: Create the preview stage**

`src/lib/shared/3d/components/controls/avatar-select/AvatarPreviewStage.svelte`:

```svelte
<script lang="ts">
  /**
   * AvatarPreviewStage
   *
   * Minimal standalone Threlte canvas for the avatar-select modal: the focused
   * avatar in its idle locomotion pose on a small pedestal disc, slow auto-
   * orbit. Deliberately NOT Scene3D — no environment, grid, or feature
   * context; the modal only needs the figure.
   */
  import { Canvas, T } from "@threlte/core";
  import { OrbitControls } from "@threlte/extras";
  import { Avatar3D, type AvatarId } from "@austencloud/scene-3d";

  interface Props {
    avatarId: AvatarId;
  }

  let { avatarId }: Props = $props();
</script>

<div class="stage">
  <Canvas>
    <T.PerspectiveCamera makeDefault position={[0, 1.35, 3.1]} fov={32}>
      <OrbitControls
        autoRotate
        autoRotateSpeed={0.9}
        enableZoom={false}
        enablePan={false}
        target={[0, 0.95, 0]}
      />
    </T.PerspectiveCamera>

    <T.AmbientLight intensity={0.85} />
    <T.DirectionalLight position={[2.5, 4, 3]} intensity={1.6} />
    <T.DirectionalLight position={[-3, 2, -2]} intensity={0.5} />

    {#key avatarId}
      <Avatar3D
        {avatarId}
        useGLTF
        bluePropState={null}
        redPropState={null}
        enableLocomotion
        position={{ x: 0, z: 0 }}
        facingAngle={0}
      />
    {/key}

    <T.Mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <T.CircleGeometry args={[0.9, 48]} />
      <T.MeshStandardMaterial color="#1c2333" roughness={0.9} />
    </T.Mesh>
  </Canvas>
</div>

<style>
  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 18rem;
    border-radius: 12px;
    overflow: hidden;
    background:
      radial-gradient(
        ellipse at 50% 85%,
        color-mix(in srgb, var(--performer-color, #6ea8ff) 14%, transparent),
        transparent 65%
      ),
      var(--surface-inset-deep);
    border: 1px solid var(--theme-stroke);
  }
</style>
```

- [ ] **Step 2: Create the modal**

`src/lib/shared/3d/components/controls/avatar-select/AvatarSelectModal.svelte`:

```svelte
<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import PerformerAvatarPicker from "../PerformerAvatarPicker.svelte";
  import AvatarPreviewStage from "./AvatarPreviewStage.svelte";
  import {
    AVATAR_DEFINITIONS,
    getAvatarModelPath,
    prepareAvatarForDisplay,
    type AvatarId,
  } from "@austencloud/scene-3d";

  interface Props {
    open: boolean;
    currentAvatarId: AvatarId | null;
    /** Commit the focused avatar. The host owns apply + pending state. */
    onCommit: (id: AvatarId) => void;
    onClose: () => void;
  }

  let {
    open = $bindable(false),
    currentAvatarId,
    onCommit,
    onClose,
  }: Props = $props();

  const fallbackId = AVATAR_DEFINITIONS[0]?.id as AvatarId;
  let focusedId = $state<AvatarId>(currentAvatarId ?? fallbackId);

  // Re-anchor focus to the current avatar every time the modal opens.
  $effect(() => {
    if (open) focusedId = currentAvatarId ?? fallbackId;
  });

  const focusedDef = $derived(
    AVATAR_DEFINITIONS.find((a) => a.id === focusedId)
  );
  const isCurrent = $derived(focusedId === currentAvatarId);

  function prewarm(id: AvatarId): void {
    void prepareAvatarForDisplay(getAvatarModelPath(id)).catch(() => {
      /* prewarm is best-effort; selection handles real failures */
    });
  }

  function commit(): void {
    onCommit(focusedId);
    onClose();
  }
</script>

<BaseModal
  bind:open
  onclose={() => onClose()}
  size="xl"
  class="avatar-select-modal"
  labelledBy="avatar-select-title"
>
  {#snippet header()}
    <div class="modal-header">
      <h2 id="avatar-select-title">Choose your avatar</h2>
      <button class="close-btn" onclick={onClose} aria-label="Close">
        <i class="fas fa-times" aria-hidden="true"></i>
      </button>
    </div>
  {/snippet}

  <div class="avatar-select-body">
    <div class="preview-pane">
      <AvatarPreviewStage avatarId={focusedId} />
      <div class="preview-meta">
        <strong class="preview-name">{focusedDef?.name ?? focusedId}</strong>
        {#if focusedDef?.description}
          <span class="preview-desc">{focusedDef.description}</span>
        {/if}
      </div>
      <button
        class="select-btn"
        type="button"
        disabled={isCurrent}
        onclick={commit}
      >
        <i class="fas fa-check" aria-hidden="true"></i>
        <span>{isCurrent ? "This is your avatar" : "Select this avatar"}</span>
      </button>
    </div>

    <div class="grid-pane">
      <PerformerAvatarPicker
        selectedAvatarId={focusedId}
        pendingAvatarId={null}
        onSelect={(id) => (focusedId = id)}
        onIntent={prewarm}
        onCancelIntent={() => {}}
      />
    </div>
  </div>
</BaseModal>

<style>
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md, 12px) var(--spacing-lg, 16px);
  }

  .modal-header h2 {
    margin: 0;
    font-size: var(--font-size-lg, 18px);
    color: var(--theme-text, white);
    font-weight: 600;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--theme-text-dim);
    cursor: pointer;
  }

  .close-btn:hover {
    color: var(--theme-text);
    background: var(--theme-card-hover-bg);
  }

  .avatar-select-body {
    display: grid;
    grid-template-columns: minmax(18rem, 2fr) minmax(0, 3fr);
    gap: 16px;
    padding: 0 var(--spacing-lg, 16px) var(--spacing-lg, 16px);
    min-height: 24rem;
  }

  .preview-pane {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .preview-pane > :global(.stage) {
    flex: 1;
  }

  .preview-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .preview-name {
    color: var(--theme-text);
    font-size: 17px;
    line-height: 1.2;
  }

  .preview-desc {
    color: var(--theme-text-dim);
    font-size: 14px;
    line-height: 1.4;
  }

  .select-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    border-radius: 10px;
    border: 1px solid
      color-mix(in srgb, var(--performer-color, var(--theme-accent)) 55%, transparent);
    background: color-mix(
      in srgb,
      var(--performer-color, var(--theme-accent)) 24%,
      transparent
    );
    color: white;
    font-size: 15px;
    font-weight: 750;
    cursor: pointer;
    transition:
      background 140ms ease,
      border-color 140ms ease;
  }

  .select-btn:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--performer-color, var(--theme-accent)) 34%,
      transparent
    );
  }

  .select-btn:disabled {
    opacity: 0.55;
    cursor: default;
  }

  .grid-pane {
    min-width: 0;
    overflow-y: auto;
  }

  button:focus-visible {
    outline: 2px solid var(--performer-color, var(--theme-accent));
    outline-offset: 2px;
  }

  @media (max-width: 720px) {
    .avatar-select-body {
      grid-template-columns: 1fr;
    }
    .preview-pane > :global(.stage) {
      min-height: 14rem;
    }
  }
</style>
```

- [ ] **Step 3: Turn the dock's avatar pane into a summary + launcher**

In `PerformerHubDetail.svelte`, add imports:

```ts
  import AvatarSelectModal from "./avatar-select/AvatarSelectModal.svelte";
  import { R2_CDN } from "../../constants/r2-cdn";
```

Add state near `pendingAvatarId`:

```ts
  let avatarModalOpen = $state(false);
```

Replace the avatar tab pane body (currently the `<div class="avatar-section">` containing `<PerformerAvatarPicker ...>`) with:

```svelte
        <div class="avatar-section">
          <div class="avatar-summary">
            <img
              class="avatar-summary-thumb"
              src={currentAvatarId
                ? `${R2_CDN}/models/avatars/thumbnails/${currentAvatarId}.webp`
                : undefined}
              alt=""
            />
            <div class="avatar-summary-meta">
              <strong>{avatarDef?.name ?? "Mixed avatars"}</strong>
              <span>
                {pendingAvatarId
                  ? "Loading avatar…"
                  : (avatarDef?.description ?? "Performers use different avatars")}
              </span>
            </div>
            <button
              class="avatar-change-btn"
              type="button"
              onclick={() => (avatarModalOpen = true)}
            >
              <i class="fas fa-user-pen" aria-hidden="true"></i>
              <span>Change avatar</span>
            </button>
          </div>
        </div>
```

And render the modal once, near the end of the component's markup (outside the tab panes, before the existing remove-confirm dialog):

```svelte
<AvatarSelectModal
  bind:open={avatarModalOpen}
  {currentAvatarId}
  onCommit={(id) => void pickAvatar(id)}
  onClose={() => (avatarModalOpen = false)}
/>
```

`pickAvatar` keeps owning prepare + apply + pending state + error toast, exactly as today. `PerformerAvatarPicker` stays imported ONLY by the modal — remove its import from `PerformerHubDetail.svelte` along with the now-unused `queueAvatarSelectionIntent`/`cancelAvatarSelectionIntent` if nothing else references them (`pickAvatar` calls `cancelAvatarSelectionIntent()` on entry — keep that pair if you keep the call; simplest: keep the functions, they are harmless and `pickAvatar` still calls cancel).

Add the summary CSS to `PerformerHubDetail.svelte`'s styles:

```css
  .avatar-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    background: var(--surface-inset-deep);
  }

  .avatar-summary-thumb {
    width: 64px;
    height: 64px;
    border-radius: 10px;
    object-fit: cover;
    object-position: center top;
    background: var(--theme-card-bg);
    flex-shrink: 0;
  }

  .avatar-summary-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    flex: 1;
  }

  .avatar-summary-meta strong {
    color: var(--theme-text);
    font-size: 15px;
  }

  .avatar-summary-meta span {
    color: var(--theme-text-dim);
    font-size: 13.5px;
    line-height: 1.35;
  }

  .avatar-change-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 14px;
    border-radius: 9px;
    border: 1px solid
      color-mix(in srgb, var(--performer-color) 52%, transparent);
    background: color-mix(in srgb, var(--performer-color) 22%, transparent);
    color: white;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
  }

  .avatar-change-btn:hover {
    background: color-mix(in srgb, var(--performer-color) 32%, transparent);
  }
```

- [ ] **Step 4: Verify it compiles**

```bash
npm run check:fast > /tmp/hub-check.log 2>&1; grep -iE "error" /tmp/hub-check.log | head -20
```

Expected: no errors in the four touched/created avatar files.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(3d): Sims-style avatar select modal with live idle-pose preview" -- src/lib/shared/3d/components/controls/avatar-select/AvatarPreviewStage.svelte src/lib/shared/3d/components/controls/avatar-select/AvatarSelectModal.svelte src/lib/shared/3d/components/controls/PerformerHubDetail.svelte
```

---

### Task 7: Natural-pose avatar thumbnails

**Files:**
- Modify: `scripts/render-avatar-thumbnails.py`
- Modify: `scripts/build-avatar-thumbnails.mjs` (Blender invocation args)

Same R2 URLs (`models/avatars/thumbnails/<id>.webp`), so no app code changes. Requires Blender + wrangler; if either is unavailable on the machine, run with `--no-upload` for local proof and report the upload as deferred — do NOT silently skip the task.

- [ ] **Step 1: Add a `--pose-glb` arg and pose application to the Python renderer**

In `scripts/render-avatar-thumbnails.py`, extend the arg parser (after the `front_axis` clause):

```python
pose_glb = None
pose_frame = 30
```

and inside the `while` loop add:

```python
    elif argv[i] == "--pose-glb" and i + 1 < len(argv):
        pose_glb = argv[i + 1]; i += 2
    elif argv[i] == "--pose-frame" and i + 1 < len(argv):
        pose_frame = int(argv[i + 1]); i += 2
```

Add this function after `import_glb`:

```python
def apply_idle_pose():
    """Pose the avatar's armature using the idle clip at `pose_frame`.

    Mixamo rigs share bone names, so the idle action retargets by assignment.
    The clip's own imported objects are deleted; only the action is kept.
    """
    if not pose_glb:
        return
    armatures = [o for o in bpy.context.scene.objects if o.type == "ARMATURE"]
    if not armatures:
        print("  WARN: no armature, rendering bind pose")
        return
    arm = armatures[0]
    pre_objs = set(bpy.data.objects)
    pre_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=pose_glb)
    new_actions = [a for a in bpy.data.actions if a not in pre_actions]
    if new_actions:
        if arm.animation_data is None:
            arm.animation_data_create()
        arm.animation_data.action = new_actions[0]
    else:
        print("  WARN: pose clip had no action, rendering bind pose")
    for o in [o for o in bpy.data.objects if o not in pre_objs]:
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.scene.frame_set(pose_frame)
    bpy.context.view_layer.update()
```

In `render_one`, apply the pose BEFORE framing so the camera frames the posed figure:

```python
def render_one(glb_path, out_path):
    clear_scene()
    meshes = import_glb(glb_path)
    if not meshes:
        print(f"  SKIP (no mesh): {glb_path}")
        return False
    apply_idle_pose()
    mins, maxs = world_bbox(meshes)
    setup_camera(mins, maxs)
    setup_lighting()
    setup_render()
    bpy.context.scene.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print(f"  OK: {out_path}")
    return True
```

Note: `world_bbox` reads mesh `bound_box`, which for skinned meshes reflects the bind-pose bounds, not the armature pose — that is fine here: idle keeps the figure inside the bind-pose envelope, and the portrait framing (head-anchored `ortho_scale = height * 0.46`) is driven by overall height, which the idle pose preserves.

- [ ] **Step 2: Pass the pose clip from the Node driver**

In `scripts/build-avatar-thumbnails.mjs`, find the Blender invocation (the `execFileSync(BLENDER_BIN, [...])` call whose args array ends with `"--input", IN_DIR, "--output", PNG_DIR, ...`) and append two args:

```js
      "--pose-glb",
      join(PROJECT_ROOT, "static", "animations", "locomotion-pack", "idle.glb"),
```

(`static/animations/locomotion-pack/idle.glb` exists in the repo — verify with `ls` before running.)

- [ ] **Step 3: Render locally and inspect**

```bash
node scripts/build-avatar-thumbnails.mjs --no-upload
```

Expected output: `Done: N/N rendered` from Blender, followed by sharp webp conversion logs. Open two PNGs from the work dir (path printed by the script, `%TEMP%\tka-avatar-thumbs\png\`) and confirm arms are DOWN (idle stance), head near the top, transparent background. If a figure renders in T-pose, the armature/action assignment failed for that rig — print `bpy.data.actions` names in the WARN branch and investigate before uploading.

- [ ] **Step 4: Upload and verify**

```bash
node scripts/build-avatar-thumbnails.mjs
```

Expected: wrangler upload lines per avatar and `200` verification for every `https://pub-....r2.dev/models/avatars/thumbnails/<id>.webp`. (The app reads them through `R2_CDN`; browsers may cache the old T-pose webp until a hard reload — note that in the report.)

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(3d): avatar thumbnails render in idle pose, not T-pose" -- scripts/render-avatar-thumbnails.py scripts/build-avatar-thumbnails.mjs
```

---

### Task 8: Sequence pane rethink + picker preview step

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PerformerSequencePanel.svelte`
- Modify: `src/lib/shared/components/sequence-picker/SequencePickerModal.svelte`

- [ ] **Step 1: Rewrite the dock's sequence summary around the glyph**

In `PerformerSequencePanel.svelte`, add the import:

```ts
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
```

Replace the `has-sequence` summary block:

```svelte
    <div class="sequence-summary">
      <strong>{sequenceWord ?? "Untitled sequence"}</strong>
      {#if sequenceSteps !== null}
        <span>{sequenceSteps} steps</span>
      {/if}
    </div>
```

with:

```svelte
    <div class="sequence-summary">
      {#if sequenceWord}
        <div class="sequence-word-glyph" title={sequenceWord}>
          <TKAWordGlyph word={sequenceWord} height={40} darkMode fitToParent />
        </div>
      {:else}
        <strong>Untitled sequence</strong>
      {/if}
      {#if sequenceSteps !== null}
        <span>{sequenceSteps} steps</span>
      {/if}
    </div>
```

Add CSS (keep the existing `.sequence-summary` rules; the `strong` rule still covers the untitled fallback):

```css
  .sequence-word-glyph {
    display: flex;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
  }
```

- [ ] **Step 2: Add the preview-before-commit step to the shared picker**

In `SequencePickerModal.svelte`, add imports:

```ts
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
```

Add a prop to `Props` and destructuring (default preserves every existing caller's instant-commit behavior):

```ts
    /** Show a ChoreoCard preview + confirm step before committing a pick. */
    previewSelection?: boolean;
```

```ts
    previewSelection = false,
```

Add state and rework selection:

```ts
  let previewSequence = $state<SequenceData | null>(null);

  async function handleSelect(sequence: SequenceData) {
    if (previewSelection) {
      previewSequence = sequence;
      return;
    }
    await commitSelection(sequence);
  }

  async function commitSelection(sequence: SequenceData) {
    isSelectingSequence = true;
    try {
      const fullData = await hydrateSequenceData(sequence);
      onSelect(fullData ?? sequence);
      onClose();
    } finally {
      isSelectingSequence = false;
    }
  }
```

And clear the preview when the modal closes — extend the existing `$effect`'s `if (!open)` branch:

```ts
    if (!open) {
      showResults = false;
      previewSequence = null;
    }
```

- [ ] **Step 3: Render the preview pane**

In the modal body, change the branch chain so preview wins:

```svelte
  <div class="picker-body">
    {#if previewSequence}
      <div class="preview-stage">
        <div class="preview-card">
          <PropAwareThumbnail sequence={previewSequence} eager />
        </div>
        <div class="preview-meta">
          <div class="preview-word" title={previewSequence.word}>
            <TKAWordGlyph
              word={previewSequence.word}
              height={36}
              darkMode
              fitToParent
            />
          </div>
          <span class="preview-steps">{previewSequence.steps.length} steps</span>
          <div class="preview-actions">
            <button
              class="preview-back"
              type="button"
              onclick={() => (previewSequence = null)}
            >
              <i class="fas fa-arrow-left" aria-hidden="true"></i>
              <span>Back</span>
            </button>
            <button
              class="preview-use"
              type="button"
              disabled={isSelectingSequence}
              onclick={() => previewSequence && commitSelection(previewSequence)}
            >
              <i class="fas fa-check" aria-hidden="true"></i>
              <span>Use this sequence</span>
            </button>
          </div>
        </div>
      </div>
    {:else if showResults}
      ...existing results branch unchanged...
    {:else}
      ...existing FilterWorkspace branch unchanged...
    {/if}
```

- [ ] **Step 4: Preview pane CSS**

Add to the modal's styles:

```css
  .preview-stage {
    display: grid;
    grid-template-columns: minmax(16rem, 24rem) minmax(0, 1fr);
    gap: 20px;
    align-items: center;
    flex: 1;
    min-width: 0;
    padding: var(--spacing-lg, 16px);
  }

  .preview-card {
    align-self: stretch;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .preview-card :global(img),
  .preview-card :global(canvas) {
    max-width: 100%;
    max-height: 100%;
    border-radius: 10px;
  }

  .preview-meta {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
  }

  .preview-word {
    display: flex;
    min-width: 0;
    overflow: hidden;
  }

  .preview-steps {
    color: var(--theme-text-dim);
    font-size: 14px;
    font-weight: 600;
  }

  .preview-actions {
    display: flex;
    gap: 10px;
    margin-top: 6px;
  }

  .preview-back,
  .preview-use {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 0 16px;
    border-radius: 9px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  .preview-back {
    border: 1px solid var(--theme-stroke);
    background: var(--theme-card-bg);
    color: var(--theme-text-dim);
  }

  .preview-back:hover {
    background: var(--theme-card-hover-bg);
    color: var(--theme-text);
  }

  .preview-use {
    border: 1px solid color-mix(in srgb, var(--theme-accent) 55%, transparent);
    background: color-mix(in srgb, var(--theme-accent) 26%, transparent);
    color: white;
  }

  .preview-use:hover:not(:disabled) {
    background: color-mix(in srgb, var(--theme-accent) 36%, transparent);
  }

  .preview-use:disabled {
    opacity: 0.55;
    cursor: default;
  }

  @media (max-width: 720px) {
    .preview-stage {
      grid-template-columns: 1fr;
      align-content: start;
      overflow-y: auto;
    }
  }
```

- [ ] **Step 5: Opt the performer hub into the preview step**

In `PerformerSequencePanel.svelte`, the modal instantiation becomes:

```svelte
<SequencePickerModal
  open={pickerOpen}
  title={`Choose a sequence for ${performerName}`}
  previewSelection
  onSelect={selectSequence}
  onClose={() => (pickerOpen = false)}
/>
```

- [ ] **Step 6: Grep proofs**

```bash
grep -rn "{sequenceWord}" src/lib/shared/3d/components/controls/ | grep -v "word={sequenceWord}\|title={sequenceWord}"
```

Expected: no matches (no raw word text nodes left in the hub).

```bash
grep -n "previewSelection" src/lib/features src/lib/shared -r
```

Expected: only `SequencePickerModal.svelte` (definition) and `PerformerSequencePanel.svelte` (the one opt-in) — other callers keep instant commit.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(3d): sequence pane shows the TKA glyph and the picker gains a card preview step" -- src/lib/shared/3d/components/controls/PerformerSequencePanel.svelte src/lib/shared/components/sequence-picker/SequencePickerModal.svelte
```

---

### Task 9: Full check + visual verification sweep

**Files:** none (verification only; fixes loop back into the task that owns the file)

- [ ] **Step 1: One full typecheck**

```bash
npm run check > /tmp/full-check.log 2>&1; grep -niE "error" /tmp/full-check.log | head -30
```

Expected: zero errors. Fix any that trace to this plan's files, then re-grep the same log-capture pattern.

- [ ] **Step 2: Resource gates, then a throwaway dev server**

Run the PowerShell gates from `resource-budget.md` (free RAM ≥ 4096 MB, ≤ 2 agent vite servers). Never touch :5173. Then:

```bash
npx vite --port 5241 --strictPort
```

(background it; kill it in Step 5).

- [ ] **Step 3: Viewport sweep with DevTools MCP**

Launch/reuse the shared browser via `pwsh -NoProfile -File scripts/launch-chrome-debug.ps1 -Url about:blank`. Open a task-owned background tab at the sequence viewer's 3D mode with a sequence loaded (`https://localhost:5241/` → open any sequence → 3D pane → performer rail). For EACH viewport — `1920x1080x1`, `2560x1440x1`, `3840x2160x1`, `1440x900x1`, `820x1180x1`, `960x412x1`, `375x667x1` — `emulate`, then `take_screenshot` (`format: "webp", quality: 70`) of:

1. The dock on the Prop tab (grid columns pinned, no orphan rows, no dead category islands).
2. The Planes tab (diagram + labeled chips + toggle button; toggle each eye once and confirm nothing shifts).
3. The Effects tab (LOOKS at 4 columns when the dock is wide).
4. The avatar summary pane, then the avatar modal open (live preview orbiting, natural-pose thumbnails).
5. The sequence pane and the picker's preview step.

Also `evaluate_script` the dock's rendered width at 1920/2560/3840 and record the numbers (expect ≈ 845px / 1100px cap / 1100px cap — the app shell has no root font ramp).

Read every frame against the checklist in `visual-verification-mandatory.md` (absurd widths, dead space, orphans, illegibility). Fix-and-reshoot until clean. Skips (e.g. the dock intentionally full-screen sheet behavior at 375px, if it has one) must be named with reasons.

- [ ] **Step 4: Layout-shift spot checks**

On the Planes tab: toggle every eye and both hand chips per row — nothing outside the toggled control may move (the `eye-state`/`state-word` widths are reserved). In the header: load a long-word sequence and confirm the glyph chip truncates inside `max-width` without pushing the steps text.

- [ ] **Step 5: Reap and deliver**

Kill the vite server from Step 2 (and its npx parent). Close the task-owned browser tab, clear emulation. Then open the REAL surface in the in-app Browser pane (`deliver-in-the-app-browser.md`) — the sequence viewer 3D route on :5173 — as the delivery for Austen, with the evidence screenshots attached as supplements. Note: :5173 only picks up `@austencloud/scene-3d` changes after an Agent Hub restart, but this plan touches app code only, so HMR covers it.

---

### Task 10: Detail dock fits the viewport + tap-outside dismissal

**Why (field report, 2026-08-17):** On a Z Fold 6 (tall content, short screen) the Prop / Planes / Effort / Effects panes grow taller than the viewport. The dock is bottom-anchored, so overflow pushes the top edge — and the X close tab — off-screen: after choosing a prop there is no reachable way to close the panel. Tapping the 3D scene outside the panel is also expected to dismiss it and never was wired up.

**Fix shape:** (a) cap the detail panel to the space between the top of the scene and the transport bar, with ONLY the tab pane content scrolling — identity header stays pinned at top (X stays reachable), tab bar stays pinned at bottom; (b) a window-level pointerdown listener dismisses the open detail when the tap lands outside the hub, with a guard so top-layer `<dialog>` modals (avatar select, sequence picker, confirm dialogs) don't dismiss the dock behind them.

**Execution order note:** runs after Task 8 and BEFORE Task 9 (Task 9's 960x412 and 375x667 sweeps must verify this fix: Prop tab open, X visible, pane content scrolls).

**Files:**
- Modify: `src/lib/shared/3d/components/controls/PerformerHub.svelte`
- Modify: `src/lib/shared/3d/components/controls/PerformerHubDetail.svelte`

- [x] **Step 1: Stretch the anchor so the panel has a height budget**

In `PerformerHub.svelte`, replace the `.hub-anchor` rule and add `pointer-events` handling. The anchor becomes a full-height strip (top of scene to just above the transport bar); it must NOT swallow scene pointer input, so it goes `pointer-events: none` with the two panels opting back in:

```css
.hub-anchor {
  position: absolute;
  top: 12px;
  bottom: 90px;
  left: 16px;
  z-index: 20;
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  /* The anchor spans the scene height so the detail panel can cap to it.
     It must not intercept scene input in the empty area above the panels. */
  pointer-events: none;
}
```

Add to the existing `.spine-panel` rule:

```css
pointer-events: auto;
```

Add to the existing `.detail-panel` rule (keep everything already there):

```css
pointer-events: auto;
display: flex;
max-height: 100%;
```

- [x] **Step 2: Make only the tab pane scroll**

In `PerformerHubDetail.svelte`, extend `.hub-detail` (keep existing declarations):

```css
max-height: 100%;
min-height: 0;
```

and extend `.tab-content` (keep its padding):

```css
overflow-y: auto;
min-height: 0;
overscroll-behavior: contain;
```

`.hub-detail` is a column flex: accent strip, identity header, divider, `.tab-content`, divider, `.tab-bar`. With `min-height: 0` on the scrollable middle, the header and tab bar stay pinned while the pane scrolls. Do NOT put `overflow` on `.hub-detail` itself — that would scroll the close tab and tab bar out of reach, which is the exact bug.

- [x] **Step 3: Tap-outside dismissal**

**Revised during code review (CHANGES_REQUIRED, addressed same day):** the first
pass hand-rolled a `handleOutsidePointer` function whose top-layer exemption
only matched native `<dialog>` elements. `ConfirmDialog.svelte` ("Remove
performer?", opened from inside the open dock) is built on Bits UI's
`Dialog`, which portals its content to `document.body` as a plain `<div
role="dialog" data-dialog-content>` — not a `<dialog>`. A pointerdown on its
Cancel/Remove button fired the capture-phase handler, collapsed the dock, and
unmounted `PerformerHubDetail` (and the `ConfirmDialog` it renders) mid-press.
The same directory already owns a dismiss primitive with an identical
contract — `createSheetDismiss` in `BottomSheet.svelte`
(Escape closes; pointerdown outside the panel closes; inside is ignored;
unit-tested in `__tests__/BottomSheet.test.ts`) — so per
`never-hand-roll.md` the fix extends that owner with an exemption predicate
instead of keeping a duplicate. This also gives the dock Escape-to-close for
free.

In `BottomSheet.svelte`'s module script, extend `createSheetDismiss` with an
optional `isExempt` predicate, honored by BOTH handlers (Escape too — a modal
can capture Escape as easily as a pointerdown):

```ts
export function createSheetDismiss(
  onClose: () => void,
  getPanel: () => HTMLElement | null = () => null,
  isExempt: (target: EventTarget | null) => boolean = () => false,
) {
  return {
    onKeydown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (isExempt(e.target)) return;
      onClose();
    },
    onBackdropPointerDown(e: PointerEvent) {
      const panel = getPanel();
      if (panel && e.target instanceof Node && panel.contains(e.target)) return;
      if (isExempt(e.target)) return;
      onClose();
    },
  };
}
```

`BottomSheet.svelte`'s own call site (`createSheetDismiss(onClose, () => panelEl)`)
passes no predicate, so its behavior is unchanged.

In `PerformerHub.svelte`, import the primitive, add the root element ref, and
replace the hand-rolled handler with a wired-up `dismiss` object (below
`collapseDetail`):

```ts
import { createSheetDismiss } from "./BottomSheet.svelte";

let hubEl = $state<HTMLElement | null>(null);

// Top-layer/portalled modals opened from inside the dock - the sequence
// picker's native <dialog>, and Bits UI dialogs (e.g. the "Remove
// performer?" ConfirmDialog) that portal their content to document.body as
// a plain div - must not dismiss the dock behind them. `contains()` alone
// misses the portalled case since that content never lives inside hubEl.
function isModalTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(
      "dialog, [role='dialog'], [role='alertdialog'], [data-dialog-content]"
    ) !== null
  );
}

const dismiss = createSheetDismiss(collapseDetail, () => hubEl, isModalTarget);
```

Markup — listen at the window in capture phase for pointerdown (scene canvases
may stop propagation of bubbling events) and at bubble phase for keydown, both
gated on the dock being open, and bind the ref on the anchor div:

```svelte
<svelte:window
  onpointerdowncapture={(e) => {
    if (!detailCollapsed) dismiss.onBackdropPointerDown(e);
  }}
  onkeydown={(e) => {
    if (!detailCollapsed) dismiss.onKeydown(e);
  }}
/>

<div class="hub-anchor" bind:this={hubEl} style:--panel-color={performerColor}>
```

Do NOT call `preventDefault` — the same tap that dismisses the panel still
reaches the scene (standard light-dismiss behavior).

**Selector verification:** `ConfirmDialog.svelte` uses `DialogPrimitive.Root`
with no `variant` prop, so Bits UI's `DialogContentState.props` (`bits-ui/dist/bits/dialog/dialog.svelte.js`)
resolves `role: "dialog"` and stamps `data-dialog-content` (via
`getBitsAttr("content")` with `variant` = `"dialog"`) — both alternatives in
the union selector match its portalled content element; the native-`<dialog>`
alternative still covers `BaseModal`-based modals (avatar select, sequence
picker).

**Selector specificity hardening (code review finding 3):** `.hub-anchor {
pointer-events: none }` tied at specificity with the global
`.split-view .persistent-rail > * { pointer-events: auto }` rule (both two
classes after Svelte's scope class) and only won by load order. Changed the
scoped selector from `.hub-anchor` to `div.hub-anchor` (declarations
unchanged) so it wins structurally.

- [x] **Step 4: Typecheck**

Run: `npm run check:fast > /tmp/task10-fix-check.log 2>&1; grep -niE "error" /tmp/task10-fix-check.log | grep -iE "PerformerHub|BottomSheet" || echo CLEAN`
Expected: CLEAN (repo has known pre-existing errors in other sessions' files; only PerformerHub/PerformerHubDetail/BottomSheet matter here).

- [x] **Step 5: Commit**

```bash
git commit -m "fix(3d): dock dismissal reuses sheet-dismiss primitive and spares portal dialogs" -- src/lib/shared/3d/components/controls/PerformerHub.svelte src/lib/shared/3d/components/controls/BottomSheet.svelte src/lib/shared/3d/components/controls/__tests__/BottomSheet.test.ts docs/superpowers/plans/2026-08-18-performer-hub-rethink.md
```

---

## Self-Review Notes (completed)

- **Spec coverage:** dock shell width/gradient → Task 1; TKA glyph everywhere → Tasks 2 + 8; prop grid → Task 3; planes → Task 4; effects width → Task 5; avatar modal + live preview → Task 6; natural-pose thumbnails → Task 7; sequence pane + picker preview → Task 8; out-of-scope items (spine interaction, transport bar, Effort tab) have no tasks by design; verification → Task 9.
- **Type consistency:** `AvatarSelectModal` props (`open`, `currentAvatarId`, `onCommit`, `onClose`) match the Task 6 Step 3 call site; `previewSelection` prop name matches Steps 2/5 of Task 8; `PlanesDiagram` props match the Task 4 Step 2 call site.
- **Known risk (named, not hidden):** Avatar3D idle pose in the modal depends on `enableLocomotion` driving the full-body idle clip with null prop states. If arms T-pose in practice, the fallback inside Task 6 is to keep the stage but investigate Avatar3D's IK-idle interaction — do not ship a T-posing preview.
