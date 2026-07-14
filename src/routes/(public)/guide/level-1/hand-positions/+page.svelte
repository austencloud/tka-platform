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
  .guide-flow-route {
    min-height: 100vh;
    background: var(--theme-bg, #fff);
    color: var(--theme-text, #1a1a1a);
  }
  .guide-flow-route h1 {
    max-width: 46rem;
    margin: 0 auto;
    padding: 2rem 1.25rem 0;
    font-size: clamp(1.9rem, 5vw, 2.8rem);
    font-weight: 750;
    line-height: 1.1;
  }
</style>
