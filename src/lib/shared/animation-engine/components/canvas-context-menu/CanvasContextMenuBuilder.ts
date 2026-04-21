/**
 * Canvas Context Menu Builder
 *
 * Reads current state from AnimationVisibilityStateManager and produces
 * ContextMenuEntry[] for the animation canvas right-click menu.
 *
 * Submenu groups for quick access:
 *   - Visibility: Props, Beat #s, TKA Glyph, Word Header, Progress Bar (toggles)
 *   - Grid: Off / 8-Point / Auto (radio-style)
 *   - Playback: Continuous / Step (radio-style)
 *   - Effects: None, Fire, Charcoal, LED, Trails (radio-style, one active)
 *   - Trail Tracking: Pinky / Thumb / Both (when trails active)
 *   - Efforts: 8 effort presets from the effort-lab domain (radio-style)
 *   - Path Shape: Arc vs Linear (radio-style)
 *
 * Plus: Disassemble toggle.
 */

import type {
  ContextMenuEntry,
  ContextMenuItem,
} from "$lib/shared/components/context-menu/context-menu-types";
import type { AnimationVisibilityStateManager, GridMode } from "../../state/animation-visibility-state.svelte";
import { EFFORTS } from "$lib/features/effort-lab/domain/effort-types";
import type { EffortId } from "$lib/features/effort-lab/domain/effort-types";
import { animationSettings } from "../../state/animation-settings-state.svelte";
import { TrackingMode } from "../../domain/types/TrailTypes";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

interface CanvasContextMenuDeps {
  visibilityManager: AnimationVisibilityStateManager;
  disassembled?: boolean;
  onToggleDisassemble?: () => void;
  /** Captures a diagnostic snapshot of the effect pipeline state */
  captureEffectDiagnostics?: () => Record<string, unknown>;
  viewer3DState?: {
    renderMode: "2d" | "3d";
    enter3D: (data: SequenceData) => void;
    exit3D: () => void;
    webgl2Available: boolean;
  };
  sequenceData?: SequenceData | null;
}

type ActiveEffect = "fire" | "charcoal" | "led" | "trails" | "none";

function getActiveEffect(vm: AnimationVisibilityStateManager): ActiveEffect {
  return vm.getActiveEffect() as ActiveEffect;
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
      action: () => vm.setActiveEffect("none"),
    },
    {
      id: "effect-fire",
      label: "Fire",
      icon: "fa-fire-flame-curved",
      iconColor: "#f97316",
      checked: active === "fire",
      action: () => vm.setActiveEffect("fire"),
    },
    {
      id: "effect-charcoal",
      label: "Charcoal",
      icon: "fa-fire",
      iconColor: "#a855f7",
      checked: active === "charcoal",
      action: () => vm.setActiveEffect("charcoal"),
    },
    {
      id: "effect-led",
      label: "LED",
      icon: "fa-lightbulb",
      iconColor: "#22c55e",
      checked: active === "led",
      action: () => vm.setActiveEffect("led"),
    },
    {
      id: "effect-trails",
      label: "Trails",
      icon: "fa-route",
      checked: active === "trails",
      action: () => vm.setActiveEffect("trails"),
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

function getTrackingLabels(): { left: string; right: string } {
  const pt = animationSettings.currentPropType?.toLowerCase() ?? "staff";
  if (pt === "staff") return { left: "Pinky", right: "Thumb" };
  if (pt === "bigclub") return { left: "Knob", right: "Bulb" };
  return { left: "End 1", right: "End 2" };
}

function buildTrailTrackingChildren(): ContextMenuItem[] {
  const current = animationSettings.trail.trackingMode;
  const labels = getTrackingLabels();
  return [
    {
      id: "trail-left-end",
      label: labels.left,
      icon: "fa-minus",
      checked: current === TrackingMode.LEFT_END,
      action: () => animationSettings.setTrackingMode(TrackingMode.LEFT_END),
    },
    {
      id: "trail-right-end",
      label: labels.right,
      icon: "fa-minus",
      checked: current === TrackingMode.RIGHT_END,
      action: () => animationSettings.setTrackingMode(TrackingMode.RIGHT_END),
    },
    {
      id: "trail-both-ends",
      label: "Both",
      icon: "fa-grip-lines",
      checked: current === TrackingMode.BOTH_ENDS,
      action: () => animationSettings.setTrackingMode(TrackingMode.BOTH_ENDS),
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

function buildGridChildren(
  vm: AnimationVisibilityStateManager
): ContextMenuItem[] {
  const current: GridMode = vm.getGridMode();
  return [
    {
      id: "grid-none",
      label: "Off",
      icon: "fa-border-none",
      checked: current === "none",
      action: () => vm.setGridMode("none"),
    },
    {
      id: "grid-8point",
      label: "8-Point",
      icon: "fa-diamond",
      checked: current === "8point",
      action: () => vm.setGridMode("8point"),
    },
    {
      id: "grid-auto",
      label: "Auto",
      icon: "fa-wand-magic",
      checked: current === "auto",
      action: () => vm.setGridMode("auto"),
    },
  ];
}

function buildPlaybackChildren(
  vm: AnimationVisibilityStateManager
): ContextMenuItem[] {
  const current = vm.getPlaybackMode();
  return [
    {
      id: "playback-continuous",
      label: "Continuous",
      icon: "fa-play",
      checked: current === "continuous",
      action: () => vm.setPlaybackMode("continuous"),
    },
    {
      id: "playback-step",
      label: "Step",
      icon: "fa-forward-step",
      checked: current === "step",
      action: () => vm.setPlaybackMode("step"),
    },
  ];
}

function buildVisibilityChildren(
  vm: AnimationVisibilityStateManager
): ContextMenuItem[] {
  const settings = vm.getSettings();
  return [
    {
      id: "vis-props",
      label: "Props",
      icon: "fa-wand-sparkles",
      checked: settings.props,
      keepOpen: true,
      action: () => vm.toggleVisibility("props"),
    },
    {
      id: "vis-beat-numbers",
      label: "Beat #s",
      icon: "fa-hashtag",
      checked: settings.stepNumbers,
      keepOpen: true,
      action: () => vm.toggleVisibility("stepNumbers"),
    },
    {
      id: "vis-tka-glyph",
      label: "TKA Glyph",
      icon: "fa-font",
      checked: settings.tkaGlyph,
      keepOpen: true,
      action: () => vm.toggleVisibility("tkaGlyph"),
    },
    {
      id: "vis-word-header",
      label: "Word Header",
      icon: "fa-heading",
      checked: settings.wordHeader,
      keepOpen: true,
      action: () => vm.toggleVisibility("wordHeader"),
    },
    {
      id: "vis-progress-bar",
      label: "Progress Bar",
      icon: "fa-bars-progress",
      checked: settings.progressBar,
      keepOpen: true,
      action: () => vm.toggleVisibility("progressBar"),
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
    // Visibility toggles submenu
    {
      id: "visibility-submenu",
      label: "Visibility",
      icon: "fa-eye",
      children: buildVisibilityChildren(vm),
    },
    // Grid mode submenu
    {
      id: "grid-submenu",
      label: "Grid",
      icon: "fa-border-all",
      children: buildGridChildren(vm),
    },
    // Playback mode submenu
    {
      id: "playback-submenu",
      label: "Playback",
      icon: "fa-circle-play",
      children: buildPlaybackChildren(vm),
    },
    { type: "separator" as const },
    // Effects submenu
    {
      id: "effects-submenu",
      label: "Effects",
      icon: "fa-wand-magic-sparkles",
      children: buildEffectChildren(vm, active),
    },
  ];

  // Show trail tracking submenu when trails are active
  if (active === "trails") {
    items.push({
      id: "trail-tracking-submenu",
      label: "Trail Tracking",
      icon: "fa-route",
      children: buildTrailTrackingChildren(),
    });
  }

  items.push(
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
  );

  if (deps.onToggleDisassemble) {
    items.push({
      id: "toggle-disassemble",
      label: deps.disassembled ? "Reassemble" : "Disassemble",
      icon: deps.disassembled ? "fa-compress" : "fa-table-columns",
      action: () => deps.onToggleDisassemble!(),
    });
  }

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

  if (deps.viewer3DState?.webgl2Available && deps.sequenceData) {
    items.push({ type: "separator" as const });
    items.push({
      id: "toggle-3d-view",
      label: deps.viewer3DState.renderMode === "3d" ? "Exit 3D View" : "Enter 3D View",
      icon: "fa-cube",
      action: () => {
        if (deps.viewer3DState!.renderMode === "3d") {
          deps.viewer3DState!.exit3D();
        } else {
          deps.viewer3DState!.enter3D(deps.sequenceData!);
        }
      },
    });
  }

  return items;
}
