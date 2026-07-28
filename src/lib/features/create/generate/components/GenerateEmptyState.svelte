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
  } from "$lib/shared/analytics/services/onboarding-events";

  interface Props {
    /** Render the first-session starter offer (empty Construct) instead of the
     *  generator tour offer / hint. The host only sets this once the starter is
     *  eligible, so the card never flashes before eligibility resolves. */
    showStarterOffer?: boolean;
    /** Runs the generate → load → keep command and returns the typed result. */
    onStarterGenerate?: () => Promise<StartFirstSequenceResult>;
  }

  let { showStarterOffer = false, onStarterGenerate }: Props = $props();

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

</script>

<!--
  The offer↔hint swap is a true in-place crossfade with zero layout shift, via
  the shared Crossfade primitive (grid-stack + {#key}). The 120ms in-delay is a
  deliberate gentle stagger; reduced-motion is handled inside the primitive.
-->
<div class="empty-state" class:inline-starter={showStarterOffer}>
  {#if showStarterOffer}
    <!-- First-session starter (SP3b): one tap generates a sequence, loads it
         into the workspace, and saves it. Both starter and tour actions reuse
         PanelButton. -->
    <!-- One quiet action, deliberately not a titled card. The start-position
         picker above it already asks the question and already IS "build from
         scratch", so a second heading and a dismiss button would be the same
         decision printed twice. -->
    <div class="starter-inline">
      <span class="starter-lead">or</span>
      <PanelButton
        variant="secondary"
        onclick={handleStarterGenerate}
        disabled={starterBusy}
      >
        <span class="starter-action-label">
          <span class="starter-action-sizer" aria-hidden="true">
            Generate one for me
          </span>
          <span class="starter-action-live">
            {starterBusy ? "Generating…" : "Generate one for me"}
          </span>
        </span>
      </PanelButton>
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
          <PanelButton variant="primary" onclick={acceptTour}>
            Show tour
          </PanelButton>
          <PanelButton variant="secondary" onclick={declineTour}>
            Explore options
          </PanelButton>
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

  /* The inline starter sits BELOW the start-position picker, so it drops the
     hint's top margin entirely and reads as a footnote to the picker rather
     than a second offer competing with it. */
  .empty-state.inline-starter {
    margin-top: 0;
    padding-bottom: clamp(0.5rem, 2vmin, 1rem);
  }

  .starter-inline {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
  }

  .starter-lead {
    font-size: var(--font-size-sm, 14px);
    color: var(--theme-text-dim, rgba(255, 255, 255, 0.7));
    text-shadow: 0 1px 8px rgba(0, 0, 0, 0.4);
  }

  /* Grows with the picker above it at the shared 1680 seam. */
  @media (min-width: 1680px) {
    .starter-lead {
      font-size: 1.05rem;
    }
  }

  @media (min-width: 2600px) {
    .starter-lead {
      font-size: 1.4rem;
    }
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

  /* The live label and its longest variant share one grid cell. The primary
     button stays the same width while "Generate a sequence" becomes
     "Generating…", so the secondary action never moves. */
  .starter-action-label {
    display: inline-grid;
  }

  .starter-action-sizer,
  .starter-action-live {
    grid-area: 1 / 1;
  }

  .starter-action-sizer {
    visibility: hidden;
  }
</style>
