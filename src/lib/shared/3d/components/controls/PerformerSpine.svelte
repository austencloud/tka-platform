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
  <div class="performer-spine" role="toolbar" aria-label="Performer selection">
    <!-- Add button at top -->
    <button
      class="spine-chip add-chip"
      aria-label="Add performer"
      data-tooltip="Add performer"
      disabled={!canAdd}
      onclick={addPerformer}
    >
      <i class="fas fa-plus"></i>
    </button>

    <div class="separator" aria-hidden="true"></div>

    <!-- Performers: highest index at top, lowest at bottom -->
    {#each [...performers].reverse() as _, ri (performers.length - 1 - ri)}
      {@const i = performers.length - 1 - ri}
      {@const color = getPerformerColor(i)}
      <button
        class="spine-chip performer-chip"
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

    <!-- All button at bottom -->
    <button
      class="spine-chip all-chip"
      aria-pressed={selectedIndex === null}
      aria-label="All performers"
      data-tooltip="All performers"
      onclick={selectAll}
    >
      <i class="fas fa-users"></i>
    </button>
  </div>
{/if}

<style>
  .performer-spine {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .spine-chip {
    width: 48px;
    height: 48px;
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.62);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: all 180ms cubic-bezier(0.2, 0, 0.13, 1.5);
    flex-shrink: 0;
  }

  .spine-chip:hover:not(:disabled) {
    transform: scale(1.08);
    background: rgba(255, 255, 255, 0.06);
  }

  /* Tooltip appears to the right */
  .spine-chip:hover:not(:disabled)::after {
    content: attr(data-tooltip);
    position: absolute;
    left: calc(100% + 10px);
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
    z-index: 100;
  }

  .spine-chip[aria-pressed="true"]::after {
    display: none;
  }

  .spine-chip i {
    font-size: 18px;
  }

  .spine-chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* All chip */
  .all-chip[aria-pressed="true"] {
    background: color-mix(in srgb, #4a9eff 18%, transparent);
    border-color: color-mix(in srgb, #4a9eff 50%, transparent);
    color: #8fc3ff;
    box-shadow: 0 4px 20px color-mix(in srgb, #4a9eff 25%, transparent);
  }

  /* Performer chip */
  .performer-chip {
    position: relative;
  }

  .performer-number {
    font-size: 18px;
    font-weight: 700;
    line-height: 1;
  }

  .performer-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 9px;
    height: 9px;
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
    width: 32px;
    height: 1px;
    background: rgba(255, 255, 255, 0.1);
    flex-shrink: 0;
  }
</style>
