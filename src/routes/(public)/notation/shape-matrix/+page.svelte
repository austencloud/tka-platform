<script lang="ts">
  import Seo from "$lib/shared/components/Seo.svelte";
  import { mutateCurrentUrl } from "$lib/shared/navigation/services/url-state";
  import ShapeMatrixApp from "$lib/shared/shape-matrix/app/ShapeMatrixApp.svelte";
  import type { ShapeMatrixAppSnapshot } from "$lib/shared/shape-matrix/app/state/shape-matrix-app-state.svelte";
  import {
    readShapeMatrixRouteState,
    writeShapeMatrixRouteState,
  } from "./_state/shape-matrix-url";

  const TITLE = "Shape Matrix Explorer | Flow Arts Composer";
  const DESCRIPTION =
    "Explore shape pairings in an interactive matrix, then open six timing-and-direction realizations and watch each path traced live.";
  const URL = "https://tkaflowarts.com/notation/shape-matrix";
  const ROUTE_STATE_PARAMS = [
    "level",
    "turn",
    "blueTurn",
    "redTurn",
    "axis",
    "labels",
    "prop",
    "driver",
    "size",
    "blue",
    "red",
    "mode",
    "propMode",
  ];
  const persistence = {
    restore: (): ShapeMatrixAppSnapshot | null => {
      const params = new URLSearchParams(window.location.search);
      return ROUTE_STATE_PARAMS.some((name) => params.has(name))
        ? readShapeMatrixRouteState(params.toString())
        : null;
    },
    persist: (snapshot: ShapeMatrixAppSnapshot): void => {
      mutateCurrentUrl((url) => writeShapeMatrixRouteState(url, snapshot));
    },
  };
</script>

<Seo title={TITLE} description={DESCRIPTION} canonical={URL} ogType="website">
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "Shape Matrix Explorer",
    "url": "${URL}",
    "description": "${DESCRIPTION}",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web",
    "isBasedOn": {
      "@type": "CreativeWork",
      "name": "144 Shape Matrix",
      "url": "http://spinscience.xyz/2014/07/10/144-shape-matrix-even-petaled-flowers-rework/",
      "creator": {
        "@type": "Person",
        "name": "Lorq Nichols",
        "alternateName": "Spin Science"
      }
    },
    "provider": {
      "@type": "Organization",
      "name": "The Kinetic Alphabet",
      "url": "https://tkaflowarts.com/"
    }
  }
  </script>`}
  {@html `<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://tkaflowarts.com/" },
      { "@type": "ListItem", "position": 2, "name": "Notation", "item": "https://tkaflowarts.com/notation" },
      { "@type": "ListItem", "position": 3, "name": "Shape Matrix Explorer", "item": "${URL}" }
    ]
  }
  </script>`}
</Seo>

<div class="shape-matrix-page">
  <ShapeMatrixApp {persistence} />
</div>

<style>
  .shape-matrix-page {
    position: fixed;
    inset: 0;
    z-index: 2;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
</style>
