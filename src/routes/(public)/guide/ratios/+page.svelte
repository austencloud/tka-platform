<script lang="ts">
  import GuideShell from "../_components/GuideShell.svelte";
  import GuideSeo from "../level-1/_components/GuideSeo.svelte";
  import {
    KINETIC_SHAPE_ENGINE_AUTHOR,
    ORIGINAL_SHAPE_MATRIX_URL,
  } from "$lib/shared/shape-matrix/app/shape-engine-identity";
  import { levelForTurnValue } from "$lib/shared/create/services/level-turn-values";

  const sourceFamilies = [
    {
      ratio: "1:1",
      turn: 0,
      turnLabel: "0 turns",
      styles: [
        "Extension",
        "Isolation",
        "2-petal vertical antispin",
        "2-petal horizontal antispin",
      ],
    },
    {
      ratio: "1:3",
      turn: 1,
      turnLabel: "1 turn",
      styles: [
        "2-petal horizontal prospin",
        "2-petal vertical prospin",
        "4-petal diamond antispin",
        "4-petal box antispin",
      ],
    },
    {
      ratio: "1:5",
      turn: 2,
      turnLabel: "2 turns",
      styles: [
        "4-petal box prospin",
        "4-petal diamond prospin",
        "6-petal vertical antispin",
        "6-petal horizontal antispin",
      ],
    },
  ].map((family) => ({
    ...family,
    engineHref: `/notation/shape-matrix?level=${levelForTurnValue(family.turn)}&leftTurn=${family.turn}&rightTurn=${family.turn}&axis=both&labels=turns&prop=staff`,
  }));
</script>

<GuideSeo
  title="The Ratios Behind the Shape Matrix · The Kinetic Alphabet Guide"
  description="See how Lorq Nichols built the original 144 Shape Matrix from the 1:1, 1:3, and 1:5 VTG families, and how Kinetic Shape Engine carries them forward."
  path="/guide/ratios"
  partOf={{ name: "The Kinetic Alphabet Guide", path: "/guide" }}
  breadcrumbs={[
    { name: "Home", path: "/" },
    { name: "Guide", path: "/guide" },
    { name: "Ratios", path: "/guide/ratios" },
  ]}
  datePublished="2026-09-04"
/>

<GuideShell>
  <article class="ratio-guide guide-page-route">
    <header class="hero">
      <div class="hero-copy">
        <span class="kicker">Lorq’s original 144</span>
        <h1>Three ratios made the Shape Matrix.</h1>
        <p>
          Lorq Nichols built the original matrix from the VTG families
          <strong>1:1, 1:3, and 1:5.</strong> Each family supplied four driving styles.
          That gave each hand twelve choices and made 144 pairings.
        </p>
      </div>

      <div
        class="count"
        aria-label="Three ratio families times four styles equals twelve choices per hand. Twelve times twelve equals 144 pairings."
      >
        <div><strong>3</strong><span>ratio families</span></div>
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        <div><strong>4</strong><span>styles each</span></div>
        <i class="fa-solid fa-equals" aria-hidden="true"></i>
        <div><strong>12</strong><span>per hand</span></div>
        <div class="pairing">
          <strong>12 × 12</strong><span>144 pairings</span>
        </div>
      </div>
    </header>

    <section class="families" aria-labelledby="families-heading">
      <header class="section-intro">
        <h2 id="families-heading">The original twelve</h2>
        <p>Each ratio branches into four ways to drive the prop.</p>
      </header>

      <div class="family-list">
        {#each sourceFamilies as family}
          <article class="family-row">
            <div class="family-name">
              <strong>{family.ratio}</strong>
              <span>{family.turnLabel} in TKA</span>
            </div>

            <ul>
              {#each family.styles as style}
                <li>{style}</li>
              {/each}
            </ul>

            <a
              href={family.engineHref}
              aria-label={`Open the ${family.ratio} family in Kinetic Shape Engine`}
            >
              Open in Shape Engine
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </a>
          </article>
        {/each}
      </div>
    </section>

    <section class="continuation" aria-labelledby="continuation-heading">
      <div class="continuation-copy">
        <span class="kicker">Where TKA takes it</span>
        <h2 id="continuation-heading">The matrix became an engine.</h2>
        <p>
          TKA calls these same families 0 turns, 1 turn, and 2 turns. Kinetic
          Shape Engine keeps Lorq’s row-and-column pairing, then adds half-turn
          and quarter-turn bands. Theory Matrix can pair any two whole-number
          ratios.
        </p>
      </div>

      <div
        class="turn-map"
        aria-label="VTG ratios mapped to Kinetic Alphabet turns"
      >
        {#each sourceFamilies as family}
          <div>
            <strong>{family.ratio}</strong>
            <i class="fa-solid fa-arrow-right-long" aria-hidden="true"></i>
            <span>{family.turnLabel}</span>
          </div>
        {/each}
      </div>
    </section>

    <section class="lineage" aria-labelledby="lineage-heading">
      <div>
        <span class="kicker">Credit where it belongs</span>
        <h2 id="lineage-heading">VTG to Lorq to Shape Engine</h2>
        <p>
          VTG supplied the ratio families. Lorq organized twelve driving styles
          into the 144 Shape Matrix. {KINETIC_SHAPE_ENGINE_AUTHOR} built Kinetic Shape
          Engine independently, using that matrix as a starting point for a much larger
          generator.
        </p>
      </div>

      <nav aria-label="Ratio history and source material">
        <a href="/history#archive-record-vtg">VTG history</a>
        <a href="/history#archive-record-lorq">Lorq Nichols in the archive</a>
        <a
          href={ORIGINAL_SHAPE_MATRIX_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Lorq’s original 144
          <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"
          ></i>
        </a>
      </nav>
    </section>
  </article>
</GuideShell>

<style>
  .ratio-guide {
    --ratio-accent: var(--theme-accent, #7c9cff);
    --ratio-text: var(--theme-text, #f6f4ff);
    --ratio-dim: var(--theme-text-dim, rgb(236 233 245 / 0.7));
    --ratio-stroke: var(--theme-stroke, rgb(255 255 255 / 0.12));
    width: min(100%, 96rem);
    margin-inline: auto;
    padding: clamp(3rem, 6vw, 6rem) clamp(1rem, 4vw, 4.5rem) 7rem;
    color: var(--ratio-text);
    font-family: Inter, system-ui, sans-serif;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(25rem, 0.75fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: end;
  }

  .hero-copy {
    max-width: 64rem;
  }

  .kicker {
    display: block;
    margin-bottom: 0.9rem;
    color: color-mix(in srgb, var(--ratio-accent) 80%, white);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  .hero h1 {
    max-width: 12ch;
    padding: 0;
    font-size: clamp(3rem, 5.5vw, 6.2rem);
    font-weight: 780;
    line-height: 0.94;
    letter-spacing: -0.06em;
    text-align: left;
    text-wrap: balance;
  }

  .hero-copy > p {
    max-width: 50rem;
    margin-top: 1.5rem;
    color: var(--ratio-dim);
    font-size: clamp(1.05rem, 1.35vw, 1.25rem);
    line-height: 1.65;
    text-wrap: pretty;
  }

  .hero-copy > p strong {
    color: var(--ratio-text);
    font-weight: 760;
    white-space: nowrap;
  }

  .count {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    gap: 0.8rem;
    align-items: center;
    padding-block: 1.5rem;
    border-block: 1px solid var(--ratio-stroke);
  }

  .count > div:not(.pairing) {
    display: grid;
    gap: 0.25rem;
    min-width: 0;
  }

  .count strong {
    color: var(--ratio-text);
    font-size: clamp(2.2rem, 4vw, 4.2rem);
    font-variant-numeric: tabular-nums;
    line-height: 0.9;
    letter-spacing: -0.055em;
  }

  .count span {
    color: var(--ratio-dim);
    font-size: var(--font-size-min, 0.875rem);
    line-height: 1.25;
  }

  .count > i {
    color: color-mix(in srgb, var(--ratio-accent) 72%, white);
    font-size: 0.85rem;
  }

  .count .pairing {
    grid-column: 1 / -1;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 0.7rem;
    padding-top: 1rem;
    border-top: 1px solid var(--ratio-stroke);
  }

  .count .pairing strong {
    font-size: clamp(1.35rem, 2vw, 2rem);
  }

  section {
    margin-top: clamp(5rem, 9vw, 9rem);
  }

  .section-intro,
  .continuation-copy {
    max-width: 52rem;
  }

  h2 {
    font-size: clamp(2rem, 3.5vw, 3.5rem);
    line-height: 1;
    letter-spacing: -0.045em;
    text-wrap: balance;
  }

  .section-intro p,
  .continuation-copy p,
  .lineage p {
    margin-top: 0.8rem;
    color: var(--ratio-dim);
    line-height: 1.65;
    text-wrap: pretty;
  }

  .family-list {
    margin-top: 2rem;
    border-top: 1px solid var(--ratio-stroke);
  }

  .family-row {
    display: grid;
    grid-template-columns: minmax(10rem, 0.5fr) minmax(22rem, 1.4fr) minmax(
        12rem,
        auto
      );
    gap: clamp(1.5rem, 4vw, 4rem);
    align-items: center;
    min-height: 12rem;
    padding: 1.5rem clamp(0.25rem, 1vw, 1rem);
    border-bottom: 1px solid var(--ratio-stroke);
  }

  .family-name {
    display: grid;
    gap: 0.5rem;
  }

  .family-name strong {
    color: color-mix(in srgb, var(--ratio-accent) 82%, white);
    font-size: clamp(3rem, 5vw, 5.2rem);
    font-variant-numeric: tabular-nums;
    line-height: 0.9;
    letter-spacing: -0.065em;
  }

  .family-name span {
    color: var(--ratio-dim);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 680;
  }

  .family-row ul {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.8rem clamp(1rem, 3vw, 3rem);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .family-row li {
    position: relative;
    padding-left: 1rem;
    color: var(--ratio-dim);
    line-height: 1.45;
  }

  .family-row li::before {
    position: absolute;
    top: 0.68em;
    left: 0;
    width: 0.3rem;
    height: 0.3rem;
    border-radius: 50%;
    background: var(--ratio-accent);
    content: "";
  }

  .family-row > a,
  .lineage a {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    padding: 0.6rem 0.85rem;
    border: 1px solid color-mix(in srgb, var(--ratio-accent) 42%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--ratio-accent) 7%, transparent);
    color: var(--ratio-text);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 720;
    text-align: center;
    text-decoration: none;
    transition:
      border-color var(--transition-fast),
      background-color var(--transition-fast);
  }

  .continuation {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(24rem, 0.8fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: end;
    padding: clamp(2rem, 5vw, 4rem) 0;
    border-block: 1px solid var(--ratio-stroke);
  }

  .turn-map {
    display: grid;
  }

  .turn-map > div {
    display: grid;
    grid-template-columns: 5rem 1.5rem minmax(0, 1fr);
    gap: 1rem;
    align-items: baseline;
    padding: 0.85rem 0;
    border-bottom: 1px solid var(--ratio-stroke);
  }

  .turn-map > div:last-child {
    border-bottom: 0;
  }

  .turn-map strong {
    color: color-mix(in srgb, var(--ratio-accent) 82%, white);
    font-size: 1.55rem;
    font-variant-numeric: tabular-nums;
  }

  .turn-map i {
    color: var(--ratio-dim);
    font-size: 0.8rem;
  }

  .turn-map span {
    font-weight: 720;
  }

  .lineage {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.6fr);
    gap: clamp(3rem, 8vw, 8rem);
    align-items: end;
  }

  .lineage > div {
    max-width: 58rem;
  }

  .lineage nav {
    display: grid;
    gap: 0.65rem;
  }

  .family-row > a:hover,
  .lineage a:hover {
    border-color: color-mix(in srgb, var(--ratio-accent) 72%, transparent);
    background: color-mix(in srgb, var(--ratio-accent) 13%, transparent);
  }

  a:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--ratio-accent) 72%, white);
    outline-offset: 3px;
  }

  @media (max-width: 78rem) {
    .hero,
    .continuation,
    .lineage {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .count,
    .turn-map,
    .lineage nav {
      max-width: 44rem;
    }

    .family-row {
      grid-template-columns: minmax(9rem, 0.45fr) minmax(0, 1fr);
    }

    .family-row > a {
      grid-column: 2;
      justify-self: start;
    }
  }

  @media (max-width: 48rem) {
    .ratio-guide {
      /* GuideShell already reserves room for the fixed contents button. */
      padding-top: 2rem;
    }

    .hero {
      gap: 2.5rem;
    }

    .family-row {
      grid-template-columns: 1fr;
      gap: 1.25rem;
      min-height: 0;
      padding-block: 2rem;
    }

    .family-row > a {
      grid-column: auto;
      justify-self: stretch;
    }

    .family-row ul {
      grid-template-columns: 1fr;
      gap: 0.55rem;
    }
  }

  @media (max-width: 28rem) {
    .count {
      grid-template-columns: 1fr auto 1fr;
    }

    .count > div:nth-of-type(3),
    .count > i:nth-of-type(2) {
      display: none;
    }

    .count .pairing {
      display: grid;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .family-row > a,
    .lineage a {
      transition: none;
    }
  }
</style>
