<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { STAGE } from "@austencloud/scene-3d";
  import { getPerformerColor } from "../../constants/performer-colors";

  const viewer = getViewer3DContext();
  const performers = $derived(viewer.performerManager.performers);
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const canAdd = $derived(performers.length < STAGE.MAX_VIEWER_PERFORMERS);

  function selectAll(): void {
    viewer.selectPerformerScope(null);
    viewer.closePopover();
  }

  function selectPerformer(i: number): void {
    const newIndex = selectedIndex === i ? null : i;
    viewer.selectPerformerScope(newIndex);
    if (newIndex === null) viewer.closePopover();
  }

  function addPerformer(): void {
    viewer.spawnPerformerFromUI();
  }
</script>

{#if performers.length >= 1}
  <div class="performer-rail" role="toolbar" aria-label="Performer selection">
    <button
      class="rail-chip all-chip"
      aria-pressed={selectedIndex === null}
      aria-label="All performers (Bird's Eye)"
      data-tooltip="All"
      onclick={selectAll}
    >
      <i class="fas fa-users"></i>
    </button>

    <div class="separator" aria-hidden="true"></div>

    {#each performers as _, i (i)}
      {@const color = getPerformerColor(i)}
      <button
        class="rail-chip performer-chip"
        aria-pressed={selectedIndex === i}
        aria-label="Performer {i + 1}"
        data-tooltip="Performer {i + 1}"
        style:--performer-color={color}
        onclick={() => selectPerformer(i)}
      >
        <span class="performer-number">{i + 1}</span>
        <span class="performer-dot"></span>
      </button>
    {/each}

    <div class="separator" aria-hidden="true"></div>

    <button
      class="rail-chip add-chip"
      aria-label="Add performer"
      data-tooltip="Add"
      disabled={!canAdd}
      onclick={addPerformer}
    >
      <i class="fas fa-plus"></i>
    </button>
  </div>
{/if}

<style>
  .performer-rail {
    position: absolute;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    z-index: 20;
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
  .rail-chip:hover:not(:disabled)::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.85);
    color: white;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
    pointer-events: none;
  }
  .rail-chip[aria-pressed="true"]::after {
    display: none;
  }
  .rail-chip i {
    font-size: 22px;
  }
  .rail-chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* All chip */
  .all-chip[aria-pressed="true"] {
    background: color-mix(in srgb, var(--theme-accent, #4a9eff) 18%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent, #4a9eff) 50%, transparent);
    color: color-mix(in srgb, var(--theme-accent, #4a9eff) 60%, #ffffff);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--theme-accent, #4a9eff) 25%, transparent);
  }

  /* Performer chip */
  .performer-chip {
    position: relative;
  }
  .performer-number {
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
  }
  .performer-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--performer-color);
  }
  .performer-chip[aria-pressed="true"] {
    border-color: var(--performer-color);
    box-shadow: 0 4px 20px color-mix(in srgb, var(--performer-color) 30%, transparent);
  }
  .performer-chip[aria-pressed="true"] .performer-number {
    color: var(--performer-color);
  }
  .performer-chip[aria-pressed="true"] .performer-dot {
    box-shadow: 0 0 8px var(--performer-color);
  }

  /* Add chip */
  .add-chip {
    border-style: dashed;
  }

  /* Separator */
  .separator {
    width: 1px;
    height: 32px;
    background: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }
</style>
