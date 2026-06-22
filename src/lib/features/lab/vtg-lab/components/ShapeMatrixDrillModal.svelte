<script lang="ts">
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import ModalHeader from "$lib/shared/foundation/ui/modal/ModalHeader.svelte";
  import TKAWordGlyph from "$lib/shared/choreo-card/components/TKAWordGlyph.svelte";
  import AnimationPlayer from "$lib/shared/sequence-viewer/components/AnimationPlayer.svelte";
  import { loadRealizations, type Realization } from "../services/shape-matrix-realizations";
  import { buildRealizationSequence } from "../services/build-realization-sequence";
  import { flowerLabel, type Flower } from "../domain/flower-signature";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";

  interface Props {
    open: boolean;
    pair: { blue: Flower; red: Flower } | null;
    onClose: () => void;
  }
  let { open, pair, onClose }: Props = $props();

  let items = $state<{ r: Realization; seq: SequenceData }[]>([]);
  let loading = $state(false);

  $effect(() => {
    const p = pair;
    if (!open || !p) {
      items = [];
      return;
    }
    let cancelled = false;
    loading = true;
    (async () => {
      const reals = await loadRealizations(p.blue.style, p.red.style);
      // Per-item null-safe: a letter with no base sequence resolves to null and is dropped,
      // never rejecting the whole batch.
      const built = await Promise.all(
        reals.map(async (r) => {
          try {
            const seq = await buildRealizationSequence(r, p);
            return seq ? { r, seq } : null;
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) {
        items = built.filter((x): x is { r: Realization; seq: SequenceData } => x !== null);
        loading = false;
      }
    })();
    return () => {
      cancelled = true;
    };
  });

</script>

<BaseModal {open} onclose={onClose} size="xl">
  {#snippet header()}
    <ModalHeader
      title={pair ? `${flowerLabel(pair.blue)}  ⊕  ${flowerLabel(pair.red)}` : ""}
      subtitle="Ways to realize this overlay"
      showClose
      {onClose}
    />
  {/snippet}

  <div class="reals">
    {#if loading}
      <div class="empty">Loading realizations…</div>
    {:else if items.length === 0}
      <div class="empty">No catalogued TKA letters for this style pair.</div>
    {:else}
      {#each items as { r, seq } (r.mode)}
        <div class="real">
          <div class="anim">
            <AnimationPlayer sequence={seq} autoPlay controlsLevel="minimal" hideWordHeader hideProgressBar />
          </div>
          <div class="cap">
            <TKAWordGlyph word={r.letter} height={22} darkMode />
            <span class="vtg" title={r.modeLabel}>{r.mode}</span>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</BaseModal>

<style>
  .reals {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    padding: 8px;
  }
  .real {
    border: 1px solid #1e2a36;
    border-radius: 10px;
    overflow: hidden;
    background: #0d141b;
  }
  .real .anim {
    aspect-ratio: 1;
  }
  .real .cap {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
  }
  .vtg {
    font-size: 11px;
    color: #7e93a6;
    border: 1px solid #1e2a36;
    border-radius: 6px;
    padding: 1px 6px;
  }
  .empty {
    color: #7e93a6;
    padding: 24px;
    text-align: center;
    grid-column: 1 / -1;
  }
</style>
