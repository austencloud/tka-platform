<!--
VTGIntroPage - Introduction page explaining VTG fundamentals
-->
<script lang="ts">
  import VTGComponentCard from "./VTGComponentCard.svelte";
  import VTGModeChips from "./VTGModeChips.svelte";

  let { onNext }: { onNext: () => void } = $props();
</script>

<div class="page">
  <h2>VTG Fundamentals</h2>

  <div class="intro-section">
    <p class="intro-text">
      <strong>VTG</strong> describes how your two hands coordinate together during
      movement.
    </p>

    <div class="vtg-components">
      <VTGComponentCard
        type="direction"
        icon="fa-arrows-alt-h"
        title="Direction"
        options="<strong>Split</strong> or <strong>Together</strong>"
        subtitle="Do hands move apart or in parallel?"
      />
      <VTGComponentCard
        type="timing"
        icon="fa-clock"
        title="Timing"
        options="<strong>Same</strong>, <strong>Opposite</strong>, or <strong>Quarter</strong>"
        subtitle="When do hands start relative to each other?"
      />
    </div>

    <VTGModeChips />
  </div>

  <button class="next-button" onclick={onNext}>
    Learn SS: Split-Same
    <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 700px;
    margin: 0 auto;
    width: 100%;
    animation: slideInUp var(--duration-dramatic) cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  h2 {
    font-size: 1.875rem;
    font-weight: 700;
    color: white;
    margin: 0;
    text-align: center;
    background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .intro-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .intro-text {
    font-size: 1.125rem;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
    text-align: center;
  }

  .vtg-components {
    display: flex;
    gap: 1rem;
    justify-content: center;
    flex-wrap: wrap;
  }

  .next-button {
    align-self: center;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 1rem 2.5rem;
    background: linear-gradient(
      135deg,
      rgba(34, 211, 238, 0.3) 0%,
      rgba(6, 182, 212, 0.3) 100%
    );
    border: 2px solid rgba(34, 211, 238, 0.5);
    border-radius: 12px;
    color: white;
    font-size: 1.0625rem;
    font-weight: 700;
    cursor: pointer;
    transition: all var(--duration-emphasis);
    min-height: 54px;
    margin-top: 0.5rem;
  }

  .next-button:hover {
    background: linear-gradient(
      135deg,
      rgba(34, 211, 238, 0.4) 0%,
      rgba(6, 182, 212, 0.4) 100%
    );
    border-color: rgba(34, 211, 238, 0.8);
    transform: translateY(-2px);
  }

  @media (max-width: 600px) {
    h2 {
      font-size: 1.5rem;
    }

    .vtg-components {
      flex-direction: column;
      align-items: center;
    }

    .next-button {
      width: 100%;
      max-width: 300px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }
  }
</style>
