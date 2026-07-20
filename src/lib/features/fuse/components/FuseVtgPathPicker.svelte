<!--
  FuseVtgPathPicker — 1D VTG-path picker for one Fuse hand.

  Lists the diamond-default flower axis (28 paths) as tiles painted in the
  side's color, over the shared shape-matrix geometry + renderHeader. Picking a
  flower builds the single-hand solo (buildFlowerSequence over the shared
  archetype) and hands it back for setSource. BaseModal owns the shell; there is
  no page-level size control here (the SSR-fragile SegmentedControl stays out).
-->
<script module lang="ts">
  import type { FuseSide as FuseSideKey } from "../state/fuse-shuffle-pool.svelte";

  // Rendered tiles survive reopening and are shared across both source cards:
  // loadShapeMatrix caches the geometry, but the per-side canvas paint is not,
  // so memoize the data URLs per side at module scope.
  const tileCache = new Map<FuseSideKey, Map<string, string>>();
</script>

<script lang="ts">
  import { browser } from "$app/environment";
  import BaseModal from "$lib/shared/foundation/ui/modal/BaseModal.svelte";
  import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
  import {
    buildFlowerAxis,
    flowerKey,
    flowerLabel,
    type Flower,
  } from "$lib/shared/shape-matrix/domain/flower-signature";
  import {
    applyFilter,
    defaultAxisFilter,
  } from "$lib/shared/shape-matrix/domain/filter-flower-axis";
  import { loadShapeMatrix } from "$lib/shared/shape-matrix/services/shape-matrix-flowers";
  import { renderHeader } from "$lib/shared/shape-matrix/services/shape-matrix-render";
  import { resolveFlowerArchetype } from "$lib/shared/shape-matrix/services/flower-archetype";
  import { resolveRotationStyleMatrices } from "$lib/features/lab/vtg-lab/services/resolve-rotation-style-matrices";
  import { loadDiamondEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
  import { buildFlowerSequence } from "$lib/features/lab/vtg-lab/services/build-flower-sequence";
  import type { FuseSide } from "../state/fuse-shuffle-pool.svelte";

  let {
    side,
    onSelect,
    onClose,
  }: {
    side: FuseSide;
    onSelect: (sequence: SequenceData, label: string) => void;
    onClose: () => void;
  } = $props();

  const TILE_PX = 88;
  const label = $derived(side === "blue" ? "Blue" : "Red");

  // The flower list is deterministic and synchronous, so the tile grid has its
  // full structure from the first frame — only the painted images arrive async.
  // That keeps the modal from reflowing as thumbnails fill in.
  const flowers: Flower[] = applyFilter(
    buildFlowerAxis(),
    defaultAxisFilter(),
    true,
  );

  let tiles = $state<Map<string, string>>(tileCache.get(side) ?? new Map());
  let busy = $state(false);
  let open = $state(true);

  $effect(() => {
    if (!browser) return;
    const cached = tileCache.get(side);
    if (cached) {
      tiles = cached;
      return;
    }
    let cancelled = false;
    void (async () => {
      const data = await loadShapeMatrix();
      if (cancelled) return;
      const paintMap = side === "blue" ? data.blue : data.red;
      const built = new Map<string, string>();
      for (const flower of flowers) {
        const key = flowerKey(flower);
        const paths = paintMap.get(key);
        if (!paths) continue;
        built.set(key, renderHeader(paths, side, TILE_PX, data.clubTipDx));
      }
      if (cancelled) return;
      tileCache.set(side, built);
      tiles = built;
    })();
    return () => {
      cancelled = true;
    };
  });

  async function pick(flower: Flower): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const [matrices, edges] = await Promise.all([
        resolveRotationStyleMatrices("diamond"),
        loadDiamondEdges(),
      ]);
      const archetype = resolveFlowerArchetype(matrices, flower.style);
      const solo = buildFlowerSequence(archetype, flower, side, edges);
      onSelect(solo, flowerLabel(flower));
      open = false;
      onClose();
    } finally {
      busy = false;
    }
  }

  function close(): void {
    open = false;
    onClose();
  }
</script>

<BaseModal
  bind:open
  size="lg"
  onclose={close}
  labelledBy="fuse-vtg-picker-title"
>
  {#snippet header()}
    <div class="picker-header">
      <h2 id="fuse-vtg-picker-title" class="picker-title">
        Pick a {label} VTG path
      </h2>
      <p class="picker-sub">
        {flowers.length} paths — each is one hand's rotational shape.
      </p>
    </div>
  {/snippet}

  <div class="picker-body {side}">
    <div class="tile-grid" aria-busy={busy}>
      {#each flowers as flower (flowerKey(flower))}
        {@const url = tiles.get(flowerKey(flower))}
        <button
          type="button"
          class="tile"
          disabled={busy}
          title={flowerLabel(flower)}
          aria-label={flowerLabel(flower)}
          onclick={() => void pick(flower)}
        >
          <span class="tile-thumb" style="width:{TILE_PX}px;height:{TILE_PX}px">
            {#if url}
              <img src={url} alt="" width={TILE_PX} height={TILE_PX} />
            {/if}
          </span>
          <span class="tile-label">{flowerLabel(flower)}</span>
        </button>
      {/each}
    </div>
  </div>
</BaseModal>

<style>
  .picker-header {
    padding: 20px 24px 12px;
  }

  .picker-title {
    margin: 0;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-lg, 1.25rem);
    font-weight: 700;
  }

  .picker-sub {
    margin: 4px 0 0;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: var(--font-size-min, 0.875rem);
  }

  .picker-body {
    --tile-color: var(--prop-blue, #2196f3);
    padding: 8px 24px 24px;
  }

  .picker-body.red {
    --tile-color: var(--prop-red, #f44336);
  }

  .tile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 12px;
  }

  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 10px 8px;
    min-height: var(--min-touch-target, 44px);
    border: 1px solid
      color-mix(in srgb, var(--tile-color) 30%, var(--theme-stroke, rgba(255, 255, 255, 0.12)));
    border-radius: var(--settings-radius-md, 14px);
    background: color-mix(in srgb, var(--tile-color) 6%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)));
    color: var(--theme-text, #fff);
    cursor: pointer;
    transition:
      background var(--duration-fast, 150ms) ease,
      border-color var(--duration-fast, 150ms) ease,
      transform var(--duration-fast, 150ms) ease;
    -webkit-tap-highlight-color: transparent;
  }

  .tile:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .tile-thumb {
    display: grid;
    place-items: center;
    /* Reserve the square up front so the async image never shifts the grid. */
    border-radius: 8px;
    background: color-mix(in srgb, var(--theme-text, white) 4%, transparent);
  }

  .tile-thumb img {
    display: block;
  }

  .tile-label {
    font-size: 0.75rem;
    line-height: 1.2;
    text-align: center;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
  }

  @media (hover: hover) and (pointer: fine) {
    .tile:hover:not(:disabled) {
      transform: translateY(-1px);
      border-color: color-mix(in srgb, var(--tile-color) 60%, transparent);
      background: color-mix(in srgb, var(--tile-color) 14%, var(--theme-card-bg, rgba(255, 255, 255, 0.04)));
    }
  }

  .tile:focus-visible {
    outline: 2px solid var(--tile-color);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .tile {
      transition: none;
    }
  }
</style>
