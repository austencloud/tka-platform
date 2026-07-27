<script lang="ts">
  /**
   * Charlie's animation, driven by the model's step rather than by the browser.
   *
   * A GIF in an <img> plays on its own clock — no seek, no pause, no frame
   * access — so it drifts out of phase with the computed stage beside it within
   * seconds. Every archive animation holds exactly nine frames: the eight
   * increments plus the closing frame back to the start. Rendering frame `i`
   * whenever the model sits at step `i` makes drift impossible instead of
   * merely small.
   *
   * All nine are stacked and toggled by opacity rather than swapping one src,
   * so no frame has to decode mid-playback and the box never resizes.
   */
  interface Props {
    /** Directory name under the extracted frames, e.g. "cateyeanimated". */
    stem: string;
    /** Current step, 0-7. Frame index is step index. */
    step: number;
    alt: string;
    /**
     * Show the frames on their original white card instead of the set composed
     * into the page. Both are the same drawing — see scripts/compose-qft-frames.mjs
     * for exactly what the composed set changes and what it leaves alone.
     */
    asPublished?: boolean;
  }

  let { stem, step, alt, asPublished = false }: Props = $props();

  const FRAMES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  const variant = $derived(asPublished ? "" : "-ink");

  const srcFor = (i: number) => `/qft-frames/${stem}/${i}${variant}.webp`;

  let imgs = $state<Array<HTMLImageElement | null>>([]);

  /**
   * Put the right frames back after hydration.
   *
   * The session is restored from localStorage, which the server does not have,
   * so SSR always renders the FIRST move while the client may be resuming any
   * of the eight. Svelte resolves that disagreement by keeping the server's
   * `src` and warning — which leaves the page showing one move's drawing under
   * another move's title until something else happens to touch the attribute.
   * Assigning it once on mount settles it, and costs nothing on the common path
   * where the two already agree.
   */
  $effect(() => {
    imgs.forEach((el, i) => {
      const want = srcFor(i);
      if (el && new URL(el.src, location.href).pathname !== want) el.src = want;
    });
  });
</script>

<div class="frames" class:card={asPublished}>
  {#each FRAMES as i (i)}
    <img
      bind:this={imgs[i]}
      src={srcFor(i)}
      alt={i === 0 ? alt : ""}
      aria-hidden={i === 0 ? undefined : "true"}
      class:shown={i === step}
      loading="eager"
    />
  {/each}
</div>

<style>
  /*
   * Grid-stacked so all nine occupy one cell. The box is sized by the frames
   * themselves and never changes as the step advances, so nothing below it
   * moves during playback.
   */
  .frames {
    display: grid;
    place-items: center;
    width: 100%;
    height: 100%;
  }

  /*
   * Only the published view wears the paper. Composed frames carry their own
   * alpha, so a card behind them would put back the exact white rectangle the
   * compositing exists to remove.
   */
  .frames.card {
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.75rem;
  }

  img {
    grid-area: 1 / 1;
    /*
     * Fill the card rather than merely fit inside it. These are small source
     * images — 421x265 at the largest — and capping them at their natural size
     * leaves the drawing as a speck in a white field on a big screen.
     */
    width: 100%;
    height: 100%;
    /*
     * The crops are truthful to the drawings rather than squared, so widths and
     * heights vary per animation. object-fit lets the page give every one the
     * same square box without distorting any of them.
     */
    object-fit: contain;
    opacity: 0;
  }

  img.shown {
    opacity: 1;
  }
</style>
