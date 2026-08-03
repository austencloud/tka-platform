<!-- src/lib/features/store/components/front-door/HeroScanCue.svelte -->
<!--
  The hero's scan cue: the two seconds that connect the printed front to the
  moving back. Nothing here is stock imagery — the phone is a rounded rect with
  a screen inset and a speaker slot, drawn in CSS, so it scales with the card
  and carries no licensing or download weight.

  Two variants, one timeline (hero-scan-timeline.svelte.ts):

  - `phone` (default): a phone outline rises over the front card, holds it in
    frame, and a scan line crosses it once. Then it drops away and the back card
    takes over. It reads as the actual gesture the card asks for.
  - `pulse`: no phone. The front card's code pulses, and a ring travels from it
    across to the back card. Quieter, and it never occludes the printed front —
    the reason it exists as an alternative.

  The cue never blocks reading the card: it is pointer-transparent, it sits at
  partial opacity over the front only, and the idle beat between passes is
  longer than the pass itself.

  Compare them on the shop page with `?cue=pulse`.
-->
<script lang="ts">
  import type { ScanCueVariant, ScanPhase } from "./hero-scan-timeline.svelte";

  interface Props {
    cue: ScanCueVariant;
    phase: ScanPhase;
    /** Restarts the sweep animation per pass. */
    cycle: number;
  }
  let { cue, phase, cycle }: Props = $props();

  const showing = $derived(phase === "rise" || phase === "sweep");
</script>

<div class="cue" class:showing aria-hidden="true">
  {#if cue === "phone"}
    <div class="phone" class:up={showing}>
      <span class="speaker"></span>
      <span class="screen">
        {#if phase === "sweep"}
          {#key cycle}
            <span class="scan-line"></span>
          {/key}
        {/if}
      </span>
      <span class="reticle"></span>
    </div>
  {:else}
    <div class="pulse-cue">
      <span class="qr-pulse" class:beating={showing}></span>
      {#if phase === "sweep"}
        {#key cycle}
          <span class="ring"></span>
        {/key}
      {/if}
    </div>
  {/if}
</div>

<style>
  .cue {
    position: absolute;
    inset: 0;
    pointer-events: none;
    display: grid;
    place-items: center;
    z-index: 3;
  }

  /* ── phone ───────────────────────────────────────────────────────────── */

  .phone {
    position: relative;
    /* Sized against the card it frames, not the viewport, so the gesture reads
       the same at 375 and at 3840. */
    width: 62%;
    aspect-ratio: 1 / 1.9;
    max-height: 92%;
    border-radius: clamp(0.75rem, 8%, 1.6rem);
    border: 0.14rem solid rgba(255, 255, 255, 0.62);
    /* Barely there on purpose: the printed card has to stay readable through
       the frame, so the body is a hint of glass, not a scrim. */
    background: linear-gradient(
      160deg,
      rgba(10, 15, 22, 0.18),
      rgba(10, 15, 22, 0.04)
    );
    box-shadow:
      0 1rem 3rem rgba(0, 0, 0, 0.35),
      inset 0 0 1.5rem rgba(126, 224, 255, 0.14);
    display: grid;
    place-items: center;
    opacity: 0;
    transform: translateY(12%) scale(0.94);
    transition:
      opacity 620ms ease,
      transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .phone.up {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  .speaker {
    position: absolute;
    top: 3%;
    width: 22%;
    height: 0.22rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.42);
  }

  .screen {
    position: absolute;
    inset: 7% 5% 5%;
    border-radius: clamp(0.4rem, 5%, 1rem);
    overflow: hidden;
  }

  /* The corner brackets of a camera viewfinder, drawn as two gradients so the
     phone stays one element with no extra nodes. */
  .reticle {
    position: absolute;
    width: 46%;
    aspect-ratio: 1;
    border: 0.16rem solid rgba(126, 224, 255, 0.85);
    border-radius: 0.35rem;
    -webkit-mask-image:
      linear-gradient(to right, #000 0 26%, transparent 26% 74%, #000 74% 100%),
      linear-gradient(to bottom, #000 0 26%, transparent 26% 74%, #000 74% 100%);
    -webkit-mask-composite: source-in;
    mask-image:
      linear-gradient(to right, #000 0 26%, transparent 26% 74%, #000 74% 100%),
      linear-gradient(to bottom, #000 0 26%, transparent 26% 74%, #000 74% 100%);
    mask-composite: intersect;
  }

  .scan-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 24%;
    background: linear-gradient(
      to bottom,
      rgba(56, 189, 248, 0) 0%,
      rgba(56, 189, 248, 0.3) 44%,
      rgba(34, 170, 240, 0.92) 50%,
      rgba(56, 189, 248, 0.3) 56%,
      rgba(56, 189, 248, 0) 100%
    );
    animation: sweep 1300ms cubic-bezier(0.5, 0, 0.5, 1) forwards;
  }

  @keyframes sweep {
    0% {
      transform: translateY(-30%);
      opacity: 0;
    }
    18% {
      opacity: 1;
    }
    82% {
      opacity: 1;
    }
    100% {
      transform: translateY(370%);
      opacity: 0;
    }
  }

  /* ── pulse ───────────────────────────────────────────────────────────── */

  .pulse-cue {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .qr-pulse {
    position: absolute;
    /* Over the lower band of the front card, where the printed code sits in
       whichever grid cell the layout leaves empty. */
    bottom: 16%;
    width: 26%;
    aspect-ratio: 1;
    border-radius: 0.4rem;
    border: 0.14rem solid rgba(126, 224, 255, 0.75);
    opacity: 0;
    transition: opacity 400ms ease;
  }
  .qr-pulse.beating {
    opacity: 1;
    animation: qr-beat 1300ms ease-in-out infinite;
  }

  @keyframes qr-beat {
    0%,
    100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(126, 224, 255, 0.35);
    }
    50% {
      transform: scale(1.06);
      box-shadow: 0 0 1.4rem 0.2rem rgba(126, 224, 255, 0.32);
    }
  }

  .ring {
    position: absolute;
    bottom: 16%;
    width: 26%;
    aspect-ratio: 1;
    border-radius: 999px;
    border: 0.16rem solid rgba(126, 224, 255, 0.6);
    animation: ring-travel 1300ms cubic-bezier(0.3, 0, 0.2, 1) forwards;
  }

  /* Travels off the front card toward the back one, which sits to its right. */
  @keyframes ring-travel {
    0% {
      transform: translateX(0) scale(0.6);
      opacity: 0;
    }
    20% {
      opacity: 1;
    }
    100% {
      transform: translateX(210%) scale(2.6);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .phone,
    .qr-pulse {
      transition: none;
    }
    .scan-line,
    .qr-pulse.beating,
    .ring {
      animation: none;
    }
  }
</style>
