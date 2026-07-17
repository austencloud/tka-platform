<!--
  ScanCardPeek

  The card half of the QR-scan notification destination. When an admin taps a
  scan notification, the Scan Activity map flies to the pin and this panel peeks
  the scanned card beside it: its thumbnail, simplified word, where it was
  scanned, and a button straight to /q/{code}. Dismissible.

  Reuses PropAwareThumbnail (the canonical sequence thumbnail) rather than
  mounting the full viewer ChoreoCard — a peek doesn't need the interactive grid.
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import PropAwareThumbnail from "$lib/shared/browse/components/PropAwareThumbnail.svelte";
  import { simplifyRepeatedWord } from "$lib/shared/foundation/utils/word-simplifier";
  import type { CodeEntry } from "$lib/features/choreo-card/state/scan-activity-state.svelte";

  interface Props {
    code: string;
    /** Resolved entry from scan-activity state; null until it decodes/loads. */
    entry: CodeEntry | null;
    onClose: () => void;
  }

  const { code, entry, onClose }: Props = $props();

  const word = $derived(simplifyRepeatedWord(entry?.word || code));
  const where = $derived(
    [entry?.lastCity, entry?.lastCountry].filter(Boolean).join(", ")
  );

  function openCard() {
    goto(`/q/${code}`);
  }
</script>

<aside class="peek" aria-label="Scanned card">
  <header class="peek-top">
    <span class="peek-title">{word}</span>
    <button
      type="button"
      class="close"
      aria-label="Close card preview"
      onclick={onClose}
    >
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
  </header>

  <div class="thumb">
    {#if entry?.decoded}
      <PropAwareThumbnail sequence={entry.decoded} eager allowQR={false} />
    {:else}
      <div class="thumb-empty">
        <i class="fas fa-id-card" aria-hidden="true"></i>
        <p>Loading card…</p>
      </div>
    {/if}
  </div>

  {#if where}
    <p class="where"><i class="fas fa-location-dot" aria-hidden="true"></i> {where}</p>
  {/if}

  <button type="button" class="open" onclick={openCard}>
    <i class="fas fa-up-right-from-square" aria-hidden="true"></i>
    Open card
  </button>
</aside>

<style>
  .peek {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: var(--theme-card-bg, #141824);
    border: 1px solid var(--theme-stroke, #1a1f2e);
    border-radius: 12px;
    min-width: 0;
  }

  .peek-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .peek-title {
    flex: 1;
    min-width: 0;
    color: var(--theme-text, #fff);
    font-size: var(--font-size-md, 16px);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .close {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--theme-stroke, #222838);
    border-radius: 8px;
    background: transparent;
    color: var(--theme-text-dim, #8b93a7);
    cursor: pointer;
    transition: background var(--duration-normal, 0.2s) ease;
  }
  .close:hover {
    background: var(--theme-panel-bg, #0b0d17);
    color: var(--theme-text, #fff);
  }
  .close:focus-visible {
    outline: 2px solid var(--theme-accent, #34d399);
    outline-offset: 2px;
  }

  .thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 5 / 7;
    border-radius: 8px;
    overflow: hidden;
    background: var(--theme-panel-bg, #080a12);
  }

  .thumb-empty {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    justify-content: center;
    color: var(--theme-text-dim, #6b7491);
  }
  .thumb-empty i {
    font-size: 40px;
    opacity: 0.4;
  }
  .thumb-empty p {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
  }

  .where {
    margin: 0;
    color: var(--theme-text-dim, #8b93a7);
    font-size: var(--font-size-sm, 14px);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .open {
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 8px;
    background: var(--theme-accent, #10b981);
    color: var(--theme-on-accent, #04120c);
    font: inherit;
    font-size: var(--font-size-sm, 14px);
    font-weight: 600;
    cursor: pointer;
    transition: filter var(--duration-normal, 0.2s) ease;
  }
  .open:hover {
    filter: brightness(1.08);
  }
  .open:focus-visible {
    outline: 2px solid var(--theme-accent, #34d399);
    outline-offset: 2px;
  }
</style>
