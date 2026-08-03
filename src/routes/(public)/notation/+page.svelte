<!--
  /notation — a playable archive of systems for writing flow arts down.

  Rebuilt 2026-07-27, replacing the hub that was gated on 2026-07-26 for
  explaining systems it did not own and getting them wrong. The archive keeps
  the record, credits, and primary links attached to each artifact. Entry data
  and its sourcing rules live in
  $lib/shared/notation/notation-catalog.ts.

  Spec: docs/superpowers/specs/2026-07-26-notation-catalog-design.md
-->
<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import PlayableArchive from "./_components/archive/PlayableArchive.svelte";
  import { NOTATION_CATALOG } from "$lib/shared/notation/notation-catalog";

  // The archive documents eight systems, seven of them other people's. A
  // "| The Kinetic Alphabet" suffix here implied it owned all of them.
  const TITLE = "Flow Arts Notation Archive: Who Wrote It Down";
  const DESCRIPTION =
    "A playable archive of eight systems for writing flow arts down, from CAPs on the Home of Poi forums in 2009 to the Kinetic Alphabet. Each entry links to its creator's own material.";
  const URL = "https://tkaflowarts.com/notation";

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: "Writing flow arts down",
        description: DESCRIPTION,
        mainEntityOfPage: URL,
        author: { "@type": "Person", name: "Austen Cloud" },
        about: NOTATION_CATALOG.map((entry) => ({
          "@type": "CreativeWork",
          name: entry.system,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: "https://tkaflowarts.com/",
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Flow Arts Notation",
            item: URL,
          },
        ],
      },
    ],
  };
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="article">
  {@html `<script type="application/ld+json">${JSON.stringify(jsonLd)}<\/script>`}
</Seo>

<div class="playable-viewport" style:view-transition-name="launchpad-notation">
  <PlayableArchive />
</div>

<style>
  .playable-viewport {
    position: relative;
    height: 100vh;
    height: 100dvh;
    padding-top: 64px;
    box-sizing: border-box;
    overflow: hidden;
    background: oklch(0.115 0.008 270);
    color: oklch(0.9 0.02 270);
  }

  /* Grain keeps the archive's flat ink surfaces from reading as app glass. */
  .playable-viewport::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 100;
    pointer-events: none;
    opacity: 0.05;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
  }
</style>
