<script lang="ts">
  /**
   * /guide/flow-arts-positions — the reference article proving the GuideArticle
   * + GuideFigure system: prerendered, prose-first, LearningResource + Breadcrumb
   * schema, pictographs that hydrate into reserved boxes, mobile reflow, internal
   * links into /notation + /composer.
   *
   * Every sentence is Austen's, lifted VERBATIM from the Level-1 guide's Hand
   * Positions sheet (`_pages/HandPositionsPage.svelte`). The three definitions
   * were cross-checked against MCP position canon (alpha 180°/opposite,
   * beta 0°/same point, gamma 90°/right angle) before publishing. No prose is
   * AI-written (enforces `no-ghostwriting-austen`).
   */
  import GuideArticle from "../_components/GuideArticle.svelte";
  import GuideFigure from "../_components/GuideFigure.svelte";
  import { startPositionManager } from "$lib/shared/create/services/start-position-manager";
  import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

  // The 16 canonical diamond positions in α / β / γ order (4 / 4 / 8), prop forced
  // to HAND — the exact source the Level-1 Hand Positions sheet renders. Pure data
  // (no browser globals in getAllStartPositionVariations), so it prerenders. Pick
  // one representative of each of the first three positions for the figures.
  const positions = startPositionManager
    .getAllStartPositionVariations(GridMode.DIAMOND)
    .map((p) => ({
      ...p,
      motions: {
        blue: p.motions?.blue ? { ...p.motions.blue, propType: PropType.HAND } : undefined,
        red: p.motions?.red ? { ...p.motions.red, propType: PropType.HAND } : undefined,
      },
    }));
  const alpha = positions[0] ?? null;
  const beta = positions[4] ?? null;
  const gamma = positions[8] ?? null;
</script>

<GuideArticle
  seoTitle="Flow Arts Positions: Alpha, Beta, Gamma | The Kinetic Alphabet"
  heading="Flow Arts Positions: Alpha, Beta, Gamma"
  description="The Kinetic Alphabet's first three hand positions. In Alpha the hands occupy the points across from each other; in Beta the same point; in Gamma they form a right angle."
  path="/guide/flow-arts-positions"
  lede="There are multiple ways to combine two hand points to form a hand position."
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Flow Arts Positions", path: "/guide/flow-arts-positions" },
  ]}
  related={[
    { name: "Flow Arts Notation", path: "/notation" },
    { name: "Level 2 Guide: Turns", path: "/guide/level-2/turns" },
  ]}
  cta={{
    heading: "See positions in motion",
    text: "Build and read sequences with these positions in the composer.",
    href: "/composer",
    label: "Open the composer",
  }}
>
  <section class="editorial-section">
    <span class="section-kicker">The basics</span>
    <div class="prose">
      <p>
        Positions can be rotated or mirrored. In The Kinetic Alphabet, our first
        three positions are called Alpha, Beta, and Gamma.
      </p>
    </div>
  </section>

  <section class="editorial-section">
    <h2 class="section-title">Alpha</h2>
    <div class="prose">
      <p>In Alpha, the hands occupy the points across from each other.</p>
    </div>
    <GuideFigure
      data={alpha}
      label="Alpha (α)"
      caption="Alpha — the hands occupy the points across from each other."
    />
  </section>

  <section class="editorial-section">
    <h2 class="section-title">Beta</h2>
    <div class="prose">
      <p>In Beta, the hands occupy the same point.</p>
    </div>
    <GuideFigure
      data={beta}
      label="Beta (β)"
      caption="Beta — the hands occupy the same point."
    />
  </section>

  <section class="editorial-section">
    <h2 class="section-title">Gamma</h2>
    <div class="prose">
      <p>In Gamma, the hands form a right angle.</p>
    </div>
    <GuideFigure
      data={gamma}
      label="Gamma (γ)"
      caption="Gamma — the hands form a right angle."
    />
  </section>
</GuideArticle>
