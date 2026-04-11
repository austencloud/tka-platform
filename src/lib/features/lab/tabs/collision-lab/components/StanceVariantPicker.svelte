<script lang="ts">
  /**
   * StanceVariantPicker
   *
   * Row of variant cards the reviewer can switch between to try different
   * upper-body orientations on the current pose. Always visible so the
   * reviewer can compare variants before committing to a label.
   */

  import { getCollisionLabContext } from "../context/collision-lab-context";

  const { state } = getCollisionLabContext();
</script>

<div class="picker">
  <h4 class="title">Floor position (where the performer stands)</h4>
  <div class="variants">
    {#each state.stanceVariants as variant}
      <button
        class="variant"
        class:active={state.currentVariantIndex === variant.index}
        onclick={() => state.setVariant(variant.index)}
      >
        <span class="index">{variant.index}</span>
        <span class="desc">{variant.description}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: var(--theme-card-bg);
    border: 1px solid var(--theme-stroke);
    border-radius: 8px;
  }
  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    opacity: 0.8;
  }
  .variants {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
  }
  .variant {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--theme-panel-bg);
    border: 2px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    color: inherit;
    font-size: 13px;
    text-align: left;
  }
  .variant:hover {
    border-color: var(--theme-stroke);
  }
  .variant.active {
    border-color: #3b82f6;
    background: color-mix(in srgb, #3b82f6 15%, transparent);
  }
  .index {
    font-family: monospace;
    font-weight: 700;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--theme-stroke);
    border-radius: 4px;
    font-size: 11px;
  }
</style>
