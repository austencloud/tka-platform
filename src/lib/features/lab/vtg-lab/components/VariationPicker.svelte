<script lang="ts">
  import CardInspectModal from "$lib/features/choreo-card/components/CardInspectModal.svelte";
  import { resolveVariationSequence, type StyleVariation } from "../services/resolve-rotation-style-matrices";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    variations: StyleVariation[];
    turnPattern: string; // "blue|red"
    accent: string;
    onClose: () => void;
  }
  const { variations, turnPattern, accent, onClose }: Props = $props();

  let inspected = $state<SequenceData | null>(null);
  let busy = $state<string | null>(null);

  async function pick(v: StyleVariation) {
    busy = v.seedId;
    try {
      const seq = await resolveVariationSequence(v.seedId, turnPattern);
      if (seq) inspected = seq;
    } finally {
      busy = null;
    }
  }
</script>

{#if !inspected}
  <div
    class="backdrop"
    role="button"
    tabindex="-1"
    aria-label="Close variation picker"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
  >
    <div
      class="sheet"
      style="--accent: {accent};"
      role="dialog"
      aria-label="Pick a variation"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === "Escape" && onClose()}
    >
      <header>
        <span class="turns">Blue {turnPattern.split("|")[0]} · Red {turnPattern.split("|")[1]} turns</span>
        <button class="x" onclick={onClose} aria-label="Close"><i class="fas fa-xmark"></i></button>
      </header>
      <div class="grid">
        {#each variations as v (v.seedId)}
          <button class="chip" class:busy={busy === v.seedId} onclick={() => pick(v)}>
            <span class="word">{v.word}</span>
            {#if v.modeTag}<span class="tag">{v.modeTag}</span>{/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{:else}
  <CardInspectModal sequence={inspected} onClose={onClose} />
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 60;
    background: rgba(4, 12, 18, 0.6); backdrop-filter: blur(3px);
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }
  .sheet {
    width: min(440px, 92vw);
    background: rgba(16, 28, 38, 0.96);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, rgba(255, 255, 255, 0.1));
    border-radius: 16px; padding: 1rem 1.1rem 1.25rem;
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
  }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.85rem; }
  .turns { font-size: 0.85rem; font-weight: 600; color: #cfe6f2; font-variant-numeric: tabular-nums; }
  .x { border: none; background: transparent; color: rgba(255, 255, 255, 0.5); cursor: pointer; font-size: 1rem; padding: 0.25rem; }
  .x:hover { color: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 0.55rem; }
  .chip {
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem;
    padding: 0.6rem 0.4rem; min-height: 44px; cursor: pointer;
    border-radius: 10px; border: 1px solid color-mix(in srgb, var(--accent) 30%, rgba(255, 255, 255, 0.08));
    background: color-mix(in srgb, var(--accent) 10%, transparent); color: #fff;
    transition: transform 0.1s ease, background 0.12s ease;
  }
  .chip:hover { transform: translateY(-1px); background: color-mix(in srgb, var(--accent) 22%, transparent); }
  .chip.busy { opacity: 0.5; pointer-events: none; }
  .word { font-weight: 700; letter-spacing: 0.05em; }
  .tag { font-size: 0.7rem; opacity: 0.65; }
  @media (prefers-reduced-motion: reduce) { .chip { transition: none; } }
</style>
