<!--
  GenerateEmptyState.svelte

  Fills the collapsed-workspace region on the Generate (and empty-Construct)
  tab when there is no sequence yet.

  When the host sets `showStarterOffer` (empty Construct + the first-session
  starter is eligible, SP3b), this renders the one-tap "make your first
  sequence" offer built on PanelButton. Otherwise it falls back to the Generate
  tab's original two states:

  1. First visit (tour not offered, not completed) → a gentle, inline opt-in
     offer to walk through the generator options. NOT a modal — it lives in the
     empty workspace slot, so it never interrupts (honors the deliberate
     "new users get zero modal interruptions" stance in onboarding-flags.ts).
  2. Otherwise → the plain "Tap Generate to create your sequence" hint.

  Accepting starts the existing GeneratePanelTour (mounted in GeneratePanel).
  The tour itself, its state, and its animations are untouched — this only
  changes how a first-time user is offered it (was: a permanent ? button).

  Offer resolution (taken OR dismissed) is per-account: generateTourState
  syncs it to Firestore, so a user who dealt with the offer on one device is
  not re-offered on another. The offer stays hidden until that FROM-cloud pull
  resolves (cloudSynced) so it never flashes for a returning user.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { generateTourState } from "$lib/shared/onboarding/state/generate-tour-state.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import type { StartFirstSequenceResult } from "$lib/shared/onboarding/services/start-first-sequence";
  import {
    logOnboardingFirstSequenceStarterShown,
    logOnboardingFirstSequenceStarterGenerated,
    logOnboardingFirstSequenceStarterKept,
    logOnboardingFirstSequenceStarterDismissed,
  } from "$lib/shared/analytics/services/onboarding-events";

  interface Props {
    /** Render the first-session starter offer (empty Construct) instead of the
     *  generator tour offer / hint. The host only sets this once the starter is
     *  eligible, so the card never flashes before eligibility resolves. */
    showStarterOffer?: boolean;
    /** Runs the generate → load → keep command and returns the typed result. */
    onStarterGenerate?: () => Promise<StartFirstSequenceResult>;
    /** Dismiss the starter ("I'll build my own"). */
    onStarterDismiss?: () => void;
  }

  let {
    showStarterOffer = false,
    onStarterGenerate,
    onStarterDismiss,
  }: Props = $props();

  let hapticService = $state<ReturnType<typeof getHapticFeedback> | null>(null);
  let starterBusy = $state(false);
  let starterError = $state<string | null>(null);

  // Show the first-run offer only once the account sync has resolved, and only
  // if the offer hasn't already been taken or dismissed on any device.
  const showOffer = $derived(
    generateTourState.cloudSynced && !generateTourState.hasResolvedOffer
  );

  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      /* optional */
    }
    if (showStarterOffer) {
      logOnboardingFirstSequenceStarterShown();
    }
  });

  function acceptTour() {
    hapticService?.trigger("selection");
    generateTourState.markOffered();
    generateTourState.start();
  }

  function declineTour() {
    hapticService?.trigger("selection");
    generateTourState.markOffered();
  }

  async function handleStarterGenerate() {
    if (starterBusy) return;
    hapticService?.trigger("selection");
    starterError = null;
    starterBusy = true;
    logOnboardingFirstSequenceStarterGenerated();
    try {
      const result = await onStarterGenerate?.();
      if (result?.status === "generated-kept") {
        logOnboardingFirstSequenceStarterKept();
        // The workspace now has the sequence, so this card unmounts - nothing
        // more to render here.
        return;
      }
      if (result?.status === "generate-failed") {
        starterError = "Couldn't generate a sequence. Tap to try again.";
      }
      // persist-failed: the sequence is already loaded in the workspace and the
      // host surfaces the save error via a toast (this card has usually
      // unmounted by then, as the workspace filled).
    } finally {
      starterBusy = false;
    }
  }

  function handleStarterDismiss() {
    if (starterBusy) return;
    hapticService?.trigger("selection");
    logOnboardingFirstSequenceStarterDismissed();
    onStarterDismiss?.();
  }
</script>

<!--
  The offer↔hint swap is a true in-place crossfade with zero layout shift, via
  the shared Crossfade primitive (grid-stack + {#key}). The 120ms in-delay is a
  deliberate gentle stagger; reduced-motion is handled inside the primitive.
-->
<div class="empty-state">
  {#if showStarterOffer}
    <!-- First-session starter (SP3b): one tap generates a sequence, loads it
         into the workspace, and saves it. Built on PanelButton, not the
         hand-rolled .offer-btn used by the legacy tour offer below. -->
    <div class="tour-offer starter-offer">
      <p class="offer-title">Make your first sequence</p>
      <p class="offer-sub">
        One tap builds a sequence, drops it in the workspace, and saves it to
        your library.
      </p>
      <div class="offer-actions">
        <PanelButton
          variant="primary"
          onclick={handleStarterGenerate}
          disabled={starterBusy}
        >
          {starterBusy ? "Generating…" : "Generate one for me"}
        </PanelButton>
        <PanelButton
          variant="secondary"
          onclick={handleStarterDismiss}
          disabled={starterBusy}
        >
          I'll build my own
        </PanelButton>
      </div>
      {#if starterError}
        <p class="offer-error" role="alert">{starterError}</p>
      {/if}
    </div>
  {:else}
  <Crossfade key={showOffer} duration={DURATION.emphasis} delay={120}>
    {#if showOffer}
      <div class="tour-offer">
        <p class="offer-title">First time generating?</p>
        <p class="offer-sub">A quick tour shows what each option does.</p>
        <div class="offer-actions">
          <button type="button" class="offer-btn primary" onclick={acceptTour}>
            Show me
          </button>
          <button type="button" class="offer-btn secondary" onclick={declineTour}>
            I'll explore
          </button>
        </div>
      </div>
    {:else}
      <p class="workspace-hint">
        Tap Generate to create your sequence
      </p>
    {/if}
  </Crossfade>
  {/if}
</div>

<style>
  /* Centers the Crossfade (which owns the offer↔hint stack internally) and
     holds the upper-region spacing once. The in-place crossfade itself lives in
     the shared primitive now, not here. */
  .empty-state {
    flex-shrink: 0;
    display: grid;
    justify-items: center;
    margin-top: clamp(2.5rem, 11vmin, 6.5rem);
    padding: 0 1rem;
  }

  /* Hint — preserved verbatim from StandardWorkspaceLayout so the non-first-run
     empty state is visually unchanged. cqi tracks the .tool-panel-container
     (container-type: size), this component's parent, so it still scales to one
     line at any width. */
  .workspace-hint {
    margin: 0;
    text-align: center;
    font-family: "Playfair Display", Georgia, serif;
    font-size: clamp(1rem, 4.6cqi, 2rem);
    font-weight: 500;
    line-height: 1.2;
    white-space: nowrap;
    color: var(--theme-text, #fff);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  }

  /* Offer — occupies the same upper region as the hint so swapping between
     them moves nothing below (the cards keep their position). */
  .tour-offer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    max-width: 30rem;
    text-align: center;
  }

  .offer-title {
    margin: 0;
    font-family: "Playfair Display", Georgia, serif;
    font-size: clamp(1.05rem, 4.4cqi, 1.9rem);
    font-weight: 600;
    line-height: 1.2;
    color: var(--theme-text, #fff);
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.45);
  }

  .offer-sub {
    margin: 0;
    font-size: var(--font-size-sm, 14px);
    line-height: 1.35;
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
  }

  /* Starter offer keeps the tour-offer layout but gives the copy a touch more
     room, since its sub is a full sentence. */
  .starter-offer {
    max-width: 34rem;
  }

  .offer-error {
    margin: 4px 0 0;
    font-size: var(--font-size-sm, 14px);
    line-height: 1.35;
    color: var(--semantic-error, #f87171);
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
  }

  .offer-actions {
    display: flex;
    gap: 10px;
    margin-top: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .offer-btn {
    min-height: var(--min-touch-target, 44px);
    padding: 0 18px;
    border-radius: 12px;
    font-size: var(--font-size-base, 15px);
    font-weight: 600;
    cursor: pointer;
    transition:
      transform 0.12s ease,
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .offer-btn:active {
    transform: scale(0.96);
  }

  .offer-btn:focus-visible {
    outline: 2px solid var(--theme-accent, #f59e0b);
    outline-offset: 2px;
  }

  /* Primary — gold, matches the Generate tab's accent. */
  .offer-btn.primary {
    color: #1a1206;
    border: 1px solid color-mix(in srgb, var(--semantic-warning, #f59e0b) 60%, transparent);
    background: linear-gradient(
      135deg,
      var(--semantic-warning, #f59e0b) 0%,
      color-mix(in srgb, var(--semantic-warning, #f59e0b) 85%, #d97706) 100%
    );
    box-shadow: 0 4px 14px color-mix(in srgb, var(--semantic-warning, #f59e0b) 35%, transparent);
  }

  .offer-btn.primary:hover {
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--semantic-warning, #f59e0b) 92%, #fff) 0%,
      var(--semantic-warning, #f59e0b) 100%
    );
  }

  /* Secondary — quiet, for the self-directed user who wants to poke around. */
  .offer-btn.secondary {
    color: var(--theme-text, #fff);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.18));
    background: var(--theme-card-bg, rgba(255, 255, 255, 0.06));
  }

  .offer-btn.secondary:hover {
    background: var(--theme-card-hover-bg, rgba(255, 255, 255, 0.1));
    border-color: var(--theme-stroke-strong, rgba(255, 255, 255, 0.28));
  }

  @media (prefers-reduced-motion: reduce) {
    .offer-btn {
      transition: none;
    }
    .offer-btn:active {
      transform: none;
    }
  }
</style>
