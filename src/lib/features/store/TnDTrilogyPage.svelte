<!-- src/lib/features/store/TnDTrilogyPage.svelte -->
<!--
  Timing & Direction trilogy: ONE listing over the TKA 1/2/3 volume SKUs
  (products with listing === "tnd-trilogy"). Buyer picks a volume, sees the
  real color-coded printed cards fan + element legend, and buys the resolved
  SKU. The all-three package renders as a visible option, gated until it has a
  price.
-->
<script lang="ts">
  import { getMerchCheckoutCreator } from "$lib/features/store/get-merch-checkout-creator";
  import { getProductLoader } from "$lib/features/store/get-product-loader";
  import { createStoreState } from "./state/store-state.svelte";
  import { setStoreContext } from "./context/store-context";
  import DeckFanCover from "./components/DeckFanCover.svelte";
  import BuyButton from "./components/BuyButton.svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { TND_ELEMENTS } from "$lib/features/choreo-card/domain/tnd-element";

  // Named `store`, not `state`: a local binding called `state` collides with the
  // $state rune (svelte store_rune_conflict).
  const store = createStoreState(getProductLoader(), getMerchCheckoutCreator());
  setStoreContext({ state: store });
  store.loadProducts(false);

  const volumes = $derived(
    store.products
      .filter((p) => p.listing === "tnd-trilogy" && p.status === "active")
      .sort((a, b) => a.sortOrder - b.sortOrder)
  );

  let selectedId = $state<string | null>(null);
  const selected = $derived(
    volumes.find((p) => p.id === selectedId) ?? volumes[0] ?? null
  );

  const price = $derived(
    selected ? `$${(selected.price / 100).toFixed(0)}` : "$30"
  );

  // "TKA 1: Learning Letters" -> ["TKA 1", "Learning Letters"]
  const nameParts = (name: string): [string, string] => {
    const i = name.indexOf(":");
    return i > 0 ? [name.slice(0, i), name.slice(i + 1).trim()] : [name, ""];
  };

  // Roving radiogroup: arrows move selection, exactly one option tabbable.
  function onPickerKeydown(e: KeyboardEvent) {
    if (!selected || volumes.length === 0) return;
    const idx = volumes.findIndex((v) => v.id === selected.id);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % volumes.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + volumes.length) % volumes.length;
    const target = next >= 0 ? volumes[next] : undefined;
    if (!target) return;
    e.preventDefault();
    selectedId = target.id;
    document.getElementById(`volume-${target.id}`)?.focus();
  }
</script>

<div class="config-page">
  <main class="config-content">
    <a href="/shop" class="back-button">
      <i class="fas fa-arrow-left" aria-hidden="true"></i> Shop
    </a>

    {#if store.error}
      <div class="error">{store.error}</div>
    {:else if store.isLoading && volumes.length === 0}
      <div class="loading">Loading the trilogy...</div>
    {:else if selected}
      <div class="config-layout">
        <!-- ============ preview column ============ -->
        <div class="preview-column">
          <div class="preview-box">
            <Crossfade key={selected.id}>
              <div class="preview-inner">
                <DeckFanCover
                  cards={selected.coverCards ?? []}
                  deckName={selected.name}
                  cardWidth={168}
                  maxCardWidth={280}
                />
                <p class="preview-desc">{selected.description}</p>
              </div>
            </Crossfade>
          </div>

          <div class="legend" aria-label="Element color legend">
            {#each TND_ELEMENTS as el (el.familyId)}
              <span class="legend-item">
                <span class="legend-dot" style:--c={el.accentColor}></span>
                <span>{el.name}</span>
              </span>
            {/each}
          </div>
        </div>

        <!-- ============ choices column ============ -->
        <div class="info-column">
          <span class="eyebrow">The trilogy</span>
          <h1>Timing &amp; Direction</h1>
          <p class="meta">
            Three volumes, one system: every card color-coded by its timing and
            direction family.
          </p>

          <div class="field">
            <span class="field-label" id="volume-label">Volume</span>
            <div class="volume-grid" role="radiogroup" aria-labelledby="volume-label">
              {#each volumes as volume (volume.id)}
                {@const active = volume.id === selected.id}
                {@const [num, title] = nameParts(volume.name)}
                <button
                  type="button"
                  id="volume-{volume.id}"
                  class="volume-option"
                  class:active
                  role="radio"
                  aria-checked={active}
                  tabindex={active ? 0 : -1}
                  onclick={() => (selectedId = volume.id)}
                  onkeydown={onPickerKeydown}
                >
                  <span class="volume-num">{num}</span>
                  <span class="volume-title">{title}</span>
                  <span class="volume-meta">{volume.cardCount} cards · ${(volume.price / 100).toFixed(0)}</span>
                </button>
              {/each}
              <!-- Package option: visible so the offer is legible, gated until priced. -->
              <div class="volume-option package" aria-disabled="true">
                <span class="volume-num">All three</span>
                <span class="volume-title">The complete trilogy</span>
                <span class="volume-meta">bundle pricing coming soon</span>
              </div>
            </div>
          </div>

          <p class="price">{price}</p>

          <BuyButton product={selected} />
          {#if store.checkoutError}
            <p class="checkout-error" role="alert">{store.checkoutError}</p>
          {/if}

          <ul class="assurance">
            <li><i class="fas fa-box-open" aria-hidden="true"></i> Free laminated quick-reference sheet and deck box included</li>
            <li><i class="fas fa-hand-holding-heart" aria-hidden="true"></i> Beta run: printed and cut by hand in Chicago, small batches</li>
          </ul>
        </div>
      </div>
    {:else}
      <div class="error">The trilogy isn't available right now.</div>
    {/if}
  </main>
</div>

<style>
  .config-page {
    min-height: 100vh;
    padding-top: 64px; /* clear the fixed SiteHeader */
    background: transparent; /* cosmic BackgroundHost shows through */
    color: var(--theme-text, #ffffff);
  }

  .config-content {
    max-width: min(1720px, 92vw);
    margin: 0 auto;
    padding: 40px 24px 80px;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: var(--min-touch-target, 44px);
    padding: 0 18px;
    margin-bottom: 24px;
    border-radius: 999px;
    border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.15));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    color: var(--theme-text, #ffffff);
    text-decoration: none;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    transition: background 0.2s, border-color 0.2s;
  }
  .back-button:hover {
    background: var(--theme-card-bg-hover, rgba(255, 255, 255, 0.08));
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }

  .config-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: clamp(28px, 4vw, 56px);
    align-items: start;
  }

  @media (max-width: 860px) {
    .config-layout {
      grid-template-columns: 1fr;
    }
  }

  /* ---------- preview ---------- */
  .preview-box {
    border-radius: 20px;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    background: radial-gradient(
      circle at 50% 38%,
      rgba(255, 255, 255, 0.05),
      rgba(255, 255, 255, 0.015)
    );
    padding: clamp(16px, 2.5vw, 32px);
    min-height: 430px;
  }

  .preview-inner {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .preview-desc {
    font-size: var(--font-size-min, 14px);
    line-height: 1.65;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.75));
    margin: 0;
    text-align: center;
    max-width: 56ch;
    align-self: center;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px 16px;
    margin-top: 14px;
  }
  .legend-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: var(--font-size-compact, 12px);
    font-weight: 600;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.7));
  }
  .legend-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--c);
    border: 1px solid rgba(255, 255, 255, 0.35);
  }

  /* ---------- info ---------- */
  .info-column {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .eyebrow {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #b8a6ff;
  }

  h1 {
    font-size: clamp(1.8rem, 3vw, 2.4rem);
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .meta {
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .field-label {
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }

  .volume-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
  }

  .volume-option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-height: var(--min-touch-target, 44px);
    padding: 12px 14px;
    border-radius: 12px;
    border: 2px solid var(--theme-stroke, rgba(255, 255, 255, 0.12));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.03));
    color: var(--theme-text, #fff);
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, background 0.15s ease;
    font-family: inherit;
  }
  .volume-option:hover:not(.package) {
    border-color: var(--theme-border-strong, rgba(255, 255, 255, 0.3));
  }
  .volume-option.active {
    border-color: #8b6cff;
    background: rgba(139, 108, 255, 0.12);
  }
  .volume-option:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  .volume-option.package {
    opacity: 0.55;
    cursor: default;
  }

  .volume-num {
    font-size: var(--font-size-compact, 12px);
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #b8a6ff;
  }
  .volume-title {
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
  }
  .volume-meta {
    font-size: var(--font-size-compact, 12px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
    font-variant-numeric: tabular-nums;
  }

  .price {
    font-size: 2rem;
    font-weight: 800;
    color: var(--theme-accent, #60a5fa);
    margin: 0;
    font-variant-numeric: tabular-nums;
  }

  .checkout-error {
    margin: 0;
    text-align: center;
    font-size: var(--font-size-sm, 14px);
    color: var(--semantic-error, #ef4444);
  }

  .assurance {
    list-style: none;
    margin: 4px 0 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .assurance li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--font-size-min, 14px);
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.66));
  }
  .assurance i {
    color: #8b6cff;
    flex: 0 0 auto;
  }

  .loading, .error {
    text-align: center;
    padding: 48px;
    color: var(--theme-text-muted, rgba(255, 255, 255, 0.6));
  }
  .error {
    color: var(--semantic-error, #ef4444);
  }

  @media (prefers-reduced-motion: reduce) {
    .back-button,
    .volume-option {
      transition: none;
    }
  }
</style>
