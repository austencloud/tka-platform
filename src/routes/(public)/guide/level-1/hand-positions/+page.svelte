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
  <h1>Flow Arts Positions: Alpha, Beta, Gamma</h1>
  <FlowFrame {content} />
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
  .guide-flow-route h1 {
    max-width: 44rem;
    margin: 0 auto;
    padding: 1.5rem 1.5rem 0;
    font-family: "Cormorant Garamond", Georgia, serif;
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
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
