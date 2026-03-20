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

export type SettingsPanelCategory = "fire" | "led" | "display";

interface CanvasContextMenuDeps {
  visibilityManager: AnimationVisibilityStateManager;
  onOpenPanel: (category: SettingsPanelCategory) => void;
  disassembled?: boolean;
  onToggleDisassemble?: () => void;
}

type ActiveEffect = "fire" | "charcoal" | "led" | "trails" | "none";

function getActiveEffect(vm: AnimationVisibilityStateManager): ActiveEffect {
  const s = vm.getSettings();
  if (s.fireEffect) return "fire";
  if (s.charcoalEffect) return "charcoal";
  if (s.ledEffect) return "led";
  if (s.trailStyle !== "off") return "trails";
  return "none";
}

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

function buildDisplayChildren(
  vm: AnimationVisibilityStateManager
): ContextMenuItem[] {
  const gridVisible = vm.isGridVisible();
  return [
    {
      id: "display-grid",
      label: "Grid",
      icon: "fa-border-all",
      checked: gridVisible,
      keepOpen: true,
      action: () => vm.setGridMode(gridVisible ? "none" : "diamond"),
    },
    {
      id: "display-tkaGlyph",
      label: "TKA Glyph",
      icon: "fa-language",
      checked: vm.getVisibility("tkaGlyph"),
      keepOpen: true,
      action: () => vm.toggleVisibility("tkaGlyph"),
    },
    {
      id: "display-stepNumbers",
      label: "Step Numbers",
      icon: "fa-list-ol",
      checked: vm.getVisibility("stepNumbers"),
      keepOpen: true,
      action: () => vm.toggleVisibility("stepNumbers"),
    },
    {
      id: "display-beatPosition",
      label: "Beat Position",
      icon: "fa-crosshairs",
      checked: vm.getVisibility("beatPosition"),
      keepOpen: true,
      action: () => vm.toggleVisibility("beatPosition"),
    },
    {
      id: "display-props",
      label: "Props",
      icon: "fa-wand-sparkles",
      checked: vm.getVisibility("props"),
      keepOpen: true,
      action: () => vm.toggleVisibility("props"),
    },
    {
      id: "display-wordHeader",
      label: "Word Header",
      icon: "fa-heading",
      checked: vm.getVisibility("wordHeader"),
      keepOpen: true,
      action: () => vm.toggleVisibility("wordHeader"),
    },
    {
      id: "display-progressBar",
      label: "Progress Bar",
      icon: "fa-bars-progress",
      checked: vm.getVisibility("progressBar"),
      keepOpen: true,
      action: () => vm.toggleVisibility("progressBar"),
    },
  ];
}

function buildPathShapeChildren(
  vm: AnimationVisibilityStateManager
): ContextMenuItem[] {
  const current = vm.getPathShape();
  return [
    {
      id: "path-arc",
      label: "Arc",
      icon: "fa-bezier-curve",
      checked: current === "arc",
      action: () => vm.setPathShape("arc"),
    },
    {
      id: "path-linear",
      label: "Linear",
      icon: "fa-arrows-alt-h",
      checked: current === "linear",
      action: () => vm.setPathShape("linear"),
    },
  ];
}

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
    {
      id: "path-shape-submenu",
      label: "Path Shape",
      icon: "fa-draw-polygon",
      children: buildPathShapeChildren(vm),
    },
    {
      id: "display-submenu",
      label: "Display",
      icon: "fa-eye",
      children: buildDisplayChildren(vm),
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
      label: "Effect Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenPanel("display"),
    },
  ];
}
