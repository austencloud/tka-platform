/**
 * Canvas Context Menu Builder
 *
 * Reads current state from AnimationVisibilityStateManager and produces
 * ContextMenuEntry[] for the animation canvas right-click menu.
 *
 * Three submenu groups for quick access:
 *   - Effects: None, Fire, Charcoal, LED, Trails (radio-style, one active)
 *   - Efforts: 8 effort presets from the effort-lab domain (radio-style)
 *   - Path Shape: Arc vs Linear (radio-style)
 *
 * Plus: Disassemble toggle, Animation Settings launcher.
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";
import type { AnimationVisibilityStateManager } from "../../state/animation-visibility-state.svelte";
import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";

interface CanvasContextMenuDeps {
  visibilityManager: AnimationVisibilityStateManager;
  onOpenSettings: () => void;
  disassembled?: boolean;
  onToggleDisassemble?: () => void;
  /** Captures a diagnostic snapshot of the effect pipeline state */
  captureEffectDiagnostics?: () => Record<string, unknown>;
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

  const items: ContextMenuEntry[] = [
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
    { type: "separator" as const },
  ];

  if (deps.onToggleDisassemble) {
    items.push(
      {
        id: "toggle-disassemble",
        label: deps.disassembled ? "Reassemble" : "Disassemble",
        icon: deps.disassembled ? "fa-compress" : "fa-table-columns",
        action: () => deps.onToggleDisassemble!(),
      },
      { type: "separator" as const },
    );
  }

  items.push({
    id: "open-animation-settings",
    label: "Animation Settings\u2026",
    icon: "fa-sliders",
    action: () => deps.onOpenSettings(),
  });

  // Show "Report Effect Issue" when any effect is active
  if (active !== "none" && deps.captureEffectDiagnostics) {
    const captureFn = deps.captureEffectDiagnostics;
    items.push(
      { type: "separator" as const },
      {
        id: "report-effect-issue",
        label: "Report Effect Issue",
        icon: "fa-bug",
        iconColor: "#ef4444",
        action: async () => {
          const snapshot = captureFn();
          const json = JSON.stringify(snapshot, null, 2);
          try {
            await navigator.clipboard.writeText(json);
            console.log("[EffectDiagnostics] Snapshot copied to clipboard:", snapshot);
          } catch {
            // Clipboard may fail in non-secure contexts
            console.log("[EffectDiagnostics] Snapshot (copy failed, logged here):", json);
          }
        },
      }
    );
  }

  return items;
}
