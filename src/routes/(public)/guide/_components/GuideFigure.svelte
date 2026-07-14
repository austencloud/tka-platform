<script lang="ts">
  /**
   * GuideFigure — a pictograph embed for prose-first, prerendered guide articles.
   *
   * Wraps the zero-context `GuidePictograph` (reserved `aspect-ratio: 1` box +
   * a synchronous, crawlable `aria-label` from `describePictograph`, SVG hydrates
   * client-side) and pairs it with a server-rendered `<figcaption>` — so the
   * figure's meaning (Austen's caption + the machine notation) lands in the
   * prerendered HTML for crawlers, while the visual draws on hydrate into a box
   * that never reflows (see `no-layout-shift.md`).
   *
   * Rendered as a white "plate" (printMode = ink-on-white) so the pictograph
   * reads at high contrast on the cosmic editorial background — the guide's own
   * pictograph look. `eager` skips the IntersectionObserver: article figures are
   * few and above the fold, so draw them up front.
   */
  import GuidePictograph from "../level-1/_components/GuidePictograph.svelte";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  let {
    data,
    caption,
    label,
    propType = PropType.HAND,
    size = "md",
  }: {
    data: PictographData | null;
    /** Austen's caption — server-rendered, so it is crawlable + accessible. */
    caption: string;
    /** Short glyph name shown under the pictograph (e.g. "Alpha (α)"). */
    label?: string;
    propType?: PropType;
    size?: "sm" | "md" | "lg";
  } = $props();
</script>

<figure class="guide-figure">
  <div class="figure-plate">
    <GuidePictograph {data} {propType} {size} {label} eager printMode />
  </div>
  <figcaption>{caption}</figcaption>
</figure>

<style>
  .guide-figure {
    margin: 1.6rem auto 0;
    max-width: 20rem;
    text-align: center;
  }

  /* White plate: ink-on-white pictograph reads at high contrast on the cosmic bg. */
  .figure-plate {
    display: flex;
    justify-content: center;
    padding: 1rem;
    background: #f7f7fb;
    border: 1px solid oklch(0.55 0.04 270 / 0.2);
    border-radius: 16px;
    box-shadow: 0 8px 24px oklch(0.05 0.02 270 / 0.3);
  }

  figcaption {
    margin-top: 0.85rem;
    font-size: 0.9rem;
    line-height: 1.5;
    color: oklch(0.7 0.012 270);
  }
</style>
