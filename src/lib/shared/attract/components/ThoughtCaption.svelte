<!--
  ThoughtCaption — the ghost's visible monologue.

  This is the feature, not decoration. Without it a stranger fifteen feet away
  sees a dot clicking around and reads it as random, no matter how good the
  reasoning underneath is. With it, the same tour reads as someone curious.

  Layout stability (no-layout-shift.md): the bubble is a FIXED box — a fixed
  width band and a two-line reserved height — so a short thought and a long one
  occupy exactly the same space and nothing on the page moves when the ghost
  changes its mind. The text inside crossfades in `fill` mode against that
  sized box, which is the documented correct mode for a framed container
  (crossfade-primitive.md §The First-Time Failure). The bubble chrome stays
  OUTSIDE the crossfade so only the words fade.

  Placement follows the pointer but is clamped to the viewport and flips to
  whichever side keeps it off the control the ghost is about to press.
-->
<script lang="ts">
  import Crossfade from "$lib/shared/components/Crossfade.svelte";
  import { DURATION } from "$lib/shared/transitions/transitions";

  let {
    thought,
    x,
    y,
  }: {
    /** The current thought. Null hides the bubble entirely. */
    thought: string | null;
    /** Viewport coordinates of the pointer. */
    x: number;
    y: number;
  } = $props();

  // The bubble's fixed footprint per screen tier. Everything downstream of
  // these two numbers is stable by construction — no measuring, no reflow, no
  // shift — and the tiers step it up for a 4K panel or a TV across the room
  // rather than leaving a laptop-sized bubble stranded (4k-native-layout.md).
  // Bound, not read: window.innerWidth is not a reactive dependency, so a
  // $derived over it computes once at mount and then lies — which is exactly
  // how a 4K session ends up rendering 24px type inside the laptop-tier box.
  let viewportW = $state(1920);
  let viewportH = $state(1080);
  const tier = $derived(viewportW >= 2600 ? 2 : viewportW >= 1680 ? 1 : 0);
  const WIDTH = $derived([300, 380, 620][tier]!);
  const HEIGHT = $derived([68, 84, 132][tier]!);
  const GAP = 34;
  const EDGE = 16;

  // Sit above the pointer by default; below it near the top of the screen, so
  // the caption never leaves the viewport and never covers the target.
  const below = $derived(y < HEIGHT + GAP + EDGE);
  const top = $derived(
    below
      ? Math.min(y + GAP, Math.max(EDGE, viewportH - HEIGHT - EDGE))
      : y - GAP - HEIGHT,
  );
  const left = $derived(
    Math.min(
      Math.max(x - WIDTH / 2, EDGE),
      Math.max(EDGE, viewportW - WIDTH - EDGE),
    ),
  );
</script>

<svelte:window bind:innerWidth={viewportW} bind:innerHeight={viewportH} />

{#if thought}
  <div
    class="caption"
    class:below
    style={`width:${WIDTH}px;height:${HEIGHT}px;transform:translate(${left}px, ${top}px)`}
    aria-live="polite"
  >
    <div class="body">
      <Crossfade key={thought} duration={DURATION.emphasis} fill>
        <p class="text">{thought}</p>
      </Crossfade>
    </div>
    <span class="tail" aria-hidden="true"></span>
  </div>
{/if}

<style>
  .caption {
    position: fixed;
    top: 0;
    left: 0;
    /* Sits with the pointer, above every app overlay — see PresenterHost. */
    z-index: 2147483001;
    pointer-events: none;
    border-radius: 16px;
    padding: 0.75rem 1rem;
    background: color-mix(in srgb, var(--theme-panel-bg, #101018) 88%, transparent);
    border: 1px solid var(--theme-stroke, rgba(255, 255, 255, 0.14));
    box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(18px) saturate(140%);
    -webkit-backdrop-filter: blur(18px) saturate(140%);
    will-change: transform;
  }

  /* The sized box the crossfade fills. Both layers are absolute inside it, so
     a longer thought replacing a shorter one cannot change the bubble. */
  .body {
    position: relative;
    width: 100%;
    height: 100%;
  }

  .text {
    margin: 0;
    /* Vertically centred inside the fixed box without flex, because the
       two-line clamp needs -webkit-box on this element. */
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    transform: translateY(-50%);
    font-size: 1.0625rem;
    line-height: 1.3;
    font-weight: 500;
    color: var(--theme-text, #f4f4f8);
    /* Two lines, then ellipsis — a thought that overflows would break the
       fixed height that makes this shift-proof. */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .tail {
    position: absolute;
    left: 50%;
    width: 12px;
    height: 12px;
    margin-left: -6px;
    background: inherit;
    border: inherit;
    transform: rotate(45deg);
  }

  .caption:not(.below) .tail {
    bottom: -7px;
    border-top: none;
    border-left: none;
  }

  .caption.below .tail {
    top: -7px;
    border-bottom: none;
    border-right: none;
  }

  /* A TV across the room is the other target: step the bubble up with the
     4K ramp instead of leaving it phone-sized (4k-native-layout.md). */
  @media (min-width: 1680px) {
    .caption {
      border-radius: 20px;
    }
    .text {
      font-size: 1.25rem;
    }
  }

  /* Nothing scales for you at 4K@100% or on a TV across the room — the type
     and the bubble both have to step (4k-native-layout.md). */
  @media (min-width: 2600px) {
    .caption {
      border-radius: 26px;
      padding: 1rem 1.35rem;
    }
    .text {
      font-size: 2rem;
    }
    .tail {
      width: 18px;
      height: 18px;
      margin-left: -9px;
    }
  }
</style>
