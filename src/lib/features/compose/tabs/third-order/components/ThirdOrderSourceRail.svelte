<script lang="ts">
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { getThirdOrderContext } from "../context/third-order-context";
  import type { ThirdOrderChildDraft } from "../domain/third-order-composition";

  const state = getThirdOrderContext();

  function sequenceName(sequence: ThirdOrderChildDraft["sequence"]): string {
    return sequence.word || sequence.name || "Untitled sequence";
  }
</script>

<aside class="source-rail" aria-label="Third Order sources">
  <header class="rail-header">
    <span class="eyebrow">Coordinate systems</span>
    <h2>Sources</h2>
    <p>
      Each child keeps its own timing and prop relationship while its center
      rides the carrier.
    </p>
  </header>

  <section class="source-card carrier-card">
    <div class="card-heading">
      <span class="source-icon carrier-icon" aria-hidden="true">
        <i class="fas fa-atom"></i>
      </span>
      <div>
        <span class="source-kicker">Outer path</span>
        <h3>Carrier</h3>
      </div>
    </div>
    <p class="sequence-word">{sequenceName(state.composition.carrier)}</p>
    <p class="source-meta">
      {state.composition.carrier.steps.length} counts · both carrier lanes
    </p>
    <PanelButton fullWidth onclick={() => state.openPicker("carrier")}>
      Change carrier
    </PanelButton>
  </section>

  <div class="child-sources">
    {#each state.composition.children as child (child.id)}
      <section
        class:blue={child.id === "grid-blue"}
        class:red={child.id === "grid-red"}
        class:selected={state.selectedChildId === child.id}
        class="source-card child-card"
      >
        <button
          class="select-source"
          type="button"
          onclick={() => state.selectChild(child.id)}
          aria-pressed={state.selectedChildId === child.id}
        >
          <span class="source-icon" aria-hidden="true">
            <i class="fas fa-border-all"></i>
          </span>
          <span class="source-title">
            <span class="source-kicker">Inner system</span>
            <strong>{child.label}</strong>
          </span>
          <i class="fas fa-chevron-right select-chevron" aria-hidden="true"></i>
        </button>
        <p class="sequence-word">{sequenceName(child.sequence)}</p>
        <p class="source-meta">
          {child.sequence.steps.length} counts · rides {child.lane} carrier
        </p>
        <PanelButton fullWidth onclick={() => state.openPicker(child.id)}>
          Change sequence
        </PanelButton>
      </section>
    {/each}
  </div>

  <button
    class="duplicate-button"
    type="button"
    onclick={state.duplicateBlueToRed}
  >
    <i class="fas fa-clone" aria-hidden="true"></i>
    Duplicate blue setup to red
  </button>
</aside>

<style>
  .source-rail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    height: 100%;
    padding: 18px;
    overflow: auto;
    background: color-mix(
      in srgb,
      var(--theme-card-bg, #11131a) 86%,
      transparent
    );
  }

  .rail-header {
    display: grid;
    gap: 5px;
  }
  .rail-header h2 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: 20px;
  }
  .rail-header p {
    margin: 0;
    color: var(--theme-text-dim, #9ca3af);
    font-size: 13px;
    line-height: 1.45;
  }
  .eyebrow,
  .source-kicker {
    color: var(--theme-accent, #8b5cf6);
    font-size: 11px;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .source-card {
    display: grid;
    gap: 11px;
    padding: 14px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.13));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.055));
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  }

  .child-card {
    transition:
      border-color var(--duration-normal) ease,
      box-shadow var(--duration-normal) ease;
  }
  .child-card.selected.blue {
    border-color: color-mix(in srgb, var(--prop-blue, #3b82f6) 72%, white);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--prop-blue, #3b82f6) 22%, transparent);
  }
  .child-card.selected.red {
    border-color: color-mix(in srgb, var(--prop-red, #ef4444) 72%, white);
    box-shadow: 0 0 0 2px
      color-mix(in srgb, var(--prop-red, #ef4444) 22%, transparent);
  }
  .card-heading,
  .select-source {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .select-source {
    width: 100%;
    min-height: 44px;
    padding: 0;
    border: 0;
    color: inherit;
    background: transparent;
    text-align: left;
    cursor: pointer;
  }
  .select-source:focus-visible {
    outline: 3px solid var(--theme-focus-ring, #a78bfa);
    outline-offset: 4px;
    border-radius: 8px;
  }
  .source-title {
    display: grid;
    gap: 2px;
    flex: 1;
  }
  .source-title strong,
  .card-heading h3 {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: 15px;
  }
  .select-chevron {
    color: var(--theme-text-dim, #9ca3af);
    font-size: 12px;
  }

  .source-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    flex: 0 0 38px;
    border-radius: 11px;
    background: color-mix(in srgb, currentColor 13%, transparent);
    color: var(--theme-accent, #8b5cf6);
  }
  .blue .source-icon {
    color: var(--prop-blue, #3b82f6);
  }
  .red .source-icon {
    color: var(--prop-red, #ef4444);
  }
  .carrier-icon {
    color: #c084fc;
  }
  .sequence-word {
    margin: 0;
    overflow: hidden;
    color: var(--theme-text, #fff);
    font-size: 14px;
    font-weight: 650;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .source-meta {
    margin: -6px 0 0;
    color: var(--theme-text-dim, #9ca3af);
    font-size: 12px;
  }
  .child-sources {
    display: grid;
    gap: 12px;
  }

  .duplicate-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
    padding: 9px 12px;
    border: 1px dashed var(--theme-stroke-strong, rgba(255, 255, 255, 0.22));
    border-radius: 11px;
    background: transparent;
    color: var(--theme-text-dim, #b8bec9);
    font-size: 13px;
    cursor: pointer;
  }
  .duplicate-button:hover {
    border-style: solid;
    color: var(--theme-text, #fff);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.07));
  }

  @media (prefers-reduced-motion: reduce) {
    .child-card {
      transition: none;
    }
  }
</style>
