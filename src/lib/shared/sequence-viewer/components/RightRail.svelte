<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { getViewer3DContext, type PopoverId } from "$lib/shared/3d/context/viewer-3d-context";
  import { getPerformerColor } from "$lib/shared/3d/constants/performer-colors";
  import TempoPopover from "./TempoPopover.svelte";
  import ExportPopover from "./ExportPopover.svelte";
  import CameraPopover from "$lib/shared/3d/components/CameraPopover.svelte";
  import PlanesPopover from "$lib/shared/3d/components/PlanesPopover.svelte";
  import SceneSelectorPopover from "$lib/shared/3d/components/SceneSelectorPopover.svelte";
  import FormationPopover from "$lib/shared/3d/components/controls/FormationPopover.svelte";
  import EffectsPopover from "$lib/shared/3d/components/controls/EffectsPopover.svelte";
  import PropPopover from "$lib/shared/3d/components/controls/PropPopover.svelte";
  import EffortPopover from "$lib/shared/3d/components/controls/EffortPopover.svelte";
  import { createViewer3DKeyboardHandler } from "$lib/shared/3d/keyboard/Viewer3DKeyboardHandler";

  const viewer = getViewer3DContext();

  interface Props {
    renderMode: "2d" | "3d";
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
  }
  let { renderMode, bpm = 60, onBpmChange = () => {} }: Props = $props();

  let rootEl = $state<HTMLDivElement | null>(null);

  interface Chip { id: PopoverId; icon: string; tooltip: string; }

  const CHIPS_3D_GLOBAL: Chip[] = [
    { id: "formation", icon: "fa-users",                 tooltip: "Formation" },
    { id: "tempo",     icon: "fa-gauge",                 tooltip: "Speed" },
    { id: "camera",    icon: "fa-video",                 tooltip: "Camera" },
    { id: "planes",    icon: "fa-layer-group",           tooltip: "Planes" },
    { id: "export",    icon: "fa-arrow-up-from-bracket", tooltip: "Export" },
    { id: "scene",     icon: "fa-mountain-sun",          tooltip: "Scene" },
  ];

  const CHIPS_PERFORMER: Chip[] = [
    { id: "effects", icon: "fa-wand-magic-sparkles", tooltip: "Effects" },
    { id: "prop",    icon: "fa-staff-snake",         tooltip: "Prop" },
    { id: "effort",  icon: "fa-wave-square",         tooltip: "Effort" },
  ];

  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const hasPerformerSelected = $derived(renderMode === "3d" && selectedIndex !== null);
  const performerColor = $derived(getPerformerColor(selectedIndex ?? 0));

  function onChipClick(e: MouseEvent, id: PopoverId) {
    e.stopPropagation();
    viewer.openPopover(viewer.activePopover === id ? null : id);
  }

  onMount(() => {
    const cleanupKeyboard = createViewer3DKeyboardHandler({
      undo: () => viewer.undo(),
      redo: () => viewer.redo(),
    });

    function onDocClick(e: MouseEvent) {
      if (!viewer.activePopover) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (rootEl && rootEl.contains(target)) return;
      const popovers = document.querySelectorAll('[role="dialog"]');
      for (const p of popovers) if (p.contains(target)) return;
      viewer.closePopover();
    }
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("click", onDocClick);
      cleanupKeyboard();
    };
  });
</script>

<div
  class="right-rail"
  class:mode-2d={renderMode === "2d"}
  class:mode-3d={renderMode === "3d"}
  bind:this={rootEl}
  role="toolbar"
  aria-label="Viewer controls"
>
  {#if renderMode === "3d"}
    {#each CHIPS_3D_GLOBAL as chip (chip.id)}
      <div class="chip-wrap">
        <button
          class="rail-chip"
          aria-pressed={viewer.activePopover === chip.id}
          aria-label={chip.tooltip}
          data-tooltip={chip.tooltip}
          onclick={(e) => onChipClick(e, chip.id)}
        >
          <i class="fas {chip.icon}"></i>
        </button>
        {#if chip.id === "formation"}
          <FormationPopover />
        {:else if chip.id === "tempo"}
          <TempoPopover {bpm} {onBpmChange} />
        {:else if chip.id === "export"}
          <ExportPopover />
        {:else if chip.id === "camera"}
          <CameraPopover />
        {:else if chip.id === "planes"}
          <PlanesPopover />
        {:else if chip.id === "scene"}
          <SceneSelectorPopover />
        {/if}
      </div>
    {/each}

    {#if hasPerformerSelected}
      <div
        class="performer-separator"
        transition:slide|local={{ duration: 220, axis: "y" }}
        aria-hidden="true"
      >
        <div class="separator-line"></div>
      </div>

      {#each CHIPS_PERFORMER as chip (chip.id)}
        <div class="chip-wrap" transition:slide|local={{ duration: 220, axis: "y" }}>
          <button
            class="rail-chip performer-scoped"
            aria-pressed={viewer.activePopover === chip.id}
            aria-label={chip.tooltip}
            data-tooltip={chip.tooltip}
            style:--chip-tint={performerColor}
            onclick={(e) => onChipClick(e, chip.id)}
          >
            <i class="fas {chip.icon}"></i>
          </button>
          {#if chip.id === "effects"}
            <EffectsPopover />
          {:else if chip.id === "prop"}
            <PropPopover />
          {:else if chip.id === "effort"}
            <EffortPopover />
          {/if}
        </div>
      {/each}
    {/if}
  {/if}
</div>

<style>
  .right-rail {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 9;
  }
  .chip-wrap {
    position: relative;
  }
  .rail-chip {
    width: 56px;
    height: 56px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .rail-chip:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    right: calc(100% + 10px);
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
    pointer-events: none;
  }
  .rail-chip[aria-pressed="true"] {
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
  }
  .rail-chip.performer-scoped i {
    color: var(--chip-tint, rgba(255, 255, 255, 0.62));
  }
  .rail-chip.performer-scoped[aria-pressed="true"] {
    background: color-mix(in srgb, var(--chip-tint) 18%, transparent);
    border-color: color-mix(in srgb, var(--chip-tint) 50%, transparent);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--chip-tint) 25%, transparent);
  }
  .rail-chip i {
    font-size: 22px;
  }
  .performer-separator {
    display: flex;
    justify-content: center;
    padding: 0;
  }
  .separator-line {
    width: 32px;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
  }
</style>
