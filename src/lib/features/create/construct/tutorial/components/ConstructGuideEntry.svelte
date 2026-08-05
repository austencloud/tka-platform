<script lang="ts">
  import { onMount } from "svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { appEntryState } from "$lib/shared/onboarding/state/app-entry-state.svelte";

  let {
    offerVisible,
    onShowGuide,
    onDismiss,
  }: {
    /** Explicit values support admin previews and isolated visual proofs. */
    offerVisible?: boolean;
    onShowGuide?: () => void;
    onDismiss?: () => void;
  } = $props();

  let haptics = $state<ReturnType<typeof getHapticFeedback> | null>(null);
  const showOffer = $derived(offerVisible ?? appEntryState.isTutorialPrompt());

  onMount(() => {
    try {
      haptics = getHapticFeedback();
    } catch {
      // Haptics are optional on devices that do not expose them.
    }
  });

  function showGuide() {
    haptics?.trigger("selection");
    if (onShowGuide) {
      onShowGuide();
    } else {
      appEntryState.acceptTutorial();
    }
  }

  function dismissOffer() {
    haptics?.trigger("selection");
    if (onDismiss) {
      onDismiss();
    } else {
      appEntryState.declineTutorial();
    }
  }
</script>

<div class="guide-entry">
  <Crossfade key={showOffer} duration={DURATION.emphasis}>
    {#if showOffer}
      <div class="guide-offer">
        <div class="offer-copy">
          <p class="offer-title">New to Construct?</p>
          <p class="offer-description">Build one move with a short guide.</p>
        </div>
        <div class="offer-actions">
          <PanelButton variant="primary" onclick={showGuide}>
            Show guide
          </PanelButton>
          <PanelButton variant="secondary" onclick={dismissOffer}>
            Not now
          </PanelButton>
        </div>
      </div>
    {:else}
      <p class="workspace-hint">Choose your start position</p>
    {/if}
  </Crossfade>
</div>

<style>
  .guide-entry {
    width: 100%;
  }

  .guide-offer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(12px, 2cqi, 24px);
    width: min(100%, 46rem);
    margin: 0 auto;
    padding: 8px 12px;
    box-sizing: border-box;
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.1));
    border-radius: 14px;
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.04));
  }

  .offer-copy {
    min-width: 0;
    text-align: left;
  }

  .offer-title,
  .offer-description,
  .workspace-hint {
    margin: 0;
  }

  .offer-title {
    color: var(--theme-text, #fff);
    font-size: var(--font-size-min, 14px);
    font-weight: 700;
    line-height: 1.25;
  }

  .offer-description {
    margin-top: 2px;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    font-size: var(--font-size-compact, 12px);
    line-height: 1.3;
  }

  .offer-actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  }

  .workspace-hint {
    text-align: center;
    font-family: "Playfair Display", Georgia, serif;
    font-size: clamp(1rem, 4.6cqi, 2rem);
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: 0.02em;
    white-space: nowrap;
    color: var(--theme-text, #fff);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  }

  @container (max-width: 520px) {
    .guide-offer {
      flex-wrap: wrap;
      gap: 6px;
    }

    .offer-copy {
      flex: 1 0 100%;
      text-align: center;
    }
  }

  @media (min-width: 1680px) {
    .workspace-hint {
      font-size: clamp(2rem, 2.2vw, 3rem);
    }

    .guide-offer {
      max-width: 58rem;
      padding: 12px 16px;
    }

    .offer-title {
      font-size: 1.05rem;
    }

    .offer-description {
      font-size: var(--font-size-min, 14px);
    }
  }

  @media (min-width: 2600px) {
    .workspace-hint {
      font-size: clamp(3rem, 2vw, 4.25rem);
    }

    .guide-offer {
      max-width: 72rem;
    }

    .offer-title {
      font-size: 1.4rem;
    }

    .offer-description {
      font-size: 1rem;
    }
  }
</style>
