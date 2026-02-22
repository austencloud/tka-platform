<!--
  FuelSourcePicker.svelte

  Fuel source selection grid. Liquid fuels (fluid renderer) in a 3-column top row,
  particle fuels (charcoal) span full width below.
-->
<script lang="ts">
  import type { FuelSourceDocument } from "../domain/types/FuelSourceTypes";

  interface Props {
    fuelSources: FuelSourceDocument[];
    activeFuelId: string;
    onSelect: (id: string) => void;
  }

  let { fuelSources, activeFuelId, onSelect }: Props = $props();

  let fluidFuels = $derived(fuelSources.filter((f) => f.rendererType === "fluid"));
  let particleFuels = $derived(
    fuelSources.filter((f) => f.rendererType === "particle"),
  );

  const tintMap: Record<string, { base: string; active: string }> = {
    "white-gas": {
      base: "rgba(255, 140, 40, 0.08)",
      active: "rgba(255, 140, 40, 0.15)",
    },
    "lamp-oil": {
      base: "rgba(240, 100, 20, 0.08)",
      active: "rgba(240, 100, 20, 0.15)",
    },
    isopropyl: {
      base: "rgba(0, 64, 255, 0.08)",
      active: "rgba(0, 64, 255, 0.15)",
    },
    charcoal: {
      base: "rgba(180, 60, 20, 0.08)",
      active: "rgba(180, 60, 20, 0.15)",
    },
  };

  function getTint(fuel: FuelSourceDocument): string {
    const isActive = activeFuelId === fuel.id;
    const entry = tintMap[fuel.id];
    if (!entry) return "transparent";
    return isActive ? entry.active : entry.base;
  }
</script>

<div class="fuel-source-picker">
  <div class="fluid-row">
    {#each fluidFuels as fuel (fuel.id)}
      {@const isActive = activeFuelId === fuel.id}
      <button
        class="fuel-button"
        class:active={isActive}
        aria-pressed={isActive}
        aria-label="{fuel.name}: {fuel.description}"
        style:--fuel-tint={getTint(fuel)}
        onclick={() => onSelect(fuel.id)}
      >
        <span class="fuel-name">{fuel.name}</span>
        <span class="fuel-description">{fuel.description}</span>
      </button>
    {/each}
  </div>

  {#if particleFuels.length > 0}
    <div class="particle-row">
      {#each particleFuels as fuel (fuel.id)}
        {@const isActive = activeFuelId === fuel.id}
        <button
          class="fuel-button"
          class:active={isActive}
          aria-pressed={isActive}
          aria-label="{fuel.name}: {fuel.description}"
          style:--fuel-tint={getTint(fuel)}
          onclick={() => onSelect(fuel.id)}
        >
          <span class="fuel-name">{fuel.name}</span>
          <span class="fuel-description">{fuel.description}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .fuel-source-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  }

  .fluid-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .particle-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .fuel-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 12px 8px;
    background: var(--fuel-tint, var(--theme-card-bg, rgba(255, 255, 255, 0.04)));
    border: 1.5px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
    color: var(--theme-text, #ffffff);
    font-family: inherit;
  }

  .fuel-button:hover {
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.15));
  }

  .fuel-button.active {
    border: 2px solid var(--theme-accent, #7c6fe6);
  }

  .fuel-name {
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    line-height: 1.2;
  }

  .fuel-description {
    font-size: var(--font-size-compact, 12px);
    opacity: 0.65;
    line-height: 1.3;
    text-align: center;
  }
</style>
