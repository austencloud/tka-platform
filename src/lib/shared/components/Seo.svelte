<script lang="ts">
  /**
   * One SEO head primitive for any public page — title, meta description,
   * canonical URL, full Open Graph, and Twitter card. Generalized from the
   * guide chapter head (`GuideSeo.svelte`, which owns its own JSON-LD graph
   * and stays as-is). Pages that just need a correct, complete <head> reach
   * for this instead of hand-rolling `<svelte:head>` meta tags — that's how
   * /terms, /privacy, /delete-account, and the shop pages drifted (missing
   * canonical/OG/Twitter) before this existed.
   *
   * `children` is an optional passthrough for anything a page needs inside
   * <svelte:head> that this primitive doesn't model itself (e.g. a page's
   * own JSON-LD <script> block, extra preconnect links).
   */
  import type { Snippet } from "svelte";
  import { LANDING_DOMAIN } from "../../../config/domains";

  const DEFAULT_OG_IMAGE = `${LANDING_DOMAIN}/branding/og-image.png`;

  let {
    title,
    description,
    canonical,
    ogType = "website",
    ogImage = DEFAULT_OG_IMAGE,
    ogImageAlt = "The Kinetic Alphabet",
    noindex = false,
    children,
  }: {
    title: string;
    description: string;
    canonical: string;
    ogType?: string;
    ogImage?: string;
    ogImageAlt?: string;
    noindex?: boolean;
    children?: Snippet;
  } = $props();
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {/if}

  <meta property="og:type" content={ogType} />
  <meta property="og:site_name" content="The Kinetic Alphabet" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:url" content={canonical} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={ogImage} />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={ogImageAlt} />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@tkaflowarts" />
  <meta name="twitter:creator" content="@tkaflowarts" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImage} />
  <meta name="twitter:image:alt" content={ogImageAlt} />

  {@render children?.()}
</svelte:head>
