<script lang="ts">
  /**
   * Crawlable reflow host for the Hand Positions guide page. Prerendered static
   * HTML: GuideSeo (canonical → tkaflowarts.com, LearningResource + Breadcrumb
   * JSON-LD) + <h1> + FlowFrame over the SAME single-source content the reader's
   * flow toggle uses (guide-content.ts). Austen's prose ranks; pictographs hydrate
   * into their reserved boxes. One content model, two hosts — the reader is the
   * app, this is the SEO surface. Spec: 2026-07-14-guide-reflow-single-source-design.md.
   */
  import GuideSeo from "../_components/GuideSeo.svelte";
  import FlowFrame from "../_components/FlowFrame.svelte";
  import { GUIDE_CONTENT } from "../_data/guide-content";
  import "../_styles/guide.css";

  const content = GUIDE_CONTENT["hand-positions"]!;

  // The real guide this doorway funnels to: the interactive reader deep-linked to
  // this topic, and the downloadable full Level-1 PDF (static/guides/level-1.pdf).
  const INTERACTIVE_HREF = "/learn/guide/hand-positions";
  const PDF_HREF = "/guides/level-1.pdf";
</script>

<GuideSeo
  title="Flow Arts Positions: Alpha, Beta, Gamma · The Kinetic Alphabet"
  description="The three starting hand positions in The Kinetic Alphabet notation. In Alpha the hands occupy the points across from each other; in Beta the same point; in Gamma they form a right angle."
  path="/guide/level-1/hand-positions"
  kind="LearningResource"
  partOf={{ name: "Level 1 Guide", path: "/guide" }}
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Hand Positions", path: "/guide/level-1/hand-positions" },
  ]}
/>

<main class="guide-flow-route">
  <header class="doorway-hero">
    <h1>Flow Arts Positions: Alpha, Beta, Gamma</h1>
    <p class="hero-tagline">The three starting hand positions in The Kinetic Alphabet.</p>
    <!-- This page is a DOORWAY: it ranks in search, then hands you to the real
         guide. The hero actions ARE the guide (interactive + PDF); the content
         below is the searchable payload. -->
    <div class="hero-actions">
      <a class="btn-primary" href={INTERACTIVE_HREF}>Open the interactive guide</a>
      <a class="btn-secondary" href={PDF_HREF} download>Download the PDF guide</a>
    </div>
  </header>

  <FlowFrame {content} />

  <footer class="flow-cta">
    <a class="btn-primary" href={INTERACTIVE_HREF}>Open the interactive guide</a>
    <nav class="cta-links" aria-label="Keep exploring">
      <a href="/notation">Where to start</a>
      <a href="/composer">Build a sequence</a>
      <a href="/guide">All guides</a>
    </nav>
  </footer>
</main>

<style>
  /* Standalone editorial page — owns its light/dark palette (not the app's dark-
     canvas --theme-* vars) and hands FlowFrame the matching --ink so the column
     is legible in both. Light: near-black ink on warm white. Dark: light ink on
     deep slate. */
  .guide-flow-route {
    min-height: 100vh;
    background: #fbfaf7;
    color: #1a1a1a;
    padding-block: 1.5rem 0;
    --ink: #1a1a1a;
    --ink-dim: #555;
    --glyph-invert: 0;
  }
  /* Hero: the doorway's job is to route to the real guide, so the interactive +
     PDF actions sit right under the title, above the searchable content. */
  .doorway-hero {
    max-width: 44rem;
    margin: 0 auto;
    padding: 1.5rem 1.5rem 0.5rem;
    text-align: center;
  }
  .doorway-hero h1 {
    margin: 0;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .hero-tagline {
    margin: 0.6rem 0 1.5rem;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: clamp(1.1rem, 2.5vw, 1.35rem);
    color: var(--ink-dim, #555);
  }
  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.75rem;
  }

  /* Funnel + related links. Primary/secondary look like buttons (clickables-look-
     like-buttons); the pill siblings are outline links, 44px min target. */
  .flow-cta {
    max-width: 44rem;
    margin: 1rem auto 0;
    padding: 2rem 1.5rem 4rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    border-top: 1px solid color-mix(in oklab, var(--ink, #1a1a1a) 15%, transparent);
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.75rem 1.75rem;
    border-radius: 999px;
    background: #e8590c;
    color: #fff;
    font-weight: 650;
    font-size: 1.05rem;
    text-decoration: none;
    box-shadow: 0 4px 16px rgba(232, 89, 12, 0.3);
    transition: transform 120ms ease, box-shadow 120ms ease;
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(232, 89, 12, 0.4);
  }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.75rem 1.5rem;
    border-radius: 999px;
    border: 1.5px solid color-mix(in oklab, var(--ink, #1a1a1a) 40%, transparent);
    background: transparent;
    color: var(--ink, #1a1a1a);
    font-weight: 600;
    font-size: 1.05rem;
    text-decoration: none;
    transition: background 120ms ease;
  }
  .btn-secondary:hover {
    background: color-mix(in oklab, var(--ink, #1a1a1a) 8%, transparent);
  }
  .cta-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
  }
  .cta-links a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0.5rem 1.1rem;
    border-radius: 999px;
    border: 1px solid color-mix(in oklab, var(--ink, #1a1a1a) 30%, transparent);
    color: var(--ink, #1a1a1a);
    font-size: 0.98rem;
    text-decoration: none;
    transition: background 120ms ease;
  }
  .cta-links a:hover {
    background: color-mix(in oklab, var(--ink, #1a1a1a) 8%, transparent);
  }

  @media (prefers-color-scheme: dark) {
    .guide-flow-route {
      background: #14141b;
      color: #ececf2;
      --ink: #ececf2;
      --ink-dim: #a8a8b4;
      --glyph-invert: 1;
    }
  }
  :global(:root[data-theme="light"]) .guide-flow-route {
    background: #fbfaf7;
    color: #1a1a1a;
    --ink: #1a1a1a;
    --ink-dim: #555;
    --glyph-invert: 0;
  }
  :global(:root[data-theme="dark"]) .guide-flow-route {
    background: #14141b;
    color: #ececf2;
    --ink: #ececf2;
    --ink-dim: #a8a8b4;
    --glyph-invert: 1;
  }
</style>
