# Canvas Context Menu: Effects & Efforts Submenus — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the canvas context menu from flat effect toggles into two submenu groups (Effects and Efforts) for quick switching.

**Architecture:** Replace the 4 flat effect items in `buildCanvasContextMenuItems()` with two parent `ContextMenuItem` entries that use `children` arrays. The existing submenu rendering in `ContextMenu.svelte` handles the rest. Import `EFFORTS` from the effort-lab domain for effort metadata.

**Tech Stack:** TypeScript, Svelte 5, existing ContextMenu submenu infrastructure

**Spec:** `docs/superpowers/specs/2026-03-11-canvas-context-menu-effects-efforts-design.md`

---

## Chunk 1: Implementation

### Task 1: Rewrite CanvasContextMenuBuilder with Effects and Efforts submenus

**Files:**
- Modify: `src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts`

- [ ] **Step 1: Update the file header comment and imports**

Add import for `EFFORTS` and `EffortId`. Update the doc comment to reflect the new structure.

```typescript
/**
 * Canvas Context Menu Builder
 *
 * Reads current state from AnimationVisibilityStateManager and produces
 * ContextMenuEntry[] for the animation canvas right-click menu.
 *
 * Two submenu groups:
 *   - Effects: None, Fire, Charcoal, LED, Trails (radio-style, one active)
 *   - Efforts: 8 effort presets from the effort-lab domain (radio-style)
 *
 * Plus: Disassemble toggle, Canvas Settings launcher.
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
```

- [ ] **Step 2: Add helper to detect which effect is active**

Add this above `buildCanvasContextMenuItems`:

```typescript
type ActiveEffect = "fire" | "charcoal" | "led" | "trails" | "none";

function getActiveEffect(vm: AnimationVisibilityStateManager): ActiveEffect {
  const s = vm.getSettings();
  if (s.fireEffect) return "fire";
  if (s.charcoalEffect) return "charcoal";
  if (s.ledEffect) return "led";
  if (s.trailStyle !== "off") return "trails";
  return "none";
}
```

- [ ] **Step 3: Add helper to build effect children**

```typescript
function buildEffectChildren(
  vm: AnimationVisibilityStateManager,
  active: ActiveEffect
): ContextMenuItem[] {
  return [
    {
      id: "effect-none",
      label: "None",
      icon: "fa-ban",
      checked: active === "none",
      action: () => {
        vm.setFireEffect(false);
        vm.setCharcoalEffect(false);
        vm.setLedEffect(false);
        vm.setTrailStyle("off");
      },
    },
    {
      id: "effect-fire",
      label: "Fire",
      icon: "fa-fire-flame-curved",
      iconColor: "#f97316",
      checked: active === "fire",
      action: () => vm.setFireEffect(true),
    },
    {
      id: "effect-charcoal",
      label: "Charcoal",
      icon: "fa-fire",
      iconColor: "#a855f7",
      checked: active === "charcoal",
      action: () => vm.setCharcoalEffect(true),
    },
    {
      id: "effect-led",
      label: "LED",
      icon: "fa-lightbulb",
      iconColor: "#22c55e",
      checked: active === "led",
      action: () => vm.setLedEffect(true),
    },
    {
      id: "effect-trails",
      label: "Trails",
      icon: "fa-route",
      checked: active === "trails",
      action: () => vm.setTrailStyle("on"),
    },
  ];
}
```

- [ ] **Step 4: Add helper to build effort children**

```typescript
function buildEffortChildren(
  vm: AnimationVisibilityStateManager,
  currentEffort: EffortId
): ContextMenuItem[] {
  return EFFORTS.map((effort) => ({
    id: `effort-${effort.id}`,
    label: effort.label,
    icon: "fa-circle",
    iconColor: effort.color,
    checked: currentEffort === effort.id,
    action: () => vm.setEffortPreset(effort.id),
  }));
}
```

- [ ] **Step 5: Rewrite buildCanvasContextMenuItems**

Replace the entire return array:

```typescript
export function buildCanvasContextMenuItems(
  deps: CanvasContextMenuDeps
): ContextMenuEntry[] {
  const vm = deps.visibilityManager;
  const settings = vm.getSettings();
  const active = getActiveEffect(vm);

  return [
    {
      id: "effects-submenu",
      label: "Effects",
      icon: "fa-wand-magic-sparkles",
      children: buildEffectChildren(vm, active),
    },
    {
      id: "efforts-submenu",
      label: "Efforts",
      icon: "fa-gauge",
      children: buildEffortChildren(vm, settings.effortPreset),
    },
    { type: "separator" as const },
    ...(deps.onToggleDisassemble
      ? [
          {
            id: "toggle-disassemble",
            label: deps.disassembled ? "Reassemble" : "Disassemble",
            icon: deps.disassembled ? "fa-compress" : "fa-table-columns",
            checked: deps.disassembled,
            action: () => deps.onToggleDisassemble!(),
          },
          { type: "separator" as const },
        ]
      : []),
    {
      id: "open-canvas-settings",
      label: "Canvas Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenPanel("display"),
    },
  ];
}
```

- [ ] **Step 6: Run typecheck**

Run: `npm run check`
Expected: No new errors. The import paths and types should all resolve.

- [ ] **Step 7: Commit**

```bash
git add src/lib/shared/animation-engine/components/canvas-context-menu/CanvasContextMenuBuilder.ts
git commit -m "feat(canvas-menu): restructure effects as submenu, add efforts submenu"
```

### Task 2: Verify in browser

- [ ] **Step 1: Manual verification**

Right-click the animation canvas. Verify:
1. "Effects" parent item appears with chevron indicator
2. Hovering "Effects" opens submenu with None, Fire, Charcoal, LED, Trails
3. Current effect has checkmark
4. Selecting an effect closes the menu and activates it
5. "None" clears all effects
6. "Efforts" parent item appears with chevron indicator
7. Hovering "Efforts" opens submenu with all 8 effort presets
8. Current effort has checkmark
9. Selecting an effort closes the menu and changes the easing
10. Disassemble and Canvas Settings still work
