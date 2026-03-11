/**
 * Canvas Context Menu Builder
 *
 * Reads current state from AnimationVisibilityStateManager and produces
 * ContextMenuEntry[] for the animation canvas right-click menu.
 *
 * Quick toggles: Fire, Charcoal, LED, Trails (mutually exclusive effects).
 * Panel launcher: "Canvas Settings..." opens the full settings modal.
 */

import type { ContextMenuEntry } from "$lib/shared/components/context-menu/context-menu-types";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";

export type SettingsPanelCategory = "fire" | "led" | "display";

interface CanvasContextMenuDeps {
  visibilityManager: AnimationVisibilityStateManager;
  onOpenPanel: (category: SettingsPanelCategory) => void;
  decomposed?: boolean;
  onToggleDecompose?: () => void;
}

export function buildCanvasContextMenuItems(
  deps: CanvasContextMenuDeps
): ContextMenuEntry[] {
  const vm = deps.visibilityManager;
  const settings = vm.getSettings();

  return [
    {
      id: "toggle-fire-effect",
      label: "Fire",
      icon: "fa-fire-flame-curved",
      iconColor: "#f97316",
      checked: settings.fireEffect,
      keepOpen: true,
      action: () => {
        if (settings.fireEffect) {
          vm.setFireEffect(false);
        } else {
          vm.setFireEffect(true);
        }
      },
    },
    {
      id: "toggle-charcoal-effect",
      label: "Charcoal",
      icon: "fa-fire",
      iconColor: "#a855f7",
      checked: settings.charcoalEffect,
      keepOpen: true,
      action: () => {
        if (settings.charcoalEffect) {
          vm.setCharcoalEffect(false);
        } else {
          vm.setCharcoalEffect(true);
        }
      },
    },
    {
      id: "toggle-led-effect",
      label: "LED",
      icon: "fa-lightbulb",
      iconColor: "#22c55e",
      checked: settings.ledEffect,
      keepOpen: true,
      action: () => {
        if (settings.ledEffect) {
          vm.setLedEffect(false);
        } else {
          vm.setLedEffect(true);
        }
      },
    },
    {
      id: "toggle-trails",
      label: "Trails",
      icon: "fa-route",
      checked: settings.trailStyle !== "off",
      keepOpen: true,
      action: () => {
        if (settings.trailStyle !== "off") {
          vm.setTrailStyle("off");
        } else {
          vm.setTrailStyle("on");
        }
      },
    },
    { type: "separator" as const },
    ...(deps.onToggleDecompose
      ? [
          {
            id: "toggle-decompose",
            label: deps.decomposed ? "Collapse" : "Decompose",
            icon: deps.decomposed ? "fa-compress" : "fa-table-columns",
            checked: deps.decomposed,
            action: () => deps.onToggleDecompose!(),
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
