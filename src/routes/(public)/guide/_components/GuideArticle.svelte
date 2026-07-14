<script lang="ts">
  /**
   * GuideArticle — the layout + SEO wrapper for prose-first, prerendered guide
   * articles (the education cluster: /guide/<concept>). One place owns the head
   * (via `GuideSeo`), the mobile-first editorial reflow container (shared
   * `public-editorial.css`, the same type system /about and /roots use), and the
   * related-links + CTA blocks — so individual articles carry only Austen's prose
   * and figures and never re-derive layout or meta (mirrors the SequenceViewer-
   * Shell anti-drift discipline).
   *
   * The `(public)` layout supplies the cosmic shell + SiteHeader; this renders
   * the `.editorial` content inside it.
   */
  import type { Snippet } from "svelte";
  import GuideSeo from "../level-1/_components/GuideSeo.svelte";
  import "$lib/shared/landing/styles/public-editorial.css";

  type Crumb = { name: string; path: string };
  type Related = { name: string; path: string };
  type Cta = { heading: string; text: string; href: string; label: string };

  let {
    seoTitle,
    heading,
    description,
    path,
    lede,
    breadcrumbs = [] as Crumb[],
    related = [] as Related[],
    cta = null as Cta | null,
    children,
  }: {
    /** Full <title>/OG title (target term + brand). */
    seoTitle: string;
    /** Display <h1> — the target term, human-facing. */
    heading: string;
    description: string;
    path: string;
    /** Optional one-line subtitle under the h1 (Austen's words). */
    lede?: string;
    breadcrumbs?: Crumb[];
    related?: Related[];
    cta?: Cta | null;
    /** The article body — prose sections + figures. */
    children: Snippet;
  } = $props();
</script>

<GuideSeo title={seoTitle} {description} {path} kind="LearningResource" {breadcrumbs} />

<article class="editorial guide-article">
  <a class="back-link" href="/guide">← All guides</a>

  <header class="editorial-header center">
    <h1 class="page-title">{heading}</h1>
    {#if lede}
      <p class="page-subtitle">{lede}</p>
    {/if}
  </header>

  {@render children()}

  {#if related.length}
    <nav class="editorial-section related" aria-label="Related guides">
      <span class="section-kicker">Keep reading</span>
      <div class="resource-row">
        {#each related as r (r.path)}
          <a class="resource-chip" href={r.path}>{r.name}</a>
        {/each}
      </div>
    </nav>
  {/if}

  {#if cta}
    <div class="cta-card">
      <h3>{cta.heading}</h3>
      <p>{cta.text}</p>
      <a class="cta-button" href={cta.href}>{cta.label}</a>
    </div>
  {/if}
</article>
