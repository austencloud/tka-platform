<!--
  /notation — a chronological catalog of systems for writing flow arts down.

  Rebuilt 2026-07-27, replacing the hub that was gated on 2026-07-26 for
  explaining systems it did not own and getting them wrong. This page explains
  nothing: it records who wrote flow arts down and links out to their own
  material. Entry data and its sourcing rules live in
  $lib/shared/notation/notation-catalog.ts.

  Spec: docs/superpowers/specs/2026-07-26-notation-catalog-design.md
-->
<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import NotationCatalog from "./_components/NotationCatalog.svelte";
  import { NOTATION_CATALOG } from "$lib/shared/notation/notation-catalog";
  import "$lib/shared/landing/styles/public-editorial.css";

  const TITLE = "Flow Arts Notation: Who Wrote It Down | The Kinetic Alphabet";
  const DESCRIPTION =
    "A chronological catalog of systems for writing flow arts down, from CAPs on the Home of Poi forums in 2009 to the Kinetic Alphabet. Each entry links to its creator's own material.";
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

<NotationCatalog />
