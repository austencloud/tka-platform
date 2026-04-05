/**
 * Viewer 3D Context Menu Builder
 *
 * Reads current state from AnimationVisibilityStateManager and produces
 * ContextMenuEntry[] for the 3D viewer right-click menu.
 *
 * Submenu groups:
 *   - Effects: None, Fire, Charcoal, LED, Trails (radio-style, one active)
 *   - Visibility: Props, Beat #s, TKA Glyph, Word Header, Progress Bar (toggles)
 *   - Grid: Off / 8-Point / Auto (radio-style)
 *
 * Plus: Exit 3D View action.
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";
import type {
  AnimationVisibilityStateManager,
  GridMode,
} from "$lib/shared/animation-engine/state/animation-visibility-state.svelte";

type ActiveEffect = "fire" | "charcoal" | "led" | "trails" | "none";

interface Viewer3DContextMenuDeps {
  visibilityManager: AnimationVisibilityStateManager;
  onExit3D: () => void;
}

function buildEffectChildren(
  vm: AnimationVisibilityStateManager,
  active: ActiveEffect
): ContextMenuItem[] {
  return [
    {
      id: "v3d-effect-none",
      label: "None",
      icon: "fa-ban",
      checked: active === "none",
      keepOpen: true,
      action: () => vm.setActiveEffect("none"),
    },
    {
      id: "v3d-effect-fire",
      label: "Fire",
      icon: "fa-fire-flame-curved",
      iconColor: "#f97316",
      checked: active === "fire",
      keepOpen: true,
      action: () => vm.setActiveEffect("fire"),
    },
    {
      id: "v3d-effect-charcoal",
      label: "Charcoal",
      icon: "fa-fire",
      iconColor: "#a855f7",
      checked: active === "charcoal",
      keepOpen: true,
      action: () => vm.setActiveEffect("charcoal"),
    },
    {
      id: "v3d-effect-led",
      label: "LED",
      icon: "fa-lightbulb",
      iconColor: "#22c55e",
      checked: active === "led",
      keepOpen: true,
      action: () => vm.setActiveEffect("led"),
    },
    {
      id: "v3d-effect-trails",
      label: "Trails",
      icon: "fa-route",
      checked: active === "trails",
      keepOpen: true,
      action: () => vm.setActiveEffect("trails"),
    },
  ];
}

function buildVisibilityChildren(
  vm: AnimationVisibilityStateManager
): ContextMenuItem[] {
  const settings = vm.getSettings();
  return [
    {
      id: "v3d-vis-props",
      label: "Props",
      icon: "fa-wand-sparkles",
      checked: settings.props,
      keepOpen: true,
      action: () => vm.toggleVisibility("props"),
    },
    {
      id: "v3d-vis-beat-numbers",
      label: "Beat #s",
      icon: "fa-hashtag",
      checked: settings.stepNumbers,
      keepOpen: true,
      action: () => vm.toggleVisibility("stepNumbers"),
    },
    {
      id: "v3d-vis-tka-glyph",
      label: "TKA Glyph",
      icon: "fa-font",
      checked: settings.tkaGlyph,
      keepOpen: true,
      action: () => vm.toggleVisibility("tkaGlyph"),
    },
    {
      id: "v3d-vis-word-header",
      label: "Word Header",
      icon: "fa-heading",
      checked: settings.wordHeader,
      keepOpen: true,
      action: () => vm.toggleVisibility("wordHeader"),
    },
    {
      id: "v3d-vis-progress-bar",
      label: "Progress Bar",
      icon: "fa-bars-progress",
      checked: settings.progressBar,
      keepOpen: true,
      action: () => vm.toggleVisibility("progressBar"),
    },
  ];
}

function buildGridChildren(
  vm: AnimationVisibilityStateManager
): ContextMenuItem[] {
  const current: GridMode = vm.getGridMode();
  return [
    {
      id: "v3d-grid-none",
      label: "Off",
      icon: "fa-border-none",
      checked: current === "none",
      keepOpen: true,
      action: () => vm.setGridMode("none"),
    },
    {
      id: "v3d-grid-8point",
      label: "8-Point",
      icon: "fa-diamond",
      checked: current === "8point",
      keepOpen: true,
      action: () => vm.setGridMode("8point"),
    },
    {
      id: "v3d-grid-auto",
      label: "Auto",
      icon: "fa-wand-magic",
      checked: current === "auto",
      keepOpen: true,
      action: () => vm.setGridMode("auto"),
    },
  ];
}

export function buildViewer3DContextMenuItems(
  deps: Viewer3DContextMenuDeps
): ContextMenuEntry[] {
  const vm = deps.visibilityManager;
  const active = vm.getActiveEffect() as ActiveEffect;

  return [
    {
      id: "v3d-effects-submenu",
      label: "Effects",
      icon: "fa-wand-magic-sparkles",
      children: buildEffectChildren(vm, active),
    },
    {
      id: "v3d-visibility-submenu",
      label: "Visibility",
      icon: "fa-eye",
      children: buildVisibilityChildren(vm),
    },
    {
      id: "v3d-grid-submenu",
      label: "Grid",
      icon: "fa-border-all",
      children: buildGridChildren(vm),
    },
    { type: "separator" as const },
    {
      id: "v3d-exit-3d",
      label: "Exit 3D View",
      icon: "fa-right-from-bracket",
      action: () => deps.onExit3D(),
    },
  ];
}
