<script lang="ts">
  import ChoreoCard from "$lib/features/choreo-card/components/ChoreoCard.svelte";
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

  interface ResolvedVariation {
    v: StyleVariation;
    seq: SequenceData;
  }

  let cards = $state<ResolvedVariation[]>([]);
  let loading = $state(true);
  let inspected = $state<SequenceData | null>(null);

  // Resolve every variation's real sequence at this turn pattern up front, so the
  // user picks by looking at the actual choreo card, not an opaque letter code.
  $effect(() => {
    const tp = turnPattern;
    loading = true;
    cards = [];
    Promise.all(
      variations.map((v) =>
        resolveVariationSequence(v.seedId, tp)
          .then((seq) => (seq ? { v, seq } : null))
          .catch(() => null),
      ),
    )
      .then((rs) => {
        if (tp === turnPattern) cards = rs.filter((r): r is ResolvedVariation => r !== null);
      })
      .finally(() => {
        if (tp === turnPattern) loading = false;
      });
  });

  const blueTurns = $derived(turnPattern.split("|")[0]);
  const redTurns = $derived(turnPattern.split("|")[1]);
</script>

{#if inspected}
  <!-- Drill one deeper into the full front+back card; closing returns to the gallery. -->
  <CardInspectModal sequence={inspected} onClose={() => (inspected = null)} />
{:else}
  <div
    class="backdrop"
    role="button"
    tabindex="-1"
    aria-label="Close"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
  >
    <div
      class="sheet"
      style="--accent: {accent};"
      role="dialog"
      aria-label="Pick a sequence"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === "Escape" && onClose()}
    >
      <header>
        <span class="turns">Blue {blueTurns} · Red {redTurns} turns</span>
        <button class="x" onclick={onClose} aria-label="Close"><i class="fas fa-xmark"></i></button>
      </header>

      {#if loading}
        <div class="status" role="status">Rendering cards…</div>
      {:else if cards.length === 0}
        <div class="status">No sequences.</div>
      {:else}
        <div class="card-grid">
          {#each cards as c (c.v.seedId)}
            <button class="card-cell" onclick={() => (inspected = c.seq)} aria-label="{c.v.word} ({c.v.modeTag}) — open full card">
              <div class="card-frame">
                <ChoreoCard sequence={c.seq} cardMode showWord showQRCodes={false} />
              </div>
              <span class="cap"><strong>{c.v.word}</strong>{#if c.v.modeTag}<span class="tag">{c.v.modeTag}</span>{/if}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 60;
    background: rgba(4, 12, 18, 0.62);
    backdrop-filter: blur(3px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }
  .sheet {
    width: min(960px, 94vw);
    max-height: 88vh;
    overflow-y: auto;
    background: rgba(16, 28, 38, 0.97);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, rgba(255, 255, 255, 0.1));
    border-radius: 18px;
    padding: 1rem 1.25rem 1.4rem;
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.5);
  }
  header {
    position: sticky;
    top: -0.2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-top: 0.2rem;
    background: linear-gradient(rgba(16, 28, 38, 0.97) 70%, transparent);
  }
  .turns {
    font-size: 0.9rem;
    font-weight: 600;
    color: #cfe6f2;
    font-variant-numeric: tabular-nums;
  }
  .x {
    border: none;
    background: transparent;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    font-size: 1.05rem;
    padding: 0.25rem;
  }
  .x:hover { color: #fff; }
  .status { padding: 2.5rem; text-align: center; color: rgba(255, 255, 255, 0.55); font-size: 0.9rem; }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }
  .card-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem;
    border: 1px solid transparent;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    transition: transform 0.12s ease, border-color 0.12s ease, background 0.12s ease;
  }
  .card-cell:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .card-cell:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 70%, transparent);
    outline-offset: 2px;
  }
  .card-frame {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
  }
  .cap {
    display: inline-flex;
    align-items: baseline;
    gap: 0.4rem;
    font-size: 0.8rem;
    letter-spacing: 0.05em;
    color: #fff;
  }
  .cap .tag { font-size: 0.7rem; opacity: 0.6; }
  @media (prefers-reduced-motion: reduce) {
    .card-cell { transition: none; }
  }
</style>
