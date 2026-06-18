<!--
  BetaDiscoveryStep - Beta acknowledgment gate (step 0)

  Shown before WelcomeStep. User must acknowledge beta status
  before proceeding. Removable at v1.0 by deleting this file
  and its references in first-run-types.ts and FirstRunWizard.svelte.
-->
<script lang="ts">
  import { t } from "$lib/shared/i18n/i18n.svelte";

  interface Props {
    onNext: () => void;
  }

  const { onNext }: Props = $props();

  let acknowledged = $state(false);
</script>

<div class="beta-discovery-step">
  <div class="icon-container">
    <i class="fas fa-gem" aria-hidden="true"></i>
  </div>

  <h1 class="title">{t("beta_discovery_title")}</h1>

  <p class="body">{t("beta_discovery_body")}</p>

  <button
    type="button"
    class="acknowledge-pill"
    class:checked={acknowledged}
    aria-pressed={acknowledged}
    onclick={() => (acknowledged = !acknowledged)}
  >
    <span class="pill-indicator">
      {#if acknowledged}
        <i class="fas fa-check" aria-hidden="true"></i>
      {/if}
    </span>
    <span class="pill-label">{t("beta_discovery_acknowledge")}</span>
  </button>

  <button class="next-button" onclick={onNext} disabled={!acknowledged}>
    {t("beta_discovery_continue")} <i class="fas fa-arrow-right" aria-hidden="true"></i>
  </button>
</div>

<style>
  .beta-discovery-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    max-width: 520px;
    width: 100%;
    text-align: center;
    padding: 32px;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .icon-container {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 15%,
      transparent
    );
    border-radius: 24px;
    font-size: var(--font-size-3xl, 2.5rem);
    color: var(--theme-accent-strong, #8b5cf6);
  }

  .title {
    font-size: 1.75rem;
    font-weight: 800;
    color: white;
    margin: 0;
    letter-spacing: -0.02em;
  }

  .body {
    font-size: 1rem;
    line-height: 1.6;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    margin: 0;
  }

  /* Acknowledgment pill toggle (button + toggle-indicator, no checkbox) */
  .acknowledge-pill {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    min-height: var(--min-touch-target, 44px);
    background: rgba(255, 255, 255, 0.04);
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    cursor: pointer;
    transition: all var(--duration-normal, 0.2s) ease;
    user-select: none;
    -webkit-user-select: none;
    margin-top: 4px;
    font: inherit;
    color: inherit;
    text-align: left;
  }

  .acknowledge-pill:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .acknowledge-pill:focus-visible {
    outline: 2px solid var(--theme-accent-strong, #8b5cf6);
    outline-offset: 2px;
  }

  .acknowledge-pill.checked {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 12%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 40%,
      transparent
    );
  }

  .pill-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    min-width: 24px;
    border-radius: 6px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    background: transparent;
    color: white;
    font-size: 0.75rem;
    transition: all var(--duration-normal, 0.2s) ease;
  }

  .acknowledge-pill.checked .pill-indicator {
    background: var(--theme-accent-strong, #8b5cf6);
    border-color: var(--theme-accent-strong, #8b5cf6);
  }

  .pill-label {
    font-size: 0.95rem;
    font-weight: 500;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.6));
    transition: color var(--duration-normal, 0.2s) ease;
  }

  .acknowledge-pill.checked .pill-label {
    color: var(--theme-text, rgba(255, 255, 255, 0.9));
  }

  /* Continue button */
  .next-button {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 28px;
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 40%,
      transparent
    );
    border: 2px solid
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 60%, transparent);
    border-radius: 12px;
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal, 0.2s) ease;
  }

  .next-button:hover:not(:disabled) {
    background: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 50%,
      transparent
    );
    border-color: color-mix(
      in srgb,
      var(--theme-accent-strong, #8b5cf6) 80%,
      transparent
    );
    box-shadow: 0 8px 24px
      color-mix(in srgb, var(--theme-accent-strong, #8b5cf6) 30%, transparent);
  }

  .next-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .next-button:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  /* Mobile */
  @media (max-width: 480px) {
    .beta-discovery-step {
      padding: 16px;
    }

    .icon-container {
      width: 80px;
      height: 80px;
      font-size: var(--font-size-3xl, 2rem);
    }

    .title {
      font-size: 1.5rem;
    }

    .body {
      font-size: 0.9rem;
    }

    .next-button {
      padding: 12px 24px;
      font-size: 1rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .acknowledge-pill,
    .pill-indicator,
    .pill-label,
    .next-button {
      transition: none;
    }

    .next-button:active:not(:disabled) {
      transform: none;
    }
  }
</style>
