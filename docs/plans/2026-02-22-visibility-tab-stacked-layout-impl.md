# Visibility Tab — Stacked Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 3-column Visibility tab layout with vertically stacked sections where each panel shows a large preview (up to 500px) beside its controls.

**Architecture:** Each of the 3 panels (Pictograph, Animation, Image) switches from a vertical column layout to a horizontal row layout on desktop. The VisibilityTab container always stacks panels vertically. Each panel gets a collapse toggle in its header.

**Tech Stack:** Svelte 5, CSS container queries, `svelte/transition` slide

---

### Task 1: Update VisibilityTab container to always stack vertically

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/VisibilityTab.svelte:457-483`

The current CSS switches `.visibility-panels-container` to `flex-direction: row` at 700px. Remove that row switch so panels always stack vertically. Keep the mobile segment control hide and the `.mobile-hidden` override.

**Step 1: Edit the CSS**

In `VisibilityTab.svelte`, replace the desktop container query block (lines 472-483):

```css
/* Desktop: Side by side - all panels match tallest panel's height */
@container visibility-tab (min-width: 700px) {
  .visibility-panels-container {
    flex-direction: row;
    /* Stretch all panels to match the tallest (Animation panel) */
    align-items: stretch;
  }

  /* Show all panels on desktop regardless of mobile mode */
  .visibility-panels-container :global(.mobile-hidden) {
    display: flex !important;
  }
}
```

With:

```css
/* Desktop: Show all panels regardless of mobile mode */
@container visibility-tab (min-width: 700px) {
  .visibility-panels-container :global(.mobile-hidden) {
    display: flex !important;
  }
}
```

The panels container keeps its default `flex-direction: column` at all widths.

**Step 2: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -c "Error"`
Expected: Same error count as before (no new errors)

**Step 3: Commit**

```bash
git add src/lib/shared/settings/components/tabs/VisibilityTab.svelte
git commit -m "refactor(visibility): stack panels vertically on desktop"
```

---

### Task 2: Convert PictographPanel to horizontal layout with collapse

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/visibility/PictographPanel.svelte`

**Step 1: Add collapse state and update template**

Add to the `<script>` block after the `$props()` destructure:

```typescript
let collapsed = $state(false);
```

Replace the current template (everything inside `<section>`) with this structure:

```svelte
<section
  class="settings-panel pictograph-panel"
  class:mobile-hidden={isMobileHidden}
>
  <header class="panel-header">
    <span class="panel-icon pictograph-icon">
      <i class="fas fa-image" aria-hidden="true"></i>
    </span>
    <h3 class="panel-title">{t("visibility_pictograph")}</h3>
    <button
      class="collapse-toggle"
      onclick={() => (collapsed = !collapsed)}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand pictograph settings" : "Collapse pictograph settings"}
      type="button"
    >
      <i class="fas {collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" aria-hidden="true"></i>
    </button>
  </header>

  {#if !collapsed}
    <div class="panel-body" transition:slide={{ duration: 200 }}>
      <div class="preview-frame">
        <PictographWithVisibility
          pictographData={examplePictographData}
          forceShowAll={true}
          previewMode={true}
          onToggleTKA={() => onToggle("tka")}
          onToggleVTG={() => onToggle("vtg")}
          onToggleElemental={() => onToggle("elemental")}
          onTogglePositions={() => onToggle("positions")}
          onToggleReversals={() => onToggle("reversals")}
          onToggleNonRadial={() => onToggle("nonRadial")}
        />
      </div>

      <div class="panel-controls">
        <!-- existing control-group contents unchanged -->
      </div>
    </div>
  {/if}
</section>
```

Key: The existing `.panel-controls` children (control-group, toggle-grid, toggle buttons) stay exactly as they are. Just wrap `.preview-frame` + `.panel-controls` in a `.panel-body` div.

**Step 2: Update CSS**

Replace the `.settings-panel` flex rules. The panel no longer centers children vertically — it's a card with a header and a horizontal body.

Key CSS changes:

1. `.settings-panel` — Remove `align-items: center`. Keep flex column.

2. Add `.panel-body`:
```css
.panel-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: clamp(12px, 2cqi, 16px);
  width: 100%;
}
```

3. `.preview-frame` — Change `max-width` from `280px` to `500px`.

4. Add `.collapse-toggle`:
```css
.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--theme-text-dim);
  cursor: pointer;
  border-radius: 6px;
  transition: all var(--duration-fast) ease;
  flex-shrink: 0;
}

.collapse-toggle:hover {
  background: color-mix(in srgb, var(--theme-text-dim) 15%, transparent);
  color: var(--theme-text);
}

.collapse-toggle:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
  outline-offset: 2px;
}
```

5. Add container query for horizontal layout when the panel is wide enough:
```css
@container pictograph-panel (min-width: 500px) {
  .panel-body {
    flex-direction: row;
    align-items: flex-start;
  }

  .preview-frame {
    flex-shrink: 0;
    width: 50%;
    max-width: 500px;
  }

  .panel-controls {
    flex: 1;
    margin-top: 0;
  }
}
```

6. Add `.collapse-toggle` to the `prefers-reduced-motion` media query.

**Step 3: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -c "Error"`
Expected: Same error count as before

**Step 4: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/PictographPanel.svelte
git commit -m "refactor(visibility): horizontal layout with collapse for PictographPanel"
```

---

### Task 3: Convert AnimationPanel to horizontal layout with collapse

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte`

Apply the same pattern as Task 2:

**Step 1: Add collapse state**

Add after the `$props()` destructure:

```typescript
let collapsed = $state(false);
```

**Step 2: Update template**

Wrap the `.preview-frame.animation-preview` and `.panel-controls` divs in a new `.panel-body` div with `{#if !collapsed}` and `transition:slide`. Add the collapse toggle button to the header (same markup as Task 2, with `aria-label` referencing "animation settings").

The inner contents of `.panel-controls` (the mobile-layout and desktop-layout divs) stay exactly as they are.

```svelte
<header class="panel-header">
  <span class="panel-icon animation-icon">
    <i class="fas fa-film" aria-hidden="true"></i>
  </span>
  <h3 class="panel-title">{t("visibility_animation")}</h3>
  <button
    class="collapse-toggle"
    onclick={() => (collapsed = !collapsed)}
    aria-expanded={!collapsed}
    aria-label={collapsed ? "Expand animation settings" : "Collapse animation settings"}
    type="button"
  >
    <i class="fas {collapsed ? 'fa-chevron-right' : 'fa-chevron-down'}" aria-hidden="true"></i>
  </button>
</header>

{#if !collapsed}
  <div class="panel-body" transition:slide={{ duration: 200 }}>
    <div class="preview-frame animation-preview">
      <AnimationPreviewController />
    </div>

    <div class="panel-controls">
      <!-- existing mobile-layout and desktop-layout divs unchanged -->
    </div>
  </div>
{/if}
```

**Step 3: Update CSS**

Same changes as Task 2 but with `animation-panel` container name:

1. `.settings-panel` — Remove `align-items: center`
2. Add `.panel-body` (same as Task 2)
3. `.preview-frame` — Change `max-width` from `280px` to `500px`
4. Add `.collapse-toggle` (same as Task 2)
5. Add container query:

```css
@container animation-panel (min-width: 500px) {
  .panel-body {
    flex-direction: row;
    align-items: flex-start;
  }

  .preview-frame {
    flex-shrink: 0;
    width: 50%;
    max-width: 500px;
  }

  .panel-controls {
    flex: 1;
    margin-top: 0;
  }
}
```

6. Add `.collapse-toggle` to `prefers-reduced-motion` media query.

**Step 4: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -c "Error"`

**Step 5: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/AnimationPanel.svelte
git commit -m "refactor(visibility): horizontal layout with collapse for AnimationPanel"
```

---

### Task 4: Convert ImagePanel to horizontal layout with collapse

**Files:**
- Modify: `src/lib/shared/settings/components/tabs/visibility/ImagePanel.svelte`

Apply the same pattern as Tasks 2-3:

**Step 1: Add collapse state**

Add after the `$props()` destructure:

```typescript
let collapsed = $state(false);
```

**Step 2: Update template**

Same pattern: wrap `.preview-frame.image-preview` and `.panel-controls` in `.panel-body` with `{#if !collapsed}` and `transition:slide`. Add collapse toggle to header.

**Step 3: Update CSS**

Same changes with `image-panel` container name:

1. `.settings-panel` — Remove `align-items: center`
2. Add `.panel-body` (same)
3. `.preview-frame` — Change `max-width` from `280px` to `500px`
4. Add `.collapse-toggle` (same)
5. Add container query at 500px for horizontal layout (same pattern)
6. Add `.collapse-toggle` to `prefers-reduced-motion` media query

**Step 4: Run typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json 2>&1 | grep -c "Error"`

**Step 5: Commit**

```bash
git add src/lib/shared/settings/components/tabs/visibility/ImagePanel.svelte
git commit -m "refactor(visibility): horizontal layout with collapse for ImagePanel"
```

---

### Task 5: Build verification

**Step 1: Full typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json`
Expected: No new errors from our changes

**Step 2: Build**

Run: `npm run build`
Expected: Exit code 0

**Step 3: Visual check prompt**

Tell the user: "Please open localhost:5173/settings/visibility and verify:
1. Panels stack vertically (not side by side)
2. Each panel shows preview on the left, controls on the right (on desktop)
3. Previews are much larger than before (~500px max)
4. Collapse chevrons work — clicking collapses/expands each section
5. Mobile (resize to <700px) still shows segment control and one panel at a time"
