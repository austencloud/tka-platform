# Arrange Sidebar Style Unification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify all button/chip styles in the Arrange tab CellEditorPanel into a two-tier system (pill chips + action rects) with shared design tokens, grouped chip layout, and container-query responsiveness.

**Architecture:** CellEditorPanel defines CSS custom properties (tokens) on its root. All child components (ChipGrid, LayerSection, expanded sections) inherit these tokens instead of hard-coding their own `rgba()` values. ChipGrid restructures its flat chip list into 3 labeled groups (View, Timing, Style). A `@container` query adapts layout at narrow widths.

**Tech Stack:** SvelteKit, CSS custom properties, CSS container queries, `cqi` units, `color-mix()`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte` | Modify | Token definitions on `.cell-editor-panel`, footer button token adoption |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte` | Modify | Grouped layout with micro-headers, token adoption, blue chip color fix |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/LayerSection.svelte` | Modify | Add Layer / Paste button token adoption |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffectsSection.svelte` | Modify | Chip style token adoption |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffortSection.svelte` | Modify | Chip style token adoption |
| `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/DisplaySection.svelte` | Modify | Chip style token adoption |

---

### Task 1: Add design tokens to CellEditorPanel

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte:229-336` (style block)

- [ ] **Step 1: Add token custom properties to `.cell-editor-panel`**

In the `<style>` block, replace the existing `.cell-editor-panel` rule with:

```css
.cell-editor-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
  padding: clamp(10px, 2.5cqi, 16px);
  container-type: inline-size;
  container-name: celleditorpanel;

  /* ── Design tokens (inherited by all children) ── */

  /* Shape */
  --chip-radius: 22px;
  --action-radius: 10px;
  --badge-radius: 4px;

  /* Surfaces */
  --surface-idle: rgba(255, 255, 255, 0.05);
  --surface-hover: rgba(255, 255, 255, 0.08);
  --surface-active-pct: 12%;

  /* Strokes */
  --stroke-idle: rgba(255, 255, 255, 0.08);
  --stroke-hover: rgba(255, 255, 255, 0.15);
  --stroke-active-pct: 35%;

  /* Spacing */
  --chip-gap: clamp(6px, 1.5cqi, 8px);
  --group-gap: clamp(10px, 2.5cqi, 14px);
  --section-gap: clamp(12px, 3cqi, 20px);
}
```

- [ ] **Step 2: Update footer button styles to use tokens**

Replace `.panel-footer`, `.footer-btn`, `.copy-all-btn`, `.clear-all-btn` with:

```css
.panel-footer {
  margin-top: auto;
  display: flex;
  gap: var(--chip-gap);
  padding-top: var(--group-gap);
  border-top: 1px solid var(--stroke-idle);
}

.footer-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--chip-gap);
  min-height: 44px;
  padding: 10px 14px;
  border-radius: var(--action-radius);
  font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.copy-all-btn {
  background: var(--surface-idle);
  border: 1px solid var(--stroke-idle);
  color: rgba(255, 255, 255, 0.6);
}

.copy-all-btn:hover {
  background: var(--surface-hover);
  border-color: var(--stroke-hover);
}

.clear-all-btn {
  background: color-mix(in srgb, #ef4444 6%, transparent);
  border: 1px solid color-mix(in srgb, #ef4444 10%, transparent);
  color: rgba(239, 68, 68, 0.6);
}

.clear-all-btn:hover {
  background: color-mix(in srgb, #ef4444 var(--surface-active-pct), transparent);
  border-color: color-mix(in srgb, #ef4444 20%, transparent);
}
```

- [ ] **Step 3: Update badge styles to use token**

Replace `.size-badge` and `.layer-ratio-badge` border-radius with `var(--badge-radius)`.

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS with no new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte
git commit -m "refactor(arrange): add design tokens to CellEditorPanel"
```

---

### Task 2: Restructure ChipGrid into grouped layout

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte` (full file)

- [ ] **Step 1: Restructure chip data into 3 groups**

Replace the single `chips` array with 3 separate group arrays. In the `<script>` block, replace the `const chips` definition (lines 101-175) with:

```typescript
interface ChipDef {
  id: ExpandableSection | null;
  icon: string;
  label: string;
  action: () => void;
  activeColor?: string;
  isActive?: boolean;
  isMuted?: boolean;
  isExpandable: boolean;
}

interface ChipGroup {
  label: string;
  chips: ChipDef[];
}

const groups: ChipGroup[] = $derived([
  {
    label: "View",
    chips: [
      {
        id: "effects" as ExpandableSection,
        icon: "fa-wind",
        label: effectName,
        action: () => panelState.toggleSection("effects"),
        activeColor: hasEffect ? "#f97316" : undefined,
        isActive: hasEffect,
        isExpandable: true,
      },
      {
        id: null,
        icon: blueVisible ? "fa-eye" : "fa-eye-slash",
        label: "Blue",
        action: onToggleBlueVisibility,
        activeColor: blueVisible ? "#60a5fa" : undefined,
        isActive: blueVisible,
        isMuted: !blueVisible,
        isExpandable: false,
      },
      {
        id: null,
        icon: redVisible ? "fa-eye" : "fa-eye-slash",
        label: "Red",
        action: onToggleRedVisibility,
        activeColor: redVisible ? "#dc2626" : undefined,
        isActive: redVisible,
        isMuted: !redVisible,
        isExpandable: false,
      },
    ],
  },
  {
    label: "Timing",
    chips: [
      {
        id: "speed" as ExpandableSection,
        icon: "fa-gauge-high",
        label: speedLabel,
        action: () => panelState.toggleSection("speed"),
        isExpandable: true,
      },
      {
        id: "offset" as ExpandableSection,
        icon: "fa-drum",
        label: offsetLabel,
        action: () => panelState.toggleSection("offset"),
        isExpandable: true,
      },
    ],
  },
  {
    label: "Style",
    chips: [
      {
        id: "transform" as ExpandableSection,
        icon: "fa-rotate",
        label: "Transform",
        action: () => panelState.toggleSection("transform"),
        isExpandable: true,
      },
      {
        id: "colors" as ExpandableSection,
        icon: "fa-palette",
        label: colorLabel,
        action: () => panelState.toggleSection("colors"),
        isExpandable: true,
      },
      {
        id: "effort" as ExpandableSection,
        icon: "",
        label: effortLabel,
        action: () => panelState.toggleSection("effort"),
        activeColor: hasEffort ? effortColor : undefined,
        isActive: hasEffort,
        isExpandable: true,
      },
      {
        id: "display" as ExpandableSection,
        icon: "fa-film",
        label: mediaLabel,
        action: () => panelState.toggleSection("display"),
        isExpandable: true,
      },
    ],
  },
]);
```

Keep the `isExpanded` function unchanged.

- [ ] **Step 2: Update markup to render groups with micro-headers**

Replace the entire `<div class="chip-grid">` block with:

```svelte
<div class="chip-groups">
  {#each groups as group}
    <div class="chip-group">
      <span class="group-label">{group.label}</span>
      <div class="chip-row">
        {#each group.chips as chip}
          <button
            class="chip"
            class:active={chip.isActive && chip.activeColor}
            class:muted={chip.isMuted}
            class:expanded={isExpanded(chip)}
            style:--chip-color={chip.activeColor || "transparent"}
            onclick={chip.action}
            aria-label={chip.label}
          >
            {#if chip.icon}
              <i class="fas {chip.icon} chip-icon" aria-hidden="true"></i>
            {:else}
              <span
                class="effort-dot"
                class:has-effort={hasEffort}
                style:background={hasEffort ? effortColor : undefined}
                style:border-color={hasEffort ? effortColor : undefined}
              ></span>
            {/if}
            <span class="chip-label">{chip.label}</span>
            {#if chip.isExpandable}
              <i
                class="fas fa-chevron-right chevron"
                class:rotated={isExpanded(chip)}
                aria-hidden="true"
              ></i>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>
```

- [ ] **Step 3: Replace styles with token-based versions**

Replace the entire `<style>` block with:

```css
<style>
  .chip-groups {
    display: flex;
    flex-direction: column;
    gap: var(--group-gap, clamp(10px, 2.5cqi, 14px));
  }

  .chip-group {
    display: flex;
    flex-direction: column;
    gap: var(--chip-gap, clamp(6px, 1.5cqi, 8px));
  }

  .group-label {
    font-size: clamp(0.65rem, 2cqi, 0.75rem);
    font-weight: 600;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.5));
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: var(--chip-gap, clamp(6px, 1.5cqi, 8px));
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: clamp(4px, 1cqi, 6px);
    min-height: 44px;
    padding: 8px clamp(12px, 3cqi, 14px);
    border-radius: var(--chip-radius, 22px);
    background: var(--surface-idle, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
    color: var(--theme-text, white);
    font-size: clamp(0.75rem, 2.5cqi, 0.85rem);
    cursor: pointer;
    transition:
      background 150ms ease,
      border-color 150ms ease;
    white-space: nowrap;
  }

  .chip:hover {
    border-color: var(--stroke-hover, rgba(255, 255, 255, 0.15));
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  }

  .chip.active {
    background: color-mix(in srgb, var(--chip-color) var(--surface-active-pct, 12%), transparent);
    border-color: color-mix(in srgb, var(--chip-color) var(--stroke-active-pct, 35%), transparent);
  }

  .chip.active:hover {
    background: color-mix(in srgb, var(--chip-color) 20%, transparent);
    border-color: color-mix(in srgb, var(--chip-color) 50%, transparent);
  }

  .chip.expanded {
    background: var(--surface-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-accent, #8b5cf6);
  }

  .chip.muted {
    background: rgba(255, 255, 255, 0.02);
    border-color: rgba(255, 255, 255, 0.05);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
  }

  .chip.muted:hover {
    background: var(--surface-idle, rgba(255, 255, 255, 0.05));
    border-color: var(--stroke-idle, rgba(255, 255, 255, 0.08));
  }

  .chip-icon {
    font-size: clamp(11px, 3cqi, 13px);
    flex-shrink: 0;
  }

  .chip-label {
    line-height: 1;
  }

  .effort-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  .effort-dot.has-effort {
    background: #a855f7;
    border-color: rgba(168, 85, 247, 0.6);
  }

  .chevron {
    font-size: 8px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.4));
    transition: transform 150ms ease;
    margin-left: 2px;
  }

  .chevron.rotated {
    transform: rotate(90deg);
  }

  /* Narrow sidebar: chips stack single-column */
  @container celleditorpanel (max-width: 280px) {
    .chip {
      flex: 1 0 100%;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chip,
    .chevron {
      transition: none;
    }
  }
</style>
```

- [ ] **Step 4: Run typecheck**

Run: `npm run check`
Expected: PASS with no new errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte
git commit -m "refactor(arrange): group chips into View/Timing/Style with design tokens"
```

---

### Task 3: Update LayerSection action buttons to use tokens

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/LayerSection.svelte:280-332` (style block — action button styles)

- [ ] **Step 1: Replace action button styles**

Replace `.layer-add-actions`, `.add-sequence-btn`, `.add-sequence-btn:hover`, `.paste-btn`, `.paste-btn:hover` with:

```css
.layer-add-actions {
  display: flex;
  flex-direction: column;
  gap: var(--chip-gap, clamp(6px, 1.5cqi, 8px));
  margin-top: clamp(4px, 1cqi, 8px);
}

.add-sequence-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--chip-gap, clamp(6px, 1.5cqi, 8px));
  min-height: 44px;
  padding: 10px 14px;
  background: color-mix(in srgb, #10b981 4%, transparent);
  border: 1px solid color-mix(in srgb, #10b981 10%, transparent);
  border-radius: var(--action-radius, 10px);
  color: rgba(16, 185, 129, 0.55);
  font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.add-sequence-btn:hover {
  background: color-mix(in srgb, #10b981 8%, transparent);
  border-color: color-mix(in srgb, #10b981 20%, transparent);
  color: rgba(16, 185, 129, 0.75);
}

.paste-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--chip-gap, clamp(6px, 1.5cqi, 8px));
  min-height: 44px;
  padding: 10px 14px;
  background: color-mix(in srgb, #8b5cf6 4%, transparent);
  border: 1px solid color-mix(in srgb, #8b5cf6 10%, transparent);
  border-radius: var(--action-radius, 10px);
  color: rgba(167, 139, 250, 0.55);
  font-size: clamp(0.8rem, 2.8cqi, 0.95rem);
  font-weight: 500;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.paste-btn:hover {
  background: color-mix(in srgb, #8b5cf6 8%, transparent);
  border-color: color-mix(in srgb, #8b5cf6 20%, transparent);
  color: rgba(167, 139, 250, 0.75);
}
```

Also update `.layer-chip` border-radius from `10px` to `var(--action-radius, 10px)` and `.chip-action-btn` border-radius from `8px` to `var(--action-radius, 10px)`.

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/LayerSection.svelte
git commit -m "refactor(arrange): LayerSection buttons adopt design tokens"
```

---

### Task 4: Update UnifiedEffectsSection chip styles to use tokens

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffectsSection.svelte:291-518` (style block)

- [ ] **Step 1: Replace chip styles with token-based versions**

Replace `.chip-grid` and `.chip` rules (lines 304-337) with:

```css
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--chip-gap, 6px);
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px clamp(12px, 3cqi, 14px);
  min-height: 44px;
  border-radius: var(--chip-radius, 22px);
  background: var(--surface-idle, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
  color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.chip:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  color: var(--theme-text, rgba(255, 255, 255, 0.9));
}

.chip.active {
  background: color-mix(in srgb, var(--chip-color, #f97316) var(--surface-active-pct, 12%), transparent);
  border-color: color-mix(in srgb, var(--chip-color, #f97316) var(--stroke-active-pct, 35%), transparent);
  color: var(--chip-color, #f97316);
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffectsSection.svelte
git commit -m "refactor(arrange): UnifiedEffectsSection chips adopt design tokens"
```

---

### Task 5: Update UnifiedEffortSection chip styles to use tokens

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffortSection.svelte:241-446` (style block)

- [ ] **Step 1: Replace chip styles with token-based versions**

Replace `.chip-grid` and `.chip` rules (lines 254-287) with:

```css
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--chip-gap, 6px);
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px clamp(12px, 3cqi, 14px);
  min-height: 44px;
  border-radius: var(--chip-radius, 22px);
  background: var(--surface-idle, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
  color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.chip:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  color: var(--theme-text, rgba(255, 255, 255, 0.9));
}

.chip.active {
  background: color-mix(in srgb, var(--chip-color, #a855f7) var(--surface-active-pct, 12%), transparent);
  border-color: color-mix(in srgb, var(--chip-color, #a855f7) var(--stroke-active-pct, 35%), transparent);
  color: var(--chip-color, #a855f7);
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffortSection.svelte
git commit -m "refactor(arrange): UnifiedEffortSection chips adopt design tokens"
```

---

### Task 6: Update DisplaySection chip styles to use tokens

**Files:**
- Modify: `src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/DisplaySection.svelte:52-119` (style block)

- [ ] **Step 1: Replace chip styles with token-based versions**

Replace the `.chip-grid` and `.chip` rules with:

```css
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--chip-gap, 6px);
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px clamp(12px, 3cqi, 14px);
  min-height: 44px;
  border-radius: var(--chip-radius, 22px);
  background: var(--surface-idle, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--stroke-idle, rgba(255, 255, 255, 0.08));
  color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.chip:hover:not(:disabled) {
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  color: var(--theme-text, rgba(255, 255, 255, 0.9));
}

.chip.active {
  background: color-mix(in srgb, #60a5fa var(--surface-active-pct, 12%), transparent);
  border-color: color-mix(in srgb, #60a5fa var(--stroke-active-pct, 35%), transparent);
  color: #60a5fa;
}

.chip.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/DisplaySection.svelte
git commit -m "refactor(arrange): DisplaySection chips adopt design tokens"
```

---

### Task 7: Final typecheck + build verification

**Files:** All modified files from Tasks 1-6

- [ ] **Step 1: Run full typecheck**

Run: `npm run check`
Expected: PASS with zero errors

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Verify success criteria**

Grep for hard-coded border-radius values in modified files:

```bash
grep -n "border-radius:" src/lib/features/compose/tabs/arrange/components/grid/cell-editor/ChipGrid.svelte src/lib/features/compose/tabs/arrange/components/grid/cell-editor/CellEditorPanel.svelte src/lib/features/compose/tabs/arrange/components/grid/cell-editor/LayerSection.svelte src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffectsSection.svelte src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/UnifiedEffortSection.svelte src/lib/features/compose/tabs/arrange/components/grid/cell-editor/sections/DisplaySection.svelte
```

Verify:
- Only `22px` (via `--chip-radius`) and `10px` (via `--action-radius`) appear for interactive elements
- No orphaned `rgba(255, 255, 255, 0.03)` or `0.04` or `0.06` in chip/button styles (tokens replace these)
- Blue chip uses `#60a5fa` not `#2563eb`
