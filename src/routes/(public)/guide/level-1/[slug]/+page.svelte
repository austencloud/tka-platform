<script lang="ts">
  /**
   * Crawlable + interactive guide topic page. Prerendered static HTML
   * (GuideSeo + the flow reading column with Austen's prose and every
   * pictograph's describePictograph aria-label) that hydrates into the full
   * per-topic reader (sheet⇄flow switcher, companion, prev/next nav). One
   * surface - no doorway, no funnel. Spec:
   * 2026-07-14-guide-crawlable-paginated-reader-design.md.
   */
  import GuideSeo from "../_components/GuideSeo.svelte";
  import GuidePageHost from "../_components/GuidePageHost.svelte";
  import { GUIDE_BODY_PAGES } from "../_data/guide-manifest";
  import { seoForSlug } from "../_data/guide-page-seo";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const slug = $derived(data.slug);
  const meta = $derived(GUIDE_BODY_PAGES.find((p) => p.id === slug));
  const seo = $derived(seoForSlug(slug, meta?.title ?? slug));
</script>

<GuideSeo
  title={seo.title}
  description={seo.description}
  path={`/guide/level-1/${slug}`}
  kind="LearningResource"
  partOf={{ name: "Level 1 Guide", path: "/guide" }}
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: meta?.title ?? seo.h1, path: `/guide/level-1/${slug}` },
  ]}
/>

<GuidePageHost {slug} />
