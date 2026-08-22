<script lang="ts">
  import GuideShell from "./_components/GuideShell.svelte";
  import { bodyPagesByGroup } from "./level-1/_data/guide-manifest";
  import { seoForSlug } from "./level-1/_data/guide-page-seo";

  const firstTopic = bodyPagesByGroup()[0]?.entries[0]?.entry;
  const firstTopicHref = firstTopic
    ? `/guide/level-1/${firstTopic.id}`
    : "/guide/level-1";
  const firstTopicLabel = firstTopic
    ? seoForSlug(firstTopic.id, firstTopic.title).h1
    : "Level 1";

  const references = [
    {
      eyebrow: "Level 1",
      title: "The foundation",
      description: "The grid, positions, motions, letters, and words.",
      href: firstTopicHref,
      action: `Begin with ${firstTopicLabel}`,
      icon: "fa-compass-drafting",
    },
    {
      eyebrow: "Level 2",
      title: "Turns and transitions",
      description: "Continue into the intermediate notation system.",
      href: "/guide/level-2/turns",
      action: "Explore Level 2",
      icon: "fa-rotate",
    },
    {
      eyebrow: "Reference",
      title: "The Codex",
      description: "Browse every published Kinetic Alphabet letter.",
      href: "/guide/codex",
      action: "Open the Codex",
      icon: "fa-table-cells-large",
    },
    {
      eyebrow: "Printable",
      title: "Level 1 PDF",
      description: "Keep the book layout or take it away from the screen.",
      href: "/guides/level-1.pdf",
      action: "Download the PDF",
      icon: "fa-file-arrow-down",
      download: true,
    },
  ] as const;
</script>

<svelte:head>
  <title>The Kinetic Alphabet Guide | Flow Arts Notation</title>
  <meta
    name="description"
    content="Read The Kinetic Alphabet as a written flow arts notation reference, or learn the available concepts through interactive lessons."
  />
  <link rel="canonical" href="https://tkaflowarts.com/guide" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://tkaflowarts.com/guide" />
  <meta property="og:title" content="The Kinetic Alphabet Guide" />
  <meta
    property="og:description"
    content="Read the written Guide or learn The Kinetic Alphabet through interactive lessons."
  />
  <meta property="og:site_name" content="The Kinetic Alphabet" />
  <meta
    property="og:image"
    content="https://tkaflowarts.com/branding/og-image.png"
  />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="The Kinetic Alphabet" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@tkaflowarts" />
  <meta name="twitter:title" content="The Kinetic Alphabet Guide" />
  <meta
    name="twitter:description"
    content="Read the written Guide or learn The Kinetic Alphabet through interactive lessons."
  />
  <meta
    name="twitter:image"
    content="https://tkaflowarts.com/branding/og-image.png"
  />
</svelte:head>

<GuideShell>
  <main class="guide-hub guide-page-route">
    <section class="hero" style:view-transition-name="launchpad-guide">
      <div class="hero-copy">
        <span class="kicker">The Kinetic Alphabet</span>
        <h1>Learn it or look it up.</h1>
        <p>
          Interactive lessons teach one idea at a time. The written Guide keeps
          the complete reference close when you want to read, scan, or print it.
        </p>
        <div class="hero-actions">
          <a class="primary-action" href="/learn/concepts">
            <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
            <span>
              <strong>Start learning</strong>
              <small>Six interactive lessons available</small>
            </span>
          </a>
          <a class="secondary-action" href={firstTopicHref}>
            <i class="fa-solid fa-book-open" aria-hidden="true"></i>
            <span>
              <strong>Start reading</strong>
              <small>{firstTopicLabel}</small>
            </span>
          </a>
        </div>
      </div>

      <div class="route-card" aria-label="Two ways to use The Kinetic Alphabet">
        <div class="route-option featured">
          <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i>
          <div>
            <span>Learn</span>
            <strong>Try the idea</strong>
            <p>Guided, interactive, and progress-aware.</p>
          </div>
        </div>
        <div class="route-connector" aria-hidden="true">
          <span></span><i class="fa-solid fa-plus"></i><span></span>
        </div>
        <div class="route-option">
          <i class="fa-solid fa-book" aria-hidden="true"></i>
          <div>
            <span>Reference</span>
            <strong>Read the system</strong>
            <p>Web chapters, the Codex, and printable PDFs.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="reference-section" aria-labelledby="reference-heading">
      <div class="section-heading">
        <span class="kicker">Written reference</span>
        <h2 id="reference-heading">Pick up exactly where you need to.</h2>
        <p>
          The contents button opens every chapter. These are the main routes
          through the published material.
        </p>
      </div>

      <div class="reference-grid">
        {#each references as reference}
          <a
            class="reference-card"
            href={reference.href}
            download={reference.download ? true : undefined}
          >
            <span class="reference-icon">
              <i class="fa-solid {reference.icon}" aria-hidden="true"></i>
            </span>
            <span class="reference-copy">
              <small>{reference.eyebrow}</small>
              <strong>{reference.title}</strong>
              <span>{reference.description}</span>
            </span>
            <span class="reference-action">
              {reference.action}
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </span>
          </a>
        {/each}
      </div>
    </section>
  </main>
</GuideShell>

<style>
  .guide-hub {
    --guide-blue: #7c9cff;
    --guide-violet: #9d7cff;
    width: 100%;
    min-height: calc(100vh - 64px);
    padding: clamp(2.5rem, 7vw, 6rem) clamp(1rem, 4vw, 4rem) 6rem;
    color: #f6f4ff;
    font-family: Inter, system-ui, sans-serif;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(19rem, 0.9fr);
    gap: clamp(2rem, 6vw, 7rem);
    align-items: center;
    width: min(100%, 92rem);
    margin: 0 auto;
  }

  .kicker {
    display: block;
    margin-bottom: 0.75rem;
    color: #9db5ff;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.13em;
    text-transform: uppercase;
  }

  h1,
  h2 {
    margin: 0;
    color: #fff;
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-style: italic;
    font-variation-settings:
      "opsz" 144,
      "wght" 700,
      "SOFT" 0,
      "WONK" 1;
    text-wrap: balance;
  }

  h1 {
    max-width: 12ch;
    font-size: clamp(3rem, 6.8vw, 6.8rem);
    line-height: 0.94;
    letter-spacing: -0.045em;
  }

  .hero-copy > p {
    max-width: 40rem;
    margin: 1.5rem 0 0;
    color: rgba(236, 233, 245, 0.72);
    font-size: clamp(1rem, 1.5vw, 1.2rem);
    line-height: 1.65;
    text-wrap: pretty;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 2rem;
  }

  .primary-action,
  .secondary-action {
    display: inline-flex;
    align-items: center;
    gap: 0.8rem;
    min-height: 4rem;
    padding: 0.7rem 1rem;
    border: 1px solid transparent;
    border-radius: 14px;
    color: #fff;
    text-decoration: none;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .primary-action {
    background: linear-gradient(135deg, #647ff1, #855bd9);
    box-shadow: 0 16px 40px rgba(101, 88, 218, 0.3);
  }

  .secondary-action {
    background: rgba(255, 255, 255, 0.045);
    border-color: rgba(255, 255, 255, 0.13);
  }

  .primary-action:hover,
  .secondary-action:hover {
    transform: translateY(-2px);
  }

  .secondary-action:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(157, 124, 255, 0.6);
  }

  .primary-action > i,
  .secondary-action > i {
    width: 1.3rem;
    font-size: 1.15rem;
    text-align: center;
  }

  .primary-action span,
  .secondary-action span {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .primary-action strong,
  .secondary-action strong {
    font-size: 0.95rem;
  }

  .primary-action small,
  .secondary-action small {
    color: rgba(255, 255, 255, 0.68);
    font-size: 0.75rem;
  }

  .route-card {
    padding: clamp(1.25rem, 3vw, 2rem);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    background:
      radial-gradient(
        circle at 12% 0%,
        rgba(124, 156, 255, 0.14),
        transparent 48%
      ),
      rgba(18, 17, 35, 0.62);
    box-shadow: 0 28px 80px rgba(2, 3, 15, 0.3);
    backdrop-filter: blur(18px);
  }

  .route-option {
    display: grid;
    grid-template-columns: 3.25rem minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
    padding: 1.15rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.025);
  }

  .route-option.featured {
    border-color: rgba(124, 156, 255, 0.42);
    background: rgba(124, 156, 255, 0.08);
  }

  .route-option > i {
    display: grid;
    width: 3.25rem;
    height: 3.25rem;
    place-items: center;
    border-radius: 12px;
    background: rgba(124, 156, 255, 0.14);
    color: #b6c6ff;
    font-size: 1.15rem;
  }

  .route-option div {
    display: flex;
    flex-direction: column;
  }

  .route-option span {
    margin-bottom: 0.2rem;
    color: #9db5ff;
    font-size: 0.7rem;
    font-weight: 750;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .route-option strong {
    font-size: 1.05rem;
  }

  .route-option p {
    margin: 0.35rem 0 0;
    color: rgba(236, 233, 245, 0.6);
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .route-connector {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.7rem 1.5rem;
    color: rgba(255, 255, 255, 0.35);
  }

  .route-connector span {
    height: 1px;
    flex: 1;
    background: rgba(255, 255, 255, 0.08);
  }

  .reference-section {
    width: min(100%, 92rem);
    margin: clamp(5rem, 10vw, 10rem) auto 0;
  }

  .section-heading {
    display: grid;
    grid-template-columns: minmax(0, 0.8fr) minmax(18rem, 1.2fr);
    column-gap: 2rem;
    align-items: end;
  }

  .section-heading .kicker {
    grid-column: 1 / -1;
  }

  h2 {
    max-width: 16ch;
    font-size: clamp(2rem, 4vw, 3.75rem);
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .section-heading p {
    max-width: 34rem;
    margin: 0 0 0.25rem;
    justify-self: end;
    color: rgba(236, 233, 245, 0.65);
    line-height: 1.6;
  }

  .reference-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.8rem;
    margin-top: 2rem;
  }

  .reference-card {
    display: flex;
    min-height: 18rem;
    flex-direction: column;
    padding: 1.4rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.035);
    color: #fff;
    text-decoration: none;
    transition:
      transform 160ms ease,
      border-color 160ms ease,
      background 160ms ease;
  }

  .reference-card:hover {
    transform: translateY(-3px);
    border-color: rgba(124, 156, 255, 0.52);
    background: rgba(124, 156, 255, 0.07);
  }

  .reference-icon {
    display: grid;
    width: 2.8rem;
    height: 2.8rem;
    place-items: center;
    border-radius: 11px;
    background: rgba(124, 156, 255, 0.12);
    color: #aabfff;
  }

  .reference-copy {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    margin-top: 2rem;
  }

  .reference-copy small {
    color: #9db5ff;
    font-size: 0.68rem;
    font-weight: 750;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .reference-copy strong {
    font-family: var(--page-title-font, "Fraunces", Georgia, serif);
    font-size: 1.35rem;
  }

  .reference-copy > span {
    color: rgba(236, 233, 245, 0.58);
    font-size: 0.875rem;
    line-height: 1.55;
  }

  .reference-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: auto;
    padding-top: 1.5rem;
    color: #c8d3ff;
    font-size: 0.78rem;
    font-weight: 700;
  }

  @media (max-width: 1120px) {
    .reference-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .reference-card {
      min-height: 15rem;
    }
  }

  @media (max-width: 840px) {
    .hero {
      grid-template-columns: 1fr;
    }
    h1 {
      max-width: 14ch;
    }
    .route-card {
      max-width: 38rem;
    }
  }

  @media (max-width: 640px) {
    .guide-hub {
      padding-top: 6.5rem;
    }
    .hero-actions {
      align-items: stretch;
      flex-direction: column;
    }
    .primary-action,
    .secondary-action {
      width: 100%;
    }
    .section-heading {
      grid-template-columns: 1fr;
    }
    .section-heading p {
      margin-top: 1rem;
      justify-self: start;
    }
    .reference-grid {
      grid-template-columns: 1fr;
    }
    .reference-card {
      min-height: 13rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .primary-action,
    .secondary-action,
    .reference-card {
      transition: none;
    }
    .primary-action:hover,
    .secondary-action:hover,
    .reference-card:hover {
      transform: none;
    }
  }
</style>
