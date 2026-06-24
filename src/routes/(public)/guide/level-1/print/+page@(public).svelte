<!--
  Printable Level 1 guide — the single hand-out document.

  Resets out of the level-1 sidebar layout (`@(public)`) and stacks the cover
  plus all three chapter pages (each manages its own setGuideData context). The
  `guide-print-mode` class forces motion demos to render as static pictographs
  (arrow = direction, hand = end position) instead of video, matching the
  original printed guide. guide-print.css re-themes everything to ink-on-white.

  Print / Save-as-PDF from the browser produces the hand-out. This route is also
  the source for the regenerated static/guides/level-1.pdf.
-->
<script lang="ts">
  import "../_styles/guide.css";
  import "../_styles/guide-print.css";
  import { setGuidePrintMode } from "../_data/guide-data-context";
  import { page } from "$app/state";
  import GuidePage from "../_components/GuidePage.svelte";
  import GuideDocument from "../_components/GuideDocument.svelte";
  import PageNumberToggle from "../_components/PageNumberToggle.svelte";
  import type { GuidePageMeta } from "../_data/guide-manifest";
  import { BUILT } from "../_data/built-pages";

  setGuidePrintMode();

  // ?theme=home → ink-cheap light cover for home printers; default = navy (foil).
  const coverTheme = $derived(page.url.searchParams.get("theme") === "home" ? "light" : "navy");
</script>

<svelte:head>
  <title>The Kinetic Alphabet — Level 1 (Printable)</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<!-- Each page = one stacked GuidePage sheet. Page content + order come from the
     shared GuideDocument so /print and /book never drift. -->
{#snippet printPage({ title, pageNumber, fullBleed, label, content }: GuidePageMeta)}
  <GuidePage {title} {pageNumber} {fullBleed} {label}>{@render content()}</GuidePage>
{/snippet}

<div class="guide-content guide-print-mode print-doc">
  <GuideDocument {coverTheme} built={BUILT} page={printPage} />
</div>

<PageNumberToggle />
