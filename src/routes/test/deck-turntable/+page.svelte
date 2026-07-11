<!--
  /test/deck-turntable — eyes-on harness (NOT shipped) for Concept B "The
  Turntable". Loads the REAL shop products, feeds one flavor's cover cards to
  DeckTurntable, and sits it next to the current DeckFanCover for a direct
  before/after. Swap flavor + prop to verify retexture; crank foil to tune the
  iridescence. Deep-indigo nebula stage matches the configurator preview-box.
-->
<script lang="ts">
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
  import { createStoreState } from "$lib/features/store/state/store-state.svelte";
  import { setStoreContext } from "$lib/features/store/context/store-context";
  import DeckTurntable from "$lib/features/store/components/DeckTurntable.svelte";
  import DeckFanCover from "$lib/features/store/components/DeckFanCover.svelte";
  import { prewarmCovers } from "$lib/features/store/services/cover-front-renderer";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import {
    SHOP_PROP_OPTIONS,
    shopPropLabel,
  } from "$lib/features/store/domain/shop-prop-options";

  const store = createStoreState(getProductLoader(), getMerchCheckoutCreator());
  setStoreContext({ state: store });
  store.loadProducts(false);

  const flavorSkus = $derived(
    store.products
      .filter((p) => p.listing === "loop-deck" && p.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder)
  );

  let flavorIdx = $state(0);
  let propType = $state<PropType>(PropType.STAFF);
  let foil = $state(0);

  const sku = $derived(flavorSkus[flavorIdx] ?? null);
  const cards = $derived(sku?.coverCards ?? []);
  const flavorName = (n: string) => n.replace(/\s*LOOP Deck$/i, "");

  function stepFlavor(dir: number) {
    if (!flavorSkus.length) return;
    flavorIdx = (flavorIdx + dir + flavorSkus.length) % flavorSkus.length;
  }

  $effect(() => {
    const all = flavorSkus.flatMap((p) => p.coverCards ?? []);
    if (all.length) prewarmCovers(all, propType);
  });
</script>

<div class="page">
  <header>
    <h1>Deck Turntable — eyes-on harness</h1>
    <p>Real shop covers. Drag the card to spin. Swap flavor/prop → retexture. Foil slider tunes iridescence.</p>
  </header>

  {#if store.isLoading && flavorSkus.length === 0}
    <p class="status">Loading products…</p>
  {:else if flavorSkus.length === 0}
    <p class="status">No loop-deck products loaded.</p>
  {:else}
    <div class="controls">
      <div class="ctl">
        <span class="lbl">Flavor</span>
        <div class="row">
          <button onclick={() => stepFlavor(-1)}>‹</button>
          <span class="val">{sku ? flavorName(sku.name) : "—"}</span>
          <button onclick={() => stepFlavor(1)}>›</button>
        </div>
      </div>
      <div class="ctl">
        <span class="lbl">Prop</span>
        <div class="row wrap">
          {#each SHOP_PROP_OPTIONS as p (p)}
            <button class:on={propType === p} onclick={() => (propType = p)}>
              {shopPropLabel(p)}
            </button>
          {/each}
        </div>
      </div>
      <div class="ctl">
        <span class="lbl">Foil {foil.toFixed(2)}</span>
        <input type="range" min="0" max="1" step="0.05" bind:value={foil} />
      </div>
    </div>

    <div class="stages">
      <div class="stage-wrap">
        <span class="tag">Turntable (new)</span>
        <div class="stage">
          <DeckTurntable
            {cards}
            deckId={sku?.deckId}
            deckName={sku?.name}
            {propType}
            {foil}
          />
        </div>
      </div>
      <div class="stage-wrap">
        <span class="tag">Fan (current / fallback)</span>
        <div class="stage">
          <DeckFanCover
            {cards}
            deckId={sku?.deckId}
            deckName={sku?.name}
            {propType}
            cardWidth={190}
            maxCardWidth={300}
            exactCount={Math.min(6, cards.length)}
          />
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    min-height: 100vh;
    padding: 24px clamp(16px, 3vw, 48px) 80px;
    background:
      radial-gradient(120% 80% at 78% 12%, rgba(70, 60, 140, 0.35) 0%, transparent 55%),
      radial-gradient(130% 100% at 50% -10%, #181b3d 0%, #0c0e20 48%, #06070f 100%);
    color: #e8edf6;
    font-family: system-ui, sans-serif;
  }
  header h1 { margin: 0 0 4px; font-size: 1.4rem; }
  header p { margin: 0 0 20px; color: #9aa6b8; font-size: 0.9rem; }
  .status { color: #9aa6b8; }

  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 24px;
    align-items: flex-end;
    margin-bottom: 24px;
    padding: 16px;
    border-radius: 14px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
  }
  .ctl { display: flex; flex-direction: column; gap: 8px; }
  .lbl {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #9aa6b8;
    font-variant-numeric: tabular-nums;
  }
  .row { display: flex; align-items: center; gap: 8px; }
  .row.wrap { flex-wrap: wrap; }
  .val { min-width: 160px; font-weight: 700; }
  button {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.05);
    color: #e8edf6;
    cursor: pointer;
    font-weight: 600;
  }
  button.on { background: #6366f1; border-color: #6366f1; color: #fff; }
  input[type="range"] { width: 200px; }

  .stages {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 24px;
  }
  .stage-wrap { display: flex; flex-direction: column; gap: 8px; }
  .tag { font-size: 0.8rem; color: #9aa6b8; font-weight: 600; }
  .stage {
    position: relative;
    height: clamp(400px, 52vh, 560px);
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background:
      radial-gradient(56% 48% at 50% 40%, rgba(139, 108, 255, 0.34), transparent 68%),
      radial-gradient(38% 34% at 68% 66%, rgba(84, 209, 196, 0.12), transparent 70%),
      radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.015));
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
