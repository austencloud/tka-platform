<script lang="ts">
  /**
   * LoadingButton - Button with integrated fill-sweep progress animation.
   *
   * Three visual states:
   *   1. Idle — normal button with icon + label
   *   2. Loading — gradient sweep fills left→right, label changes
   *   3. Done — brief success flash, then resets to idle
   *
   * Supports both indeterminate (no percent) and deterministic (0-100) modes.
   */

  import type { Snippet } from "svelte";

  interface Props {
    /** Whether the button is in loading state. */
    loading?: boolean;
    /** 0-100 for deterministic fill. Omit for indeterminate pulse. */
    percent?: number | null;
    /** Idle label text. */
    label?: string;
    /** Loading label text. */
    loadingLabel?: string;
    /** FontAwesome icon class (e.g. "fa-wand-magic-sparkles"). */
    icon?: string;
    /** Click handler. */
    onclick?: () => void;
    /** Disable the button entirely. */
    disabled?: boolean;
    /** Custom snippet for button content (overrides label/icon). */
    children?: Snippet;
  }

  let {
    loading = false,
    percent = null,
    label = "Submit",
    loadingLabel = "Working...",
    icon,
    onclick,
    disabled = false,
    children,
  }: Props = $props();

  const isDeterminate = $derived(percent !== null && percent !== undefined);
  const fillWidth = $derived(isDeterminate ? Math.max(0, Math.min(100, percent!)) : 0);
  const isDisabled = $derived(disabled || loading);

  // Track completion for flash animation
  let showDone = $state(false);
  let wasLoading = $state(false);
  let doneTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (wasLoading && !loading) {
      showDone = true;
      doneTimer = setTimeout(() => {
        showDone = false;
        doneTimer = null;
      }, 600);
    }
    wasLoading = loading;

    return () => {
      if (doneTimer) clearTimeout(doneTimer);
    };
  });
</script>

<button
  class="loading-button"
  class:is-loading={loading}
  class:is-done={showDone}
  class:is-indeterminate={loading && !isDeterminate}
  {onclick}
  disabled={isDisabled}
  type="button"
>
  <!-- Deterministic fill overlay -->
  {#if loading && isDeterminate}
    <div class="fill-sweep" style:width="{fillWidth}%"></div>
  {/if}

  <!-- Indeterminate shimmer overlay -->
  {#if loading && !isDeterminate}
    <div class="indeterminate-sweep"></div>
  {/if}

  <!-- Done flash overlay -->
  {#if showDone}
    <div class="done-flash"></div>
  {/if}

  <!-- Content -->
  <span class="btn-content">
    {#if children}
      {@render children()}
    {:else if showDone}
      <i class="fas fa-check btn-icon" aria-hidden="true"></i>
      <span class="btn-label">Done</span>
    {:else if loading}
      <span class="btn-label">{loadingLabel}</span>
      {#if isDeterminate}
        <span class="btn-percent">{Math.round(fillWidth)}%</span>
      {/if}
    {:else}
      {#if icon}
        <i class="fas {icon} btn-icon" aria-hidden="true"></i>
      {/if}
      <span class="btn-label">{label}</span>
    {/if}
  </span>
</button>

<style>
  .loading-button {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 24px;
    border: none;
    border-radius: 10px;
    background: var(--theme-accent, #6366f1);
    color: #fff;
    font-size: var(--font-size-sm, 14px);
    font-weight: 500;
    cursor: pointer;
    overflow: hidden;
    min-width: 120px;
    transition: transform var(--duration-fast, 150ms) ease;
  }

  .loading-button:hover:not(:disabled) {
    transform: scale(1.02);
  }

  .loading-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .loading-button:disabled {
    cursor: not-allowed;
    opacity: 0.85;
  }

  .loading-button:focus-visible {
    outline: 2px solid var(--theme-accent, #6366f1);
    outline-offset: 2px;
  }

  /* ---- Fill sweep (deterministic) ---- */

  .fill-sweep {
    position: absolute;
    inset: 0;
    right: auto;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.18) 0%,
      rgba(255, 255, 255, 0.28) 85%,
      rgba(255, 255, 255, 0.08) 100%
    );
    transition: width 120ms ease-out;
    pointer-events: none;
  }

  /* ---- Indeterminate shimmer ---- */

  .indeterminate-sweep {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.2) 40%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0.2) 60%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: shimmer-sweep 1.8s ease-in-out infinite;
    pointer-events: none;
  }

  @keyframes shimmer-sweep {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* ---- Done flash ---- */

  .done-flash {
    position: absolute;
    inset: 0;
    background: rgba(34, 197, 94, 0.25);
    animation: flash-fade 0.6s ease-out forwards;
    pointer-events: none;
  }

  @keyframes flash-fade {
    0% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  .is-done {
    background: var(--semantic-success, #22c55e);
  }

  /* ---- Content ---- */

  .btn-content {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .btn-icon {
    font-size: 0.9em;
  }

  .btn-label {
    white-space: nowrap;
  }

  .btn-percent {
    font-variant-numeric: tabular-nums;
    font-size: 0.85em;
    opacity: 0.9;
  }

  /* ---- Reduced motion ---- */

  @media (prefers-reduced-motion: reduce) {
    .loading-button {
      transition: none;
    }

    .indeterminate-sweep {
      animation: none;
      background: rgba(255, 255, 255, 0.15);
      background-size: 100% 100%;
    }

    .done-flash {
      animation: none;
    }

    .fill-sweep {
      transition: none;
    }
  }
</style>
