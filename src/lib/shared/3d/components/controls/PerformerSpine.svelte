<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { STAGE } from "@austencloud/scene-3d";
  import { getPerformerColor } from "../../constants/performer-colors";
  import {
    reportViewerControlChange,
    type ViewerControlSink,
  } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";

  interface Props {
    onSettingChange?: ViewerControlSink;
  }
  let { onSettingChange }: Props = $props();

  const viewer = getViewer3DContext();
  const performers = $derived(viewer.performerManager.performers);
  const selectedIndex = $derived(viewer.selectedPerformerIndex);
  const canAdd = $derived(performers.length < STAGE.MAX_VIEWER_PERFORMERS);

  function scopeValue(index: number | null): string {
    return index === null ? "all" : `performer_${index + 1}`;
  }

  function selectAll(): void {
    const previous = scopeValue(selectedIndex);
    viewer.selectPerformerScope(null);
    viewer.closePopover();
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "scope",
      previous,
      "all"
    );
  }

  function selectPerformer(i: number): void {
    const previous = scopeValue(selectedIndex);
    viewer.selectPerformerScope(i);
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "scope",
      previous,
      scopeValue(i)
    );
  }

  function addPerformer(): void {
    const previous = performers.length;
    viewer.spawnPerformerFromUI();
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "performer_count",
      previous,
      viewer.performerManager.performers.length
    );
  }
</script>

{#if performers.length >= 1}
  <div
    class="performer-spine"
    role="toolbar"
    aria-label="Performer selection"
    aria-orientation="horizontal"
  >
    <!-- Add leads the row, and the row is anchored by its left edge, so the
         button you just pressed does not move under your cursor and no
         existing chip shifts either. Trailing it would drag it one chip-width
         right on every press — the list only ever grows at its far end — and
         would eventually scroll it out of reach. It is a command, not another
         performer to select, so the divider separates it from the scope
         track rather than joining it. -->
    <button
      class="spine-chip add-chip"
      aria-label="Add performer"
      title="Add performer"
      disabled={!canAdd}
      onclick={addPerformer}
    >
      <i class="fas fa-plus"></i>
    </button>

    <div class="separator" aria-hidden="true"></div>

    <div class="selection-track">
      <button
        class="spine-chip all-chip"
        aria-pressed={selectedIndex === null}
        aria-label="All performers"
        title="All performers"
        onclick={selectAll}
      >
        <i class="fas fa-users"></i>
      </button>

      {#each performers as _, i (i)}
        {@const color = getPerformerColor(i)}
        <button
          class="spine-chip performer-chip"
          aria-pressed={selectedIndex === i}
          aria-label="Performer {i + 1}"
          title="Performer {i + 1}"
          style:--performer-color={color}
          onclick={() => selectPerformer(i)}
        >
          <span class="performer-number">{i + 1}</span>
          <span class="performer-dot"></span>
        </button>
      {/each}
    </div>
  </div>
{/if}

<style>
  .performer-spine {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .selection-track {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    min-width: 0;
    overflow-x: auto;
    scrollbar-width: thin;
    /* Room for the chips' hover scale and focus ring inside the scroller. */
    padding: 3px;
    margin: -3px;
  }

  .spine-chip {
    width: 48px;
    height: 48px;
    background: transparent;
    border: 1px solid var(--theme-stroke);
    border-radius: 12px;
    color: var(--theme-text-dim);
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
    background: var(--theme-card-bg);
  }

  .spine-chip i {
    font-size: 18px;
  }

  .spine-chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* Add chip */
  .add-chip {
    flex: none;
    border-style: dashed;
  }

  /* All chip */
  .all-chip[aria-pressed="true"] {
    background: color-mix(in srgb, var(--theme-accent) 18%, transparent);
    border-color: color-mix(in srgb, var(--theme-accent) 50%, transparent);
    color: color-mix(in srgb, var(--theme-accent) 60%, var(--theme-text));
    box-shadow: 0 4px 20px
      color-mix(in srgb, var(--theme-accent) 25%, transparent);
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
    box-shadow: 0 4px 20px
      color-mix(in srgb, var(--performer-color) 30%, transparent);
  }

  .performer-chip[aria-pressed="true"] .performer-number {
    color: var(--performer-color);
  }

  .performer-chip[aria-pressed="true"] .performer-dot {
    box-shadow: 0 0 8px var(--performer-color);
  }

  /* Separator */
  .separator {
    flex: none;
    width: 1px;
    height: 2rem;
    background: var(--theme-card-hover-bg);
  }

  /* ─── Focus-visible ─── */
  .spine-chip:focus-visible {
    outline: 2px solid var(--performer-color, var(--theme-accent));
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .spine-chip {
      transition: none;
    }
  }
</style>
