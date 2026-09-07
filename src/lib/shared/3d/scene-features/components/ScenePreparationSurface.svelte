<script lang="ts">
  interface Props {
    statusText: string;
    progress?: number | null;
  }

  let { statusText, progress = null }: Props = $props();

  const boundedProgress = $derived(
    progress === null ? null : Math.max(0, Math.min(progress, 1))
  );
  const percent = $derived(
    boundedProgress === null ? null : Math.round(boundedProgress * 100)
  );
</script>

<div
  class="scene-preparation-surface"
  role="status"
  aria-live="polite"
  aria-busy="true"
  aria-label={`3D viewer, ${statusText}`}
  data-scene-preparation
  data-scene-preparation-label={statusText}
  data-scene-preparation-progress={boundedProgress ?? "indeterminate"}
>
  <div class="depth-grid" aria-hidden="true"></div>
  {#each Array.from({ length: 8 }, (_, id) => id) as id (id)}
    <span
      class="firefly"
      style={`--firefly-left:${10 + ((id * 37) % 80)}%;--firefly-top:${10 + ((id * 53) % 80)}%;--firefly-delay:${(id * 0.4) % 3.2}s;--firefly-duration:${2.5 + (id % 3) * 0.8}s`}
      aria-hidden="true"
    ></span>
  {/each}

  <div class="progress-area">
    <p class="mode-label">
      <i class="fas fa-cube" aria-hidden="true"></i>
      <span>3D viewer</span>
    </p>
    <div class="status-row">
      <span class="spinner" aria-hidden="true"></span>
      <p class="status-text">{statusText}</p>
    </div>
    <div
      class="progress-track"
      class:indeterminate={boundedProgress === null}
      role="progressbar"
      aria-label="3D scene preparation progress"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percent ?? undefined}
    >
      <div
        class="progress-fill"
        style:width={boundedProgress === null
          ? undefined
          : `${boundedProgress * 100}%`}
      ></div>
    </div>
    <p class="percent-text">
      {percent === null ? "Loading renderer" : `${percent}%`}
    </p>
  </div>
</div>

<style>
  .scene-preparation-surface {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background:
      radial-gradient(
        circle at 50% 42%,
        color-mix(in srgb, var(--theme-accent, #8b7cf6) 10%, #0a0e14),
        #0a0e14 68%
      );
  }

  .depth-grid {
    position: absolute;
    right: -16%;
    bottom: -31%;
    left: -16%;
    height: 62%;
    opacity: 0.12;
    background-image:
      linear-gradient(rgba(255, 210, 130, 0.48) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 210, 130, 0.48) 1px, transparent 1px);
    background-size: 42px 42px;
    mask-image: linear-gradient(to bottom, transparent, #000 32%, #000 78%, transparent);
    transform: perspective(480px) rotateX(62deg);
    transform-origin: center top;
    pointer-events: none;
  }

  .firefly {
    position: absolute;
    top: var(--firefly-top);
    left: var(--firefly-left);
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #d4e157;
    box-shadow: 0 0 8px 2px rgba(212, 225, 87, 0.4);
    opacity: 0;
    animation: drift var(--firefly-duration) ease-in-out var(--firefly-delay)
      infinite;
  }

  .progress-area {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    pointer-events: none;
  }

  .mode-label,
  .status-row {
    display: flex;
    align-items: center;
  }

  .mode-label {
    gap: 8px;
    margin: 0 0 2px;
    color: rgba(255, 255, 255, 0.68);
    font-size: var(--font-size-compact, 12px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .mode-label i {
    color: var(--theme-accent, #8b7cf6);
  }

  .status-row {
    gap: 10px;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 200, 120, 0.18);
    border-top-color: rgba(255, 200, 120, 0.95);
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }

  .status-text,
  .percent-text {
    margin: 0;
  }

  .status-text {
    color: rgba(255, 220, 170, 0.95);
    font-size: var(--font-size-base, 15px);
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  .progress-track {
    width: min(220px, 58cqw);
    height: 5px;
    overflow: hidden;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
  }

  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(
      90deg,
      rgba(255, 180, 70, 0.85),
      rgba(255, 210, 130, 0.95)
    );
    box-shadow: 0 0 10px rgba(255, 180, 70, 0.4);
    transition: width var(--transition-normal);
  }

  .progress-track.indeterminate .progress-fill {
    width: 42%;
    animation: indeterminate var(--duration-slow, 900ms)
      var(--ease-in-out, ease-in-out) infinite alternate;
  }

  .percent-text {
    min-height: 1.4em;
    color: rgba(255, 220, 170, 0.75);
    font-size: var(--font-size-compact, 12px);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.05em;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes drift {
    0%,
    100% {
      opacity: 0;
      transform: translate(0, 0);
    }
    25% {
      opacity: 0.7;
      transform: translate(12px, -8px);
    }
    50% {
      opacity: 0.3;
      transform: translate(-6px, -16px);
    }
    75% {
      opacity: 0.8;
      transform: translate(8px, -4px);
    }
  }

  @keyframes indeterminate {
    from {
      transform: translateX(-104%);
    }
    to {
      transform: translateX(242%);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .firefly,
    .spinner,
    .progress-track.indeterminate .progress-fill {
      animation: none;
    }

    .firefly {
      display: none;
    }

    .spinner {
      border-color: rgba(255, 200, 120, 0.7);
    }

    .progress-track.indeterminate .progress-fill {
      width: 34%;
      transform: translateX(96%);
    }
  }
</style>
