<script lang="ts">
  /**
   * The 2011 animation, driven by the model's step rather than by the browser.
   *
   * Attribution note: the guide is Drex's write-up of Charlie's system and does
   * not credit whoever drew the diagrams. Do not attribute them to Charlie —
   * earlier code and docs here did, and it is not supported by the source.
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
  }

  let { stem, step, alt }: Props = $props();

  const FRAMES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

  /*
   * As published, on the paper they were printed on. These were briefly
   * recoloured to sit on the dark page; that is gone. They are archival
   * material and now live in an archive view, where the white card is the
   * honest presentation rather than an eyesore in the middle of the app.
   */
  const srcFor = (i: number) => `/qft-frames/${stem}/${i}.webp`;

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

<div class="frames">
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
   * Grid-stacked so all nine occupy one cell. Every frame of an animation is the
   * same size, so the cell never changes as the step advances and nothing below
   * it moves during playback.
   *
   * The card takes its height from the drawing rather than the other way round.
   * The frames are whole and uncropped now and their proportions differ wildly —
   * 500x200 through 350x500 — so forcing them all into one fixed box left most
   * of them as a small drawing marooned in a wide white field.
   */
  .frames {
    display: grid;
    width: 100%;
    border-radius: 0.5rem;
    background: #fff;
    padding: 0.75rem;
  }

  img {
    grid-area: 1 / 1;
    /*
     * Fill the width the plate is given and take whatever height that implies.
     * These are small source files — 500px at the widest — so capping them at
     * natural size leaves the drawing as a speck on a big screen.
     */
    width: 100%;
    height: auto;
    opacity: 0;
  }

  img.shown {
    opacity: 1;
  }
</style>
