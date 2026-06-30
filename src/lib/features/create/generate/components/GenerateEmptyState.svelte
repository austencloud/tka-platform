<!--
  GenerateEmptyState.svelte

  Fills the collapsed-workspace region on the Generate tab when there is no
  sequence yet. Two states:

  1. First visit (tour not offered, not completed) → a gentle, inline opt-in
     offer to walk through the generator options. NOT a modal — it lives in the
     empty workspace slot, so it never interrupts (honors the deliberate
     "new users get zero modal interruptions" stance in onboarding-flags.ts).
  2. Otherwise → the plain "Tap Generate to create your sequence" hint.

  Accepting starts the existing GeneratePanelTour (mounted in GeneratePanel).
  The tour itself, its state, and its animations are untouched — this only
  changes how a first-time user is offered it (was: a permanent ? button).
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { getHapticFeedback } from "$lib/shared/application/get-haptic-feedback";
  import { generateTourState } from "$lib/shared/onboarding/state/generate-tour-state.svelte";

  // First-run gate. localStorage-only, matching generate-tour-state's own
  // persistence (the tour does not sync to cloud, so neither does its offer).
  const OFFERED_KEY = "tka-generate-tour-offered";

  let showOffer = $state(false);
  let hapticService = $state<ReturnType<typeof getHapticFeedback> | null>(null);

  // Honor prefers-reduced-motion — gates the JS-driven crossfade durations below
  // (a CSS @media block alone can't stop Svelte's transition timings).
  let reduceMotion = $state(
    typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  onMount(() => {
    try {
      hapticService = getHapticFeedback();
    } catch {
      /* optional */
    }

    let stopMotionWatch: (() => void) | undefined;
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const onChange = (e: MediaQueryListEvent) => (reduceMotion = e.matches);
      mq.addEventListener("change", onChange);
      stopMotionWatch = () => mq.removeEventListener("change", onChange);
    }

    if (typeof localStorage !== "undefined") {
      const alreadyOffered = localStorage.getItem(OFFERED_KEY) === "true";
      // Don't offer if they've already seen the tour by any path, or already declined.
      showOffer = !alreadyOffered && !generateTourState.hasCompleted;
    }

    return () => stopMotionWatch?.();
  });

  function markOffered() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(OFFERED_KEY, "true");
    }
    showOffer = false;
  }

  function acceptTour() {
    hapticService?.trigger("selection");
    markOffered();
    generateTourState.start();
  }

  function declineTour() {
    hapticService?.trigger("selection");
    markOffered();
  }
</script>

<!--
  Single grid cell holding both states stacked (grid-area: 1 / 1), so the
  offer→hint swap is a true in-place crossfade with zero layout shift. A bare
  {#if}/{:else} with one transition lets the incoming block pop in beside the
  outgoing one for a frame — Svelte transitions don't coordinate two siblings
  on their own. Stacking + paired in/out fade is the codebase's working idiom
  (see FuseTab.svelte) and honors no-layout-shift.md (grid-stack technique).
-->
<div class="empty-state">
  {#if showOffer}
    <div
      class="tour-offer"
      in:fade={{ duration: reduceMotion ? 0 : 260, delay: reduceMotion ? 0 : 120 }}
      out:fade={{ duration: reduceMotion ? 0 : 180 }}
    >
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
    <p
      class="workspace-hint"
      in:fade={{ duration: reduceMotion ? 0 : 260, delay: reduceMotion ? 0 : 120 }}
      out:fade={{ duration: reduceMotion ? 0 : 180 }}
    >
      Tap Generate to create your sequence
    </p>
  {/if}
</div>

<style>
  /* Grid stack: both states share one cell (children at grid-area: 1 / 1) so
     the offer↔hint swap crossfades in place. The cell anchors both at the same
     top edge, so the text dissolves without sliding; the upper-region spacing
     lives here once, not on each child. */
  .empty-state {
    flex-shrink: 0;
    display: grid;
    justify-items: center;
    margin-top: clamp(2.5rem, 11vmin, 6.5rem);
    padding: 0 1rem;
  }

  .empty-state > * {
    grid-area: 1 / 1;
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
