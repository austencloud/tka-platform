<script lang="ts">
  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { STAGE } from "@austencloud/scene-3d";
  import { getPerformerColor } from "../../constants/performer-colors";
  import {
    reportViewerControlChange,
    type ViewerControlSink,
  } from "$lib/shared/sequence-viewer/domain/viewer-control-analytics";

  interface Props {
    onInteract?: () => void;
    hasInteracted?: boolean;
    onSettingChange?: ViewerControlSink;
  }
  let { onInteract, hasInteracted = false, onSettingChange }: Props = $props();

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
    onInteract?.();
  }

  function selectPerformer(i: number): void {
    const previous = scopeValue(selectedIndex);
    const newIndex = i;
    viewer.selectPerformerScope(newIndex);
    reportViewerControlChange(
      onSettingChange,
      "viewer_3d_performer",
      "scope",
      previous,
      scopeValue(newIndex)
    );
    onInteract?.();
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
  <div class="performer-spine" role="toolbar" aria-label="Performer selection">
    <!-- Add button at top -->
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

    <!-- Performers: highest index at top, lowest at bottom -->
    {#each [...performers].reverse() as _, ri (performers.length - 1 - ri)}
      {@const i = performers.length - 1 - ri}
      {@const color = getPerformerColor(i)}
      <button
        class="spine-chip performer-chip"
        aria-pressed={hasInteracted && selectedIndex === i}
        aria-label="Performer {i + 1}"
        title="Performer {i + 1}"
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
      aria-pressed={hasInteracted && selectedIndex === null}
      aria-label="All performers"
      title="All performers"
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

  /* Add chip */
  .add-chip {
    border-style: dashed;
  }

  /* Separator */
  .separator {
    width: 32px;
    height: 1px;
    background: var(--theme-card-hover-bg);
    flex-shrink: 0;
  }

  /* ─── Focus-visible ─── */
  .spine-chip:focus-visible {
    outline: 2px solid var(--performer-color, var(--theme-accent));
    outline-offset: 2px;
  }

  /* ─── Reduced motion ─── */
  @media (prefers-reduced-motion: reduce) {
    .spine-chip {
      transition: none;
    }
  }
</style>
