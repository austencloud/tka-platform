<!--
  EffortSection.svelte

  Effort quality selector: 8 chips with colored dots representing
  different movement qualities (Flow, Sharp, Smooth, etc.).
-->
<script lang="ts">
  let {
    currentEffort,
    onSetEffort,
  }: {
    currentEffort: string | undefined;
    onSetEffort: (effort: string) => void;
  } = $props();

  const efforts: { value: string; label: string; dot: string }[] = [
    { value: "flow", label: "Flow", dot: "#a78bfa" },
    { value: "sharp", label: "Sharp", dot: "#f87171" },
    { value: "smooth", label: "Smooth", dot: "#60a5fa" },
    { value: "pulse", label: "Pulse", dot: "#fbbf24" },
    { value: "heavy", label: "Heavy", dot: "#34d399" },
    { value: "light", label: "Light", dot: "#f472b6" },
    { value: "staccato", label: "Staccato", dot: "#fb923c" },
    { value: "neutral", label: "Neutral", dot: "#94a3b8" },
  ];
</script>

<div class="effort-section">
  <div class="chip-grid" role="radiogroup" aria-label="Effort quality">
    {#each efforts as effort}
      <button
        class="chip"
        class:active={currentEffort === effort.value}
        role="radio"
        aria-checked={currentEffort === effort.value}
        onclick={() => onSetEffort(effort.value)}
        style:--chip-color={effort.dot}
      >
        <span class="color-dot" style:background={effort.dot}></span>
        {effort.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .effort-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: slideDown 180ms ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .chip-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .chip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 14px;
    min-height: 44px;
    border-radius: 22px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.08));
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .chip:hover {
    background: rgba(255, 255, 255, 0.07);
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  .chip.active {
    background: color-mix(in srgb, var(--chip-color, #a855f7) 10%, transparent);
    border-color: color-mix(in srgb, var(--chip-color, #a855f7) 30%, transparent);
    color: var(--chip-color, #a855f7);
  }

  .color-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    .effort-section {
      animation: none;
    }

    .chip {
      transition: none;
    }
  }
</style>
