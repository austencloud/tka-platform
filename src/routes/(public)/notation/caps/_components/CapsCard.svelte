<!--
  CapsCard — a focused, self-contained destination panel for the CAPs hub. One
  screen, no inner scroll: a headline, one visual/takeaway, and optional
  drill-down buttons to focus a sub-aspect (per Austen's IA: never overwhelming,
  everything in front of you). The parent (CapsHub) owns the FLIP morph that
  springs this panel open from its tile; this component is presentational and
  emits close.

  SLICE: only the "what-is" destination is authored. The others are wired later
  once the morph feel is confirmed.
-->
<script lang="ts">
  import { fade } from "svelte/transition";

  let {
    id,
    title,
    color,
    onClose,
  }: {
    id: string;
    title: string;
    color: string;
    onClose: () => void;
  } = $props();

  let closeEl = $state<HTMLButtonElement | null>(null);
  $effect(() => {
    closeEl?.focus();
  });

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }
</script>

<div
  class="caps-card"
  style="--card-accent: {color}"
  role="dialog"
  aria-modal="true"
  aria-label={title}
  onkeydown={onKeydown}
  tabindex="-1"
>
  <header class="card-head">
    <h2>{title}</h2>
    <button bind:this={closeEl} class="card-close" type="button" onclick={onClose} aria-label="Close">
      <i class="fas fa-xmark" aria-hidden="true"></i>
    </button>
  </header>

  <div class="card-body" in:fade={{ duration: 180, delay: 120 }}>
    {#if id === "what-is"}
      <p class="lead">
        A CAP is a closed loop one prop traces, assembled from two or more
        simpler patterns joined end to end.
      </p>
      <p>
        The pattern on the hub is the one the whole idea grew around: half a
        cycle of extension, half a cycle of antispin, joined into a single curve
        that repeats forever. Change the pieces or how they join and you get a
        different CAP.
      </p>
    {:else}
      <p class="lead">Coming next.</p>
    {/if}
  </div>
</div>

<style>
  .caps-card {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: clamp(1.4rem, 3vw, 2.6rem);
    border-radius: 20px;
    border: 1px solid color-mix(in oklch, var(--card-accent) 40%, rgba(255, 255, 255, 0.12));
    background: oklch(0.16 0.02 270 / 0.86);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
    box-shadow: 0 40px 90px -40px rgba(0, 0, 0, 0.75);
    color: #f2f1fb;
    overflow: hidden;
  }

  .card-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: clamp(1rem, 2.4vh, 1.8rem);
  }
  .card-head h2 {
    margin: 0;
    font-size: clamp(1.6rem, 2.6vw, 2.8rem);
    font-weight: 760;
    letter-spacing: -0.02em;
    color: var(--card-accent);
  }
  .card-close {
    flex: 0 0 auto;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: rgba(255, 255, 255, 0.06);
    color: #f2f1fb;
    font-size: 1.1rem;
    cursor: pointer;
    transition:
      background 0.2s ease,
      border-color 0.2s ease;
  }
  .card-close:hover,
  .card-close:focus-visible {
    background: rgba(255, 255, 255, 0.12);
    border-color: var(--card-accent);
  }

  .card-body {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    justify-content: center;
    max-width: 62ch;
  }
  .card-body .lead {
    margin: 0;
    font-size: clamp(1.15rem, 1.7vw, 1.7rem);
    line-height: 1.4;
    color: #f2f1fb;
  }
  .card-body p {
    margin: 0;
    font-size: clamp(0.98rem, 1.15vw, 1.2rem);
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.78);
  }

  @media (prefers-reduced-motion: reduce) {
    .card-close {
      transition: none;
    }
  }
</style>
