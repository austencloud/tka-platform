/**
 * Canvas Context Menu Builder
 *
 * Reads current state from AnimationVisibilityStateManager and produces
 * ContextMenuEntry[] for the animation canvas right-click menu.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";

interface CanvasContextMenuDeps {
  visibilityManager: AnimationVisibilityStateManager;
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
  ];
}
