<!-- src/lib/features/store/components/front-door/HeroPhone.svelte -->
<!--
  The hero's phone — and the page's whole argument.

  Every previous version of this hero DESCRIBED what a scan does, or mimed it:
  a drawn mandala standing in for the sequence coming alive. It was pretty and
  it was fiction. Austen's call (2026-08-03): "on that phone it literally loads
  the exact component that they will literally see when they go to the literal
  QR code scan ... a miniature phone simulating what the phone will experience."

  So this screen is an iframe of the real `/q/<code>` for the card on the stack
  beside it — the same route the printed QR opens, the same component, the same
  loading beats. Nothing here is a mock of the viewer, and nothing here forks
  its chrome.

  THREE THINGS MAKE THAT SAFE:

  1. `?demo=1`. A page that shows the scan route must not be counted as
     scanning. The /q host reads the flag and skips PostHog init, the scan
     visit, and the physical-card ledger write, which silences every
     downstream captureScan* by construction. See QScanPage.svelte.
  2. The code is LOOKED UP, never minted. `findExistingCodeForSequence` is a
     pure Firestore read; a public marketing page must never write short codes
     (one-code-per-hash). No code, no phone — the composition just holds the
     cards.
  3. The iframe is inert to the pointer. It is a depiction of a phone screen,
     and a visitor who scrolled it, or pressed the viewer's own "Open TKA"
     inside a 375px box, would be looking at a broken-seeming app rather than
     the promise. The screen is a real link out instead: tap it and the actual
     /q opens in a new tab, no demo flag, the real thing.

  The iframe renders at a true 375 CSS viewport — a phone's width, so /q lays
  itself out exactly as it does on a phone — and is scaled into the frame with
  a transform. Nothing loads until the first scan press.
-->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { DURATION } from "$lib/shared/transitions/transitions";

  interface Props {
    /** The real short code for the card on the stack. Null = no phone content. */
    code: string | null;
    /** Boot the iframe. False until the first scan press (lazy). */
    armed: boolean;
    /** The viewfinder is mid-choreography: screen shows the camera view. */
    viewfinder: boolean;
    /** The code has been RECOGNISED — the beat the chip belongs to. */
    locked: boolean;
    /** The screen has swiped up into the loading/loaded scan page. */
    opened: boolean;
    /** Baked cover art for the camera view — the card the phone is aimed at. */
    coverUrl: string | null;
    /**
     * The printed QR's cell as % of the trimmed card, from the same print
     * layout math the bake used (card-front-regions). The camera view IS that
     * card, so the viewfinder brackets land on the actual code rather than on
     * the middle of the frame — and they move with the step count, because the
     * cell does.
     */
    qrCell: { x: number; y: number; w: number; h: number } | null;
    /** Reduced motion: skip the camera beat entirely. */
    reducedMotion: boolean;
  }
  let {
    code,
    armed,
    viewfinder,
    locked,
    opened,
    coverUrl,
    qrCell,
    reducedMotion,
  }: Props = $props();

  /** A phone's CSS viewport. /q renders its real mobile layout at this width. */
  const FRAME_W = 375;
  const FRAME_H = 812;

  let loaded = $state(false);
  let screenW = $state(0);

  // Re-boot the loading state whenever the target changes: a new card is a new
  // page load, and phones load. Pretending otherwise would be the one dishonest
  // frame in an otherwise honest picture.
  const src = $derived(code && armed ? `/q/${code}?demo=1` : null);
  $effect(() => {
    void src;
    loaded = false;
  });

  const scale = $derived(screenW ? screenW / FRAME_W : 0);
</script>

<div class="phone" class:leaning={viewfinder} class:opened>
  <span class="speaker" aria-hidden="true"></span>

  <div class="screen" bind:clientWidth={screenW}>
    <!-- CAMERA VIEW: what the phone sees before it resolves the code. The
         card's own printed front, drifting slightly, so the beat reads as a
         camera pointed at an object rather than a slide transition. -->
    {#if coverUrl && !opened}
      <div class="camera" class:live={viewfinder} out:fade={{ duration: DURATION.fast }}>
        <span class="shot">
          <img src={coverUrl} alt="" draggable="false" />
          <span
            class="reticle"
            aria-hidden="true"
            style:left="{qrCell ? qrCell.x - 6 : 27}%"
            style:top="{qrCell ? qrCell.y - 4 : 40}%"
            style:width="{qrCell ? qrCell.w + 12 : 46}%"
            style:height="{qrCell ? qrCell.h + 8 : 20}%"
          ></span>
        </span>
        {#if locked}
          <span class="chip" aria-hidden="true">
            <i class="fas fa-qrcode"></i>
            <span>tka.run/{code}</span>
          </span>
        {/if}
      </div>
    {/if}

    <!-- THE REAL PAGE. -->
    {#if src}
      <div class="page" class:up={opened}>
        {#if !loaded}
          <div class="loading" aria-hidden="true">
            <span class="spinner"></span>
            <span class="loading-text">Opening tka.run/{code}</span>
          </div>
        {/if}
        <div
          class="viewport"
          style:width="{FRAME_W}px"
          style:height="{FRAME_H}px"
          style:transform="scale({scale})"
        >
          <iframe
            title="The scan page this card opens"
            {src}
            width={FRAME_W}
            height={FRAME_H}
            loading="lazy"
            referrerpolicy="same-origin"
            onload={() => (loaded = true)}
          ></iframe>
        </div>
      </div>
    {/if}
  </div>

  <!-- The screen is inert, so the way out is explicit. Same code, no demo
       flag: the real page, counted like any other visit. -->
  {#if code && opened}
    <a
      class="open-real"
      href="/q/{code}"
      target="_blank"
      rel="noopener"
      transition:fade={{ duration: reducedMotion ? 0 : DURATION.fast }}
    >
      Open this scan
      <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
    </a>
  {/if}
</div>

<style>
  /* Sized by the host from one --phone-h, so the hero can make the phone its
     dominant object per viewport without this component knowing the layout. */
  .phone {
    position: relative;
    height: var(--phone-h, 30rem);
    aspect-ratio: 1 / 2.02;
    border-radius: clamp(1.1rem, 7%, 2.4rem);
    padding: 2.4%;
    background: linear-gradient(158deg, #2b3140, #12151d 55%, #232833);
    box-shadow:
      0 2rem 4rem rgba(0, 0, 0, 0.6),
      inset 0 0 0 1px rgba(255, 255, 255, 0.14);
    /* The lean: the phone tips toward the card it is reading, then settles
       upright once the page is up. Perspective on the parent would apply to
       the card stack too, so it lives here. */
    transform: perspective(1400px) rotateY(-13deg) rotateX(3deg) rotateZ(-2deg);
    transition: transform 620ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }
  .phone.leaning {
    transform: perspective(1400px) rotateY(-4deg) rotateX(1deg) scale(1.03);
  }
  .phone.opened {
    transform: perspective(1400px) rotateY(-6deg) rotateX(1deg);
  }

  .speaker {
    position: absolute;
    top: 1.1%;
    left: 50%;
    translate: -50% 0;
    width: 26%;
    height: 0.32rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.28);
  }

  .screen {
    position: relative;
    width: 100%;
    height: 100%;
    border-radius: clamp(0.7rem, 5%, 1.6rem);
    overflow: hidden;
    background: #0b0d12;
    /* Containing block for both layers. */
    isolation: isolate;
  }

  /* ── camera view ──────────────────────────────────────────────────────── */

  .camera {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: #05070b;
  }
  /* The card as the camera sees it. The reticle is positioned inside THIS box,
     so its percentages are percentages of the card — which is what the QR
     cell rect is expressed in. */
  .shot {
    position: relative;
    display: block;
    width: 116%;
    /* The drift: a hand holding a phone is never still. Slow enough that it
       reads as breathing rather than motion for its own sake. */
    transform: scale(1.02) translate(1%, -1%);
    transition: transform 900ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .camera.live .shot {
    transform: scale(1.1) translate(-1%, 1%);
  }
  .camera img {
    display: block;
    width: 100%;
    max-width: none;
    filter: brightness(0.9) contrast(1.05);
  }

  /* Viewfinder corners, the same bracket treatment the card carried — now
     framing the printed code inside the camera view. */
  .reticle {
    position: absolute;
    border: 0.14rem solid rgba(255, 255, 255, 0.7);
    border-radius: 0.5rem;
    -webkit-mask-image:
      linear-gradient(to right, #000 0 22%, transparent 22% 78%, #000 78% 100%),
      linear-gradient(to bottom, #000 0 22%, transparent 22% 78%, #000 78% 100%);
    -webkit-mask-composite: source-in;
    mask-image:
      linear-gradient(to right, #000 0 22%, transparent 22% 78%, #000 78% 100%),
      linear-gradient(to bottom, #000 0 22%, transparent 22% 78%, #000 78% 100%);
    mask-composite: intersect;
  }

  /* The iOS-style chip that pops over a recognised code. */
  .chip {
    position: absolute;
    bottom: 14%;
    display: inline-flex;
    align-items: center;
    gap: 0.4em;
    max-width: 84%;
    padding: 0.45em 0.8em;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.94);
    color: #10131a;
    font-size: clamp(0.55rem, 4cqw, 0.8rem);
    font-weight: 600;
    letter-spacing: 0.01em;
    white-space: nowrap;
    box-shadow: 0 0.5rem 1.4rem rgba(0, 0, 0, 0.45);
    animation: chip-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
  }
  @keyframes chip-pop {
    from {
      opacity: 0;
      transform: translateY(30%) scale(0.86);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  /* ── the real page ────────────────────────────────────────────────────── */

  /* Swipes up from below, the way tapping a code hands you the page. */
  .page {
    position: absolute;
    inset: 0;
    background: #0b0d12;
    transform: translateY(100%);
    transition: transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  .page.up {
    transform: none;
  }

  .viewport {
    transform-origin: top left;
    /* A depiction, not a control surface — see the header. */
    pointer-events: none;
  }
  .viewport iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }

  .loading {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.9em;
    background: #0b0d12;
    color: rgba(255, 255, 255, 0.72);
    font-size: clamp(0.55rem, 4cqw, 0.8rem);
  }
  .spinner {
    width: 1.8em;
    height: 1.8em;
    border-radius: 50%;
    border: 0.18em solid rgba(255, 255, 255, 0.18);
    border-top-color: #7ee0ff;
    animation: spin 900ms linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .loading-text {
    opacity: 0.8;
  }

  /* ── way out ──────────────────────────────────────────────────────────── */

  /* Seated fully BELOW the phone, never on its bezel. It used to hang at
     `bottom: -1.4rem`, which put its top 19px INSIDE the screen and covered the
     embedded viewer's bottom bar. `top: 100% + gap` starts it where the phone
     ends. The host reserves `--pill-gap + --pill-h` under the phone slot, so the
     pill arriving after a scan still moves nothing (no-layout-shift.md). */
  .open-real {
    position: absolute;
    left: 50%;
    top: calc(100% + var(--pill-gap, 0.7rem));
    translate: -50% 0;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-height: var(--pill-h, var(--min-touch-target, 44px));
    padding: 0 1.1rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    background: rgba(12, 16, 24, 0.92);
    color: #fff;
    font-size: var(--font-size-min, 14px);
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    box-shadow: 0 0.8rem 2rem rgba(0, 0, 0, 0.5);
  }
  .open-real:hover {
    border-color: rgba(255, 255, 255, 0.45);
  }
  .open-real:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .phone,
    .camera img,
    .page {
      transition: none;
    }
    .chip,
    .spinner {
      animation: none;
    }
  }
</style>
