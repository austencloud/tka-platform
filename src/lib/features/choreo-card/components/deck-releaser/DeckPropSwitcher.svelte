<!--
  DeckPropSwitcher — compact header button that shows the deck's current prop and
  opens the canonical BentoPropGrid picker in a modal. Used in the TnD compose
  header (LOOP decks set the prop via the bento Prop tile instead). Reads/writes
  rs.selectedPropType directly, matching LoopBentoBoard's rs-aware children. The
  modal markup/styling mirrors LoopBentoBoard's picker-overlay so the two read as
  one system.
-->
<script lang="ts">
  import { scale } from "svelte/transition";
  import { quintOut } from "svelte/easing";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
  import BentoPropGrid from "$lib/shared/settings/components/tabs/prop-type/BentoPropGrid.svelte";
  import { getDeckReleaserContext } from "./context/deck-releaser-context";

  const { state: rs } = getDeckReleaserContext();

  let open = $state(false);

  const propLabel = $derived(getPropTypeDisplayInfo(rs.bluePropType).label);
</script>

<button
  type="button"
  class="prop-toggle"
  onclick={() => (open = true)}
  aria-label="Change deck prop (currently {propLabel})"
  aria-haspopup="dialog"
>
  <i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
  <span class="prop-toggle-label">Prop</span>
  <span class="prop-toggle-value">{propLabel}</span>
</button>

{#if open}
  <div class="modal-backdrop" role="presentation" onclick={(e) => { if (e.target === e.currentTarget) open = false; }}>
    <div class="picker-overlay" role="dialog" aria-label="Select deck prop" transition:scale={{ start: 0.95, duration: 250, easing: quintOut }}>
      <div class="po-header">
        <h3>Deck Prop</h3>
        <button class="po-close" aria-label="Close" onclick={() => (open = false)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="po-body">
        <BentoPropGrid
          selectedPropType={rs.bluePropType}
          variant="inline"
          title="Select Prop"
          onSelect={(p: PropType) => { rs.selectedPropType = p; rs.persist(); open = false; }}
        />
      </div>
      <button class="po-done" onclick={() => (open = false)}>Done</button>
    </div>
  </div>
{/if}

<style>
  .prop-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    padding: 10px 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 8px;
    color: var(--theme-text, #fff);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease;
    white-space: nowrap;
  }
  .prop-toggle:hover {
    border-color: var(--theme-accent, #8b5cf6);
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.08));
  }
  .prop-toggle i { color: var(--theme-accent, #a78bfa); font-size: 13px; }
  .prop-toggle-label { color: var(--theme-text-dim, rgba(255, 255, 255, 0.55)); }
  .prop-toggle-value { color: var(--theme-text, #fff); }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(16px, 4vh, 48px);
    background: rgba(4, 7, 14, 0.62);
    backdrop-filter: blur(5px);
  }
  .picker-overlay {
    width: min(880px, 94vw);
    max-height: min(840px, 90vh);
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    background: linear-gradient(135deg,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 25%, #1a1a2e) 0%,
      color-mix(in srgb, var(--theme-accent, #818cf8) 15%, #1a1a2e) 50%,
      color-mix(in srgb, var(--theme-accent-strong, #6366f1) 20%, #1a1a2e) 100%);
    border-radius: 18px;
    border: 2px solid color-mix(in srgb, var(--theme-accent) 50%, transparent);
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
    overflow: hidden;
  }
  .po-header { display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
  .po-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #fff; }
  .po-close { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 8px; }
  .po-close svg { width: 20px; height: 20px; }
  .po-close:hover { background: rgba(255, 255, 255, 0.15); }
  .po-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
  .po-done { flex-shrink: 0; width: 100%; padding: 12px 20px; min-height: 44px; background: color-mix(in srgb, var(--theme-accent) 30%, transparent); border: 2px solid var(--theme-accent); border-radius: 10px; color: #fff; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; }
  .po-done:hover { background: color-mix(in srgb, var(--theme-accent) 45%, transparent); }

  @media (prefers-reduced-motion: reduce) {
    .prop-toggle { transition: none; }
  }
</style>
