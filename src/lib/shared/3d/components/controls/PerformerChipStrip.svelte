<script lang="ts">
  /**
   * PerformerChipStrip
   *
   * Compact performer selector pinned above the gear popover's tab bar.
   * Renders:
   *   [All] · [1] [2] [3] ... [+]
   *
   * - "All" chip: pinned leftmost, pill shape, selected when
   *   `selectedPerformerIndex === null`.
   * - Performer chips: one per performer, numbered 1-N, colored by index,
   *   selected when `selectedPerformerIndex === i`.
   * - "+" chip: rightmost, enabled when `count < MAX_VIEWER_PERFORMERS`.
   *
   * Visible whenever at least one performer exists - the "+" chip is the
   * only affordance for spawning a second performer, so hiding the strip
   * at count 1 would trap the user with no way to grow the group.
   */

  import { getViewer3DContext } from "../../context/viewer-3d-context";
  import { STAGE } from "@austencloud/scene-3d";

  const viewer3DState = getViewer3DContext();
  const performers = $derived(viewer3DState.performerManager.performers);
  const selectedIndex = $derived(viewer3DState.selectedPerformerIndex);
  const visible = $derived(performers.length >= 1);
  const canAdd = $derived(performers.length < STAGE.MAX_VIEWER_PERFORMERS);

  // Chip tint colors, cycled by performer index.
  // Blue, red, purple, orange, emerald, pink, cyan, yellow - matches the
  // tunnel layer colors used in Compose cell layers for visual consistency.
  const CHIP_COLORS = [
    "#3b82f6", "#ef4444", "#8b5cf6", "#f97316",
    "#10b981", "#ec4899", "#06b6d4", "#eab308",
  ];

  function chipColor(i: number): string {
    return CHIP_COLORS[i % CHIP_COLORS.length] ?? "#6b7280";
  }

  function selectAll(): void {
    viewer3DState.selectPerformerScope(null);
  }

  function selectPerformer(i: number): void {
    viewer3DState.selectPerformerScope(i);
  }

  function addPerformer(): void {
    viewer3DState.spawnPerformerFromUI();
  }
</script>

{#if visible}
  <div class="chip-strip" role="toolbar" aria-label="Performer selection">
    <button
      type="button"
      class="chip chip-all"
      class:active={selectedIndex === null}
      aria-pressed={selectedIndex === null}
      aria-label="Select all performers"
      onclick={selectAll}
    >
      All
    </button>

    <span class="separator" aria-hidden="true">·</span>

    {#each performers as _, i (i)}
      <button
        type="button"
        class="chip chip-performer"
        class:active={selectedIndex === i}
        aria-pressed={selectedIndex === i}
        aria-label={`Select performer ${i + 1}`}
        style="--chip-color: {chipColor(i)}"
        onclick={() => selectPerformer(i)}
      >
        {i + 1}
      </button>
    {/each}

    <button
      type="button"
      class="chip chip-add"
      aria-label="Add performer"
      disabled={!canAdd}
      onclick={addPerformer}
    >
      +
    </button>
  </div>
{/if}

<style>
  .chip-strip {
    /* Flex row with wrap so the strip degrades gracefully at 7-8 performers
       when the full row overflows. Common counts (1-6) sit on a single row.
       The pinned add button stays at the right edge regardless. */
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 5px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .chip {
    flex: 0 0 auto;
    box-sizing: border-box;
    min-width: 28px;
    height: 28px;
    padding: 0 10px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.82);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .chip:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12);
  }

  .chip:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .chip-all {
    padding: 0 12px;
    letter-spacing: 0.3px;
  }

  .chip-performer {
    width: 44px;
    padding: 0;
    border-color: var(--chip-color, rgba(255, 255, 255, 0.18));
  }

  .chip-performer.active {
    background: var(--chip-color, rgba(255, 255, 255, 0.18));
    color: #fff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
  }

  .chip-all.active {
    background: rgba(139, 139, 255, 0.3);
    border-color: rgba(139, 139, 255, 0.6);
    color: #fff;
  }

  .chip-add {
    /* Pinned to the right edge so the add button stays in the same
       viewport position as performers are spawned. Without this the button
       shifts right by one chip-width per click and the user has to chase
       it with their cursor. */
    margin-left: auto;
    width: 28px;
    padding: 0;
    font-size: 16px;
    line-height: 1;
  }

  .separator {
    color: rgba(255, 255, 255, 0.3);
    font-size: 13px;
    padding: 0 1px;
  }
</style>
