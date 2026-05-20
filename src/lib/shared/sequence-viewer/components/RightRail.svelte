<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { getViewer3DContext, type PopoverId } from "$lib/shared/3d/context/viewer-3d-context";
  import TempoPopover from "./TempoPopover.svelte";
  import ExportPopover from "./ExportPopover.svelte";
  import PerformerPopover from "./PerformerPopover.svelte";
  import CameraPopover from "$lib/shared/3d/components/CameraPopover.svelte";
  import PlanesPopover from "$lib/shared/3d/components/PlanesPopover.svelte";
  import SceneSelectorPopover from "$lib/shared/3d/components/SceneSelectorPopover.svelte";
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
  const CHIPS_3D: Chip[] = [
    { id: "performers", icon: "fa-users",                 tooltip: "Performers" },
    { id: "tempo",      icon: "fa-gauge",                 tooltip: "Speed" },
    { id: "camera",     icon: "fa-video",                 tooltip: "Camera" },
    { id: "planes",     icon: "fa-layer-group",           tooltip: "Planes" },
    { id: "export",     icon: "fa-arrow-up-from-bracket", tooltip: "Export" },
    { id: "scene",      icon: "fa-mountain-sun",          tooltip: "Scene" },
  ];

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
      // Clicks inside the rail are ignored.
      if (rootEl && rootEl.contains(target)) return;
      // Popovers may render in portals - treat any role="dialog" as inside.
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
    {#each CHIPS_3D as chip (chip.id)}
      <div class="chip-wrap" transition:slide|local={{ duration: 220, axis: "y" }}>
        <button
          class="rail-chip"
          aria-pressed={viewer.activePopover === chip.id}
          aria-label={chip.tooltip}
          data-tooltip={chip.tooltip}
          onclick={(e) => onChipClick(e, chip.id)}
        >
          <i class="fas {chip.icon}"></i>
        </button>
        {#if chip.id === "performers"}
          <PerformerPopover />
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
  .rail-chip i {
    font-size: 22px;
  }
</style>
