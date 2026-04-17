<script lang="ts">
  import { onMount } from "svelte";
  import { getViewer3DContext, type PopoverId } from "$lib/shared/3d/context/viewer-3d-context";
  import TempoPopover from "./TempoPopover.svelte";
  import ExportPopover from "./ExportPopover.svelte";
  import PerformerPopover from "./PerformerPopover.svelte";
  import Viewer3DGearPopover from "$lib/shared/3d/components/Viewer3DGearPopover.svelte";

  const viewer = getViewer3DContext();

  interface Props {
    bpm?: number;
    onBpmChange?: (bpm: number) => void;
  }
  let { bpm = 60, onBpmChange = () => {} }: Props = $props();

  let rootEl = $state<HTMLDivElement | null>(null);

  interface Chip { id: PopoverId; icon: string; tooltip: string; }
  const CHIPS: Chip[] = [
    { id: "performers", icon: "fa-users", tooltip: "Performers" },
    { id: "tempo",      icon: "fa-drum",  tooltip: "Tempo" },
    { id: "export",     icon: "fa-film",  tooltip: "Export" },
    { id: "gear",       icon: "fa-gear",  tooltip: "Settings" },
  ];

  function onClick(e: MouseEvent, id: PopoverId) {
    e.stopPropagation();
    viewer.openPopover(viewer.activePopover === id ? null : id);
  }

  onMount(() => {
    function onDocClick(e: MouseEvent) {
      if (!viewer.activePopover) return;
      const target = e.target as Node | null;
      if (!target) return;
      // Clicks inside the rail (chips + adjacent popover wrappers) are ignored.
      if (rootEl && rootEl.contains(target)) return;
      // Popovers may render in portals — treat any role="dialog" as inside.
      const popovers = document.querySelectorAll('[role="dialog"]');
      for (const p of popovers) if (p.contains(target)) return;
      viewer.closePopover();
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  });
</script>

<div class="right-rail" bind:this={rootEl} role="toolbar" aria-label="Viewer controls">
  {#each CHIPS as chip (chip.id)}
    {#if chip.id === "performers"}
      <div class="chip-wrap">
        <button
          class="rail-chip"
          aria-pressed={viewer.activePopover === chip.id}
          aria-label={chip.tooltip}
          data-tooltip={chip.tooltip}
          onclick={(e) => onClick(e, chip.id)}
        >
          <i class="fas {chip.icon}"></i>
        </button>
        <PerformerPopover />
      </div>
    {:else if chip.id === "tempo"}
      <div class="chip-wrap">
        <button
          class="rail-chip"
          aria-pressed={viewer.activePopover === chip.id}
          aria-label={chip.tooltip}
          data-tooltip={chip.tooltip}
          onclick={(e) => onClick(e, chip.id)}
        >
          <i class="fas {chip.icon}"></i>
        </button>
        <TempoPopover {bpm} {onBpmChange} />
      </div>
    {:else if chip.id === "export"}
      <div class="chip-wrap">
        <button
          class="rail-chip"
          aria-pressed={viewer.activePopover === chip.id}
          aria-label={chip.tooltip}
          data-tooltip={chip.tooltip}
          onclick={(e) => onClick(e, chip.id)}
        >
          <i class="fas {chip.icon}"></i>
        </button>
        <ExportPopover />
      </div>
    {:else if chip.id === "gear"}
      <div class="chip-wrap">
        <button
          class="rail-chip"
          aria-pressed={viewer.activePopover === chip.id}
          aria-label={chip.tooltip}
          data-tooltip={chip.tooltip}
          onclick={(e) => onClick(e, chip.id)}
        >
          <i class="fas {chip.icon}"></i>
        </button>
        <Viewer3DGearPopover />
      </div>
    {:else}
      <button
        class="rail-chip"
        aria-pressed={viewer.activePopover === chip.id}
        aria-label={chip.tooltip}
        data-tooltip={chip.tooltip}
        onclick={(e) => onClick(e, chip.id)}
      >
        <i class="fas {chip.icon}"></i>
      </button>
    {/if}
  {/each}
</div>

<style>
  .right-rail {
    position: absolute; top: 76px; right: 12px;
    display: flex; flex-direction: column; gap: 8px;
    z-index: 9;
  }
  .chip-wrap {
    position: relative;
  }
  .rail-chip {
    width: 56px; height: 56px;
    background: rgba(20, 22, 32, 0.78);
    backdrop-filter: blur(20px) saturate(140%);
    border: 1px solid rgba(255,255,255,0.10);
    border-radius: 14px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    color: rgba(255,255,255,0.62);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
  }
  .rail-chip:hover::after {
    content: attr(data-tooltip);
    position: absolute; right: calc(100% + 10px); top: 50%; transform: translateY(-50%);
    background: rgba(0,0,0,0.85); color: white;
    padding: 6px 10px; border-radius: 8px;
    font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
    white-space: nowrap; pointer-events: none;
  }
  .rail-chip[aria-pressed="true"] {
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
  }
  .rail-chip i { font-size: 22px; }
</style>
