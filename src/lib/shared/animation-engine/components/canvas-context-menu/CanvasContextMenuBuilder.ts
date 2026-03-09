/**
 * Canvas Context Menu Builder
 *
 * Reads current state from AnimationVisibilityStateManager and produces
 * ContextMenuEntry[] for the animation canvas right-click menu.
 *
 * Quick toggles: Dark Mode, Fire, LED, Trails (mutually exclusive effects).
 * Panel launcher: "Canvas Settings..." opens the full settings modal.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";

export type SettingsPanelCategory = "fire" | "led" | "display";

interface CanvasContextMenuDeps {
  visibilityManager: AnimationVisibilityStateManager;
  onOpenPanel: (category: SettingsPanelCategory) => void;
}

export function buildCanvasContextMenuItems(
  deps: CanvasContextMenuDeps
): ContextMenuEntry[] {
  const vm = deps.visibilityManager;
  const settings = vm.getSettings();

  return [
    {
      id: "toggle-dark-mode",
      label: "Dark Mode",
      icon: "fa-moon",
      checked: settings.darkMode,
      keepOpen: true,
      action: () => vm.toggleDarkMode(),
    },
    {
      id: "toggle-fire-effect",
      label: "Fire Effect",
      icon: "fa-fire",
      iconColor: "#f97316",
      checked: settings.fireEffect,
      keepOpen: true,
      action: () => vm.toggleFireEffect(),
    },
    {
      id: "toggle-led-effect",
      label: "LED Effect",
      icon: "fa-lightbulb",
      iconColor: "#22c55e",
      checked: settings.ledEffect,
      keepOpen: true,
      action: () => vm.toggleLedEffect(),
    },
    {
      id: "toggle-trails",
      label: "Trails",
      icon: "fa-route",
      checked: settings.trailStyle !== "off",
      keepOpen: true,
      action: () =>
        vm.setTrailStyle(settings.trailStyle === "off" ? "on" : "off"),
    },
    { type: "separator" as const },
    {
      id: "open-canvas-settings",
      label: "Canvas Settings\u2026",
      icon: "fa-sliders",
      action: () => deps.onOpenPanel("display"),
    },
  ];
}
