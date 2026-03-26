# Workshop Portfolio Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the workshop cards from an admin-panel CRUD layout into a showcase-first portfolio with tall portrait cards, geometric hero areas, prop icons, and no visible action buttons.

**Architecture:** Two-file change. `WorkshopTemplateCard.svelte` gets a complete rewrite (new layout, hero pattern, prop icons). `WorkshopPortfolioEditor.svelte` gets grid CSS updates and a "Copy Description" button added to the modal footer. No data model or persistence changes.

**Tech Stack:** Svelte 5, CSS custom properties, Font Awesome icons

**Spec:** `docs/superpowers/specs/2026-03-26-workshop-portfolio-redesign-design.md`

---

### Task 1: Rewrite WorkshopTemplateCard.svelte

**Files:**
- Rewrite: `src/lib/features/festivals/components/portfolio/WorkshopTemplateCard.svelte`

This is the core of the redesign. The card goes from wide CRUD card to tall portrait showcase card.

- [ ] **Step 1: Replace the Props interface**

The card no longer has `onedit`, `ondelete`, or `oncopy` callbacks. Clicking the card itself is the only interaction, handled by the parent. Replace with:

```typescript
<script lang="ts">
  import type { WorkshopTemplate, WorkshopLevel } from "../../domain/models/teaching-portfolio";

  interface Props {
    workshop: WorkshopTemplate;
    onclick: () => void;
  }

  let { workshop, onclick }: Props = $props();

  const levelColors: Record<WorkshopLevel, string> = {
    introductory: "#a78bfa",
    beginner: "#22c55e",
    intermediate: "#eab308",
    advanced: "#ef4444",
    mixed: "#3b82f6",
  };

  const levelColor = $derived(levelColors[workshop.level] ?? "var(--theme-accent, #6366f1)");
</script>
```

- [ ] **Step 2: Add the prop icon mapping**

Below the `levelColor` derived, add the prop-to-icon mapping with case-insensitive alias matching:

```typescript
  const PROP_ICONS: Record<string, string> = {
    "double-staves": "fa-grip-lines-vertical",
    "staves": "fa-grip-lines-vertical",
    "staff": "fa-grip-lines-vertical",
    "double staves": "fa-grip-lines-vertical",
    "clubs": "fa-baseball-bat-ball",
    "club": "fa-baseball-bat-ball",
    "mixed-static-props": "fa-shapes",
    "mixed props": "fa-shapes",
    "mixed": "fa-shapes",
    "contact-ball": "fa-circle",
    "contact": "fa-circle",
    "cj": "fa-circle",
    "crystal ball": "fa-circle",
    "balloons": "fa-wind",
    "balloon": "fa-wind",
    "poi": "fa-yin-yang",
    "fans": "fa-fan",
    "fan": "fa-fan",
    "buugeng": "fa-infinity",
    "s-staff": "fa-infinity",
  };

  function getPropIcon(prop: string): string {
    return PROP_ICONS[prop.toLowerCase().trim()] ?? "fa-circle-dot";
  }
```

- [ ] **Step 3: Add geometric pattern generation**

Add a function that derives pattern element positions from the workshop ID:

```typescript
  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 8); i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  interface PatternCircle {
    size: number;
    top: number;
    left: number;
  }

  interface PatternLine {
    width: number;
    top: number;
    left: number;
    angle: number;
  }

  const patternSeed = $derived(hashCode(workshop.id));

  const circles = $derived.by<PatternCircle[]>(() => {
    const seed = patternSeed;
    const count = (seed % 2) + 2;
    return Array.from({ length: count }, (_, i) => ({
      size: 30 + (((seed >> (i * 3)) % 7) * 10),
      top: ((seed >> (i * 4 + 1)) % 80) - 10,
      left: ((seed >> (i * 5 + 2)) % 90) - 5,
    }));
  });

  const lines = $derived.by<PatternLine[]>(() => {
    const seed = patternSeed;
    const count = (seed % 2) + 2;
    return Array.from({ length: count }, (_, i) => ({
      width: 50 + (((seed >> (i * 3 + 7)) % 7) * 12),
      top: 20 + (((seed >> (i * 4 + 8)) % 6) * 12),
      left: ((seed >> (i * 5 + 9)) % 80) - 5,
      angle: -40 + (((seed >> (i * 3 + 10)) % 9) * 10),
    }));
  });
```

- [ ] **Step 4: Write the new template markup**

Replace the entire template section (everything between `</script>` and `<style>`) with:

```svelte
<button
  class="workshop-card level-{workshop.level}"
  style="--level-color: {levelColor}"
  onclick={onclick}
  type="button"
>
  <div class="level-accent"></div>

  <div class="card-hero">
    <div class="card-pattern">
      {#each circles as circle}
        <div
          class="pattern-circle"
          style="width:{circle.size}px;height:{circle.size}px;top:{circle.top}%;left:{circle.left}%"
        ></div>
      {/each}
      {#each lines as line}
        <div
          class="pattern-line"
          style="width:{line.width}px;top:{line.top}%;left:{line.left}%;transform:rotate({line.angle}deg)"
        ></div>
      {/each}
    </div>

    {#if workshop.props.length > 0}
      <div class="card-props">
        {#each workshop.props as prop (prop)}
          <span class="prop-icon" title={prop}>
            <i class="fas {getPropIcon(prop)}" aria-hidden="true"></i>
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <div class="card-info">
    <h4 class="card-title">{workshop.title}</h4>
    {#if workshop.description}
      <p class="card-teaser">{workshop.description}</p>
    {/if}
  </div>

  <div class="card-meta">
    <span class="level-dot"></span>
    <span class="level-label">{workshop.level}</span>
    <span class="solo-badge">{workshop.solo ? "Solo" : "Partner"}</span>
  </div>
</button>
```

Key: the root element is now a `<button>` for accessibility (entire card is clickable, keyboard-navigable by default).

- [ ] **Step 5: Write the new styles**

Replace the entire `<style>` block with:

```css
<style>
  .workshop-card {
    all: unset;
    display: flex;
    flex-direction: column;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-lg, 12px);
    overflow: hidden;
    cursor: pointer;
    transition: border-color var(--transition-fast, 0.15s),
      transform var(--transition-fast, 0.15s),
      box-shadow var(--transition-fast, 0.15s);
    position: relative;
    text-align: left;
  }

  .workshop-card:hover {
    border-color: color-mix(in srgb, var(--level-color) 40%, transparent);
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
  }

  .workshop-card:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ── Level accent line ──────────────────────────────── */

  .level-accent {
    height: 3px;
    background: linear-gradient(90deg, var(--level-color), color-mix(in srgb, var(--level-color) 50%, transparent));
  }

  /* ── Hero area ──────────────────────────────────────── */

  .card-hero {
    height: 120px;
    position: relative;
    overflow: hidden;
  }

  .card-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at 30% 20%, var(--level-color), transparent 70%);
    opacity: 0.12;
  }

  .card-hero::after {
    content: "";
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 70%;
    background: linear-gradient(to top, var(--theme-card-bg, rgba(13, 13, 26, 0.95)), transparent);
  }

  /* ── Geometric pattern ──────────────────────────────── */

  .card-pattern {
    position: absolute;
    inset: 0;
    overflow: hidden;
    opacity: 0.15;
    color: var(--level-color);
  }

  .pattern-circle {
    position: absolute;
    border-radius: 50%;
    border: 2px solid currentColor;
  }

  .pattern-line {
    position: absolute;
    height: 1px;
    background: currentColor;
    transform-origin: left center;
  }

  /* ── Prop icons ─────────────────────────────────────── */

  .card-props {
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 6px;
    z-index: 2;
  }

  .prop-icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-compact, 12px);
    color: rgba(255, 255, 255, 0.7);
  }

  /* ── Card info ──────────────────────────────────────── */

  .card-info {
    padding: 14px 14px 8px;
  }

  .card-title {
    margin: 0;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    line-height: 1.3;
    color: var(--theme-text, #ffffff);
  }

  .card-teaser {
    margin: 6px 0 0;
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.4));
    line-height: 1.4;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Meta footer ────────────────────────────────────── */

  .card-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px 12px;
  }

  .level-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--level-color);
    flex-shrink: 0;
  }

  .level-label {
    font-size: var(--font-size-compact, 12px);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.35));
  }

  .solo-badge {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-secondary, rgba(255, 255, 255, 0.25));
    margin-left: auto;
  }

  /* ── Reduced motion ─────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .workshop-card {
      transition: none;
    }

    .workshop-card:hover {
      transform: none;
      box-shadow: none;
    }
  }
</style>
```

- [ ] **Step 6: Build and verify no TypeScript errors**

Run: `npm run check`
Expected: No errors in `WorkshopTemplateCard.svelte`

- [ ] **Step 7: Commit**

```bash
git add src/lib/features/festivals/components/portfolio/WorkshopTemplateCard.svelte
git commit -m "feat(festivals): rewrite workshop card as portrait showcase"
```

---

### Task 2: Update WorkshopPortfolioEditor.svelte

**Files:**
- Modify: `src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte`

Update the parent to match the new card API and grid layout.

- [ ] **Step 1: Update the card usage in the workshop list**

In the template (around line 293-300), change the `WorkshopTemplateCard` usage. The card now takes `onclick` instead of `onedit`/`ondelete`/`oncopy`:

Replace:
```svelte
<WorkshopTemplateCard
  {workshop}
  onedit={() => openEditWorkshopForm(workshop)}
  ondelete={() => deleteWorkshop(workshop.id)}
  oncopy={() => {}}
/>
```

With:
```svelte
<WorkshopTemplateCard
  {workshop}
  onclick={() => openEditWorkshopForm(workshop)}
/>
```

- [ ] **Step 2: Update the workshop grid CSS**

Change `.workshop-list` grid to portrait-friendly columns. Replace:

```css
.workshop-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(400px, 100%), 1fr));
  gap: 1rem;
}
```

With:

```css
.workshop-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}
```

- [ ] **Step 3: Update the add button styling**

Change the `.add-btn` from dashed border to accent-colored solid styling. Replace the existing `.add-btn` styles:

```css
.add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: color-mix(in srgb, var(--theme-accent, #6366f1) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--theme-accent, #6366f1) 30%, transparent);
  border-radius: 8px;
  color: var(--theme-accent, #6366f1);
  font-size: var(--font-size-sm, 14px);
  cursor: pointer;
  transition: background var(--transition-fast, 0.15s);
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.add-btn:not(:disabled):hover {
  background: color-mix(in srgb, var(--theme-accent, #6366f1) 25%, transparent);
}
```

- [ ] **Step 4: Add "Copy Description" and "Delete" buttons to the modal footer**

The modal footer needs Copy and Delete buttons (only visible when editing). Delete was previously on the card — it now lives here. Also update `.workshop-modal-footer` CSS to allow the spacer pattern.

In the modal footer section (around line 598-603), replace:
```svelte
<div class="workshop-modal-footer">
  <button class="cancel-btn" onclick={cancelWorkshopForm}>Cancel</button>
  <button class="save-btn" onclick={saveWorkshopForm} disabled={!wTitle.trim()}>
    {editingWorkshopId ? "Save Changes" : "Add Workshop"}
  </button>
</div>
```

With:
```svelte
<div class="workshop-modal-footer">
  {#if editingWorkshopId}
    <button
      class="modal-action-btn"
      onclick={() => navigator.clipboard.writeText(wDescription)}
      title="Copy description to clipboard"
      type="button"
    >
      <i class="fas fa-copy" aria-hidden="true"></i>
      Copy
    </button>
    <button
      class="modal-action-btn danger"
      onclick={() => { deleteWorkshop(editingWorkshopId); cancelWorkshopForm(); }}
      title="Delete this workshop"
      type="button"
    >
      <i class="fas fa-trash" aria-hidden="true"></i>
      Delete
    </button>
  {/if}
  <div class="modal-footer-spacer"></div>
  <button class="cancel-btn" onclick={cancelWorkshopForm}>Cancel</button>
  <button class="save-btn" onclick={saveWorkshopForm} disabled={!wTitle.trim()}>
    {editingWorkshopId ? "Save Changes" : "Add Workshop"}
  </button>
</div>
```

Update the `.workshop-modal-footer` CSS to remove `justify-content: flex-end` (the spacer handles alignment now), and add the new button styles:

Replace:
```css
.workshop-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
}
```

With:
```css
.workshop-modal-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
}

.modal-footer-spacer {
  flex: 1;
}

.modal-action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  background: none;
  border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.15));
  border-radius: 5px;
  color: var(--theme-text-secondary, rgba(255, 255, 255, 0.6));
  font-size: var(--font-size-compact, 12px);
  cursor: pointer;
  transition: color var(--transition-fast, 0.15s), border-color var(--transition-fast, 0.15s);
}

.modal-action-btn:hover {
  color: var(--theme-text, #ffffff);
  border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.25));
}

.modal-action-btn.danger:hover {
  color: var(--semantic-error, #ef4444);
  border-color: var(--semantic-error, #ef4444);
}
```

- [ ] **Step 5: Build and verify**

Run: `npm run check`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/lib/features/festivals/components/portfolio/WorkshopPortfolioEditor.svelte
git commit -m "feat(festivals): update workshop grid and modal for showcase redesign"
```

---

### Task 3: Visual Verification

**Files:** None (verification only)

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Ask user to verify visually**

Tell the user: "The workshop portfolio redesign is implemented. Please check localhost:5173/festivals/workshops and tell me if the cards look right — tall portrait cards with geometric patterns, prop icons, subtle level accents, and no action buttons."

Do NOT use Playwright. The user's eyes are the test.
