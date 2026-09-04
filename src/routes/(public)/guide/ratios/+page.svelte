<script lang="ts">
  import GuideShell from "../_components/GuideShell.svelte";
  import GuideSeo from "../level-1/_components/GuideSeo.svelte";
  import {
    flowerPetals,
    ratioLabel,
  } from "$lib/shared/shape-matrix/domain/flower-signature";
  import { matrixTurnsForLevel } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import { levelForTurnValue } from "$lib/shared/create/services/level-turn-values";

  const sourceFamilies = [
    {
      sourceRatio: "1:1",
      turn: 0,
      styles: [
        "Extension",
        "Isolation",
        "2-petal vertical antispin",
        "2-petal horizontal antispin",
      ],
    },
    {
      sourceRatio: "1:3",
      turn: 1,
      styles: [
        "2-petal horizontal prospin",
        "2-petal vertical prospin",
        "4-petal diamond antispin",
        "4-petal box antispin",
      ],
    },
    {
      sourceRatio: "1:5",
      turn: 2,
      styles: [
        "4-petal box prospin",
        "4-petal diamond prospin",
        "6-petal vertical antispin",
        "6-petal horizontal antispin",
      ],
    },
  ].map((family) => ({
    ...family,
    engineRatio: ratioLabel(family.turn),
    engineHref: `/notation/shape-matrix?level=${levelForTurnValue(family.turn)}&leftTurn=${family.turn}&rightTurn=${family.turn}&axis=both&labels=ratios&prop=staff`,
  }));

  const turnRows = matrixTurnsForLevel(4).map((turn) => ({
    turn,
    turnLabel: turn === "fl" ? "Float" : String(turn),
    ratio: ratioLabel(turn),
    level: levelForTurnValue(turn),
    proPetals:
      turn === "fl" ? "—" : String(flowerPetals({ style: "pro", turns: turn })),
    antiPetals:
      turn === "fl"
        ? "—"
        : String(flowerPetals({ style: "anti", turns: turn })),
  }));
</script>

<GuideSeo
  title="Spin Ratios and TKA Turns · The Kinetic Alphabet Guide"
  description="Translate Lorq Nichols’ Shape Matrix ratios into Shape Engine prop-to-hand ratios, TKA turn values, and prospin or antispin petal counts."
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
        <span class="kicker">Translation reference</span>
        <h1>Spin ratios and TKA turns</h1>
        <p>
          Lorq Nichols’ Shape Matrix and Kinetic Shape Engine describe the same
          flower families from opposite sides of the colon. Here is the exact
          translation, followed by every ratio named by TKA Levels 1–4.
        </p>
      </div>
      <div class="ratio-key" aria-label="Shape Engine ratio reading order">
        <span>Shape Engine reads</span>
        <strong>prop rotations : hand cycles</strong>
        <a
          href="/notation/shape-matrix?level=2&leftTurn=1&rightTurn=1&axis=both&labels=ratios&prop=staff"
        >
          Open Shape Engine in ratio mode
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </a>
      </div>
    </header>

    <section class="translation" aria-labelledby="translation-heading">
      <div class="section-heading">
        <span>01</span>
        <div>
          <h2 id="translation-heading">One family, two reading orders</h2>
          <p>
            Lorq’s publication labels the families 1:1, 1:3, and 1:5. Shape
            Engine always puts prop rotation first, so the last two ratios flip.
          </p>
        </div>
      </div>

      <div
        class="translation-line"
        aria-label="Lorq labels translated into Shape Engine labels"
      >
        <div>
          <span>Lorq’s labels</span>
          <strong>1:1 · 1:3 · 1:5</strong>
        </div>
        <i class="fa-solid fa-arrow-right-long" aria-hidden="true"></i>
        <div>
          <span>Shape Engine</span>
          <strong>1:1 · 3:1 · 5:1</strong>
        </div>
      </div>
    </section>

    <section aria-labelledby="families-heading">
      <div class="section-heading">
        <span>02</span>
        <div>
          <h2 id="families-heading">Lorq’s twelve driving styles</h2>
          <p>
            Each source ratio contributes four choices. Twelve left-hand columns
            crossed with twelve right-hand rows make the original 144.
          </p>
        </div>
      </div>

      <div class="family-grid">
        {#each sourceFamilies as family}
          <article class="family-card">
            <div class="family-ratio">
              <span>Lorq {family.sourceRatio}</span>
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
              <strong>{family.engineRatio}</strong>
            </div>
            <p>TKA: {family.turn} {family.turn === 1 ? "turn" : "turns"}</p>
            <ul>
              {#each family.styles as style}
                <li>{style}</li>
              {/each}
            </ul>
            <a href={family.engineHref}>
              See {family.engineRatio} in Shape Engine
              <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </a>
          </article>
        {/each}
      </div>
    </section>

    <section aria-labelledby="ladder-heading">
      <div class="section-heading">
        <span>03</span>
        <div>
          <h2 id="ladder-heading">The complete Level 1–4 turn ladder</h2>
          <p>
            These rows come from the same turn palette and ratio functions used
            by Shape Engine. Prospin subtracts the reduced ratio parts; antispin
            adds them.
          </p>
        </div>
      </div>

      <div class="turn-table-wrap themed-scrollbar">
        <table>
          <caption class="sr-only">TKA turn to spin ratio table</caption>
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">TKA turn</th>
              <th scope="col">Prop : hand</th>
              <th scope="col">Petals · pro / anti</th>
            </tr>
          </thead>
          <tbody>
            {#each turnRows as row}
              <tr>
                <td data-label="Level">Level {row.level}</td>
                <th scope="row" data-label="TKA turn">{row.turnLabel}</th>
                <td class="ratio-cell" data-label="Prop : hand">{row.ratio}</td>
                <td class="petal-cell" data-label="Petals · pro / anti">
                  <span>{row.proPetals}</span>
                  <span aria-hidden="true">/</span>
                  <span>{row.antiPetals}</span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="formula-section" aria-labelledby="formula-heading">
      <div class="section-heading">
        <span>04</span>
        <div>
          <h2 id="formula-heading">Translate in either direction</h2>
          <p>
            A TKA turn counts added prop rotation beyond the base movement. The
            reduced ratio may have more than one hand cycle.
          </p>
        </div>
      </div>

      <div class="formula-grid">
        <div>
          <span>TKA turn → ratio</span>
          <strong>(2 × turns + 1) : 1</strong>
          <p>One turn becomes 3:1. Two turns become 5:1.</p>
        </div>
        <div>
          <span>Ratio → TKA turn</span>
          <strong>(prop ÷ hand − 1) ÷ 2</strong>
          <p>3:2 becomes 0.25 turns. 7:3 becomes ⅔, outside Levels 1–4.</p>
        </div>
        <div>
          <span>Two named exceptions</span>
          <strong>Float = 0:1 · −0.25 = 1:2</strong>
          <p>Float has no prospin or antispin petal count.</p>
        </div>
      </div>
    </section>

    <section class="source-section" aria-labelledby="sources-heading">
      <div>
        <span class="kicker">Follow the lineage</span>
        <h2 id="sources-heading">History and source material</h2>
        <p>
          The archive separates VTG’s shared movement language from Lorq’s later
          printed matrices. The original publication shows all twelve source
          styles and the 144 pairings.
        </p>
      </div>
      <nav aria-label="Ratio history and sources">
        <a href="/history#archive-record-vtg">VTG history record</a>
        <a href="/history#archive-record-lorq">Lorq Nichols history record</a>
        <a
          href="http://spinscience.xyz/2014/07/10/144-shape-matrix-even-petaled-flowers-rework/"
          target="_blank"
          rel="noopener noreferrer"
        >
          Original 144 Shape Matrix
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
    --ratio-card: var(--theme-card-bg, rgb(255 255 255 / 0.035));
    width: min(100%, var(--shell-w, 108rem));
    margin-inline: auto;
    padding: clamp(3rem, 6vw, 6rem) clamp(1rem, 4vw, 4.5rem) 7rem;
    color: var(--ratio-text);
    font-family: Inter, system-ui, sans-serif;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(18rem, 0.7fr);
    gap: clamp(2rem, 7vw, 7rem);
    align-items: end;
  }

  .hero-copy {
    max-width: 62rem;
  }

  .kicker,
  .section-heading > span,
  .formula-grid span,
  .ratio-key > span,
  .translation-line span {
    color: color-mix(in srgb, var(--ratio-accent) 80%, white);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  .hero h1 {
    max-width: 14ch;
    padding: 0;
    font-size: clamp(2.8rem, 5vw, 5.7rem);
    font-weight: 780;
    line-height: 0.96;
    letter-spacing: -0.055em;
    text-align: left;
    text-wrap: balance;
  }

  .hero-copy > p {
    max-inline-size: var(--measure-lede, 54ch);
    margin-top: 1.4rem;
    color: var(--ratio-dim);
    font-size: clamp(1rem, 1.3vw, 1.18rem);
    line-height: 1.65;
  }

  .ratio-key {
    display: grid;
    gap: 0.75rem;
    padding: 1.3rem;
    border: 1px solid var(--ratio-stroke);
    border-radius: 16px;
    background: var(--ratio-card);
  }

  .ratio-key strong {
    font-size: clamp(1.25rem, 2vw, 1.7rem);
    letter-spacing: -0.025em;
  }

  .ratio-key a,
  .family-card > a,
  .source-section a {
    display: inline-flex;
    min-height: 2.75rem;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    padding: 0.55rem 0.8rem;
    border: 1px solid color-mix(in srgb, var(--ratio-accent) 44%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--ratio-accent) 8%, transparent);
    color: var(--ratio-text);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 720;
    text-align: center;
    text-decoration: none;
  }

  section {
    margin-top: clamp(4.5rem, 8vw, 8rem);
  }

  .section-heading {
    display: grid;
    grid-template-columns: 3rem minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }

  .section-heading > span {
    padding-top: 0.4rem;
  }

  .section-heading h2,
  .source-section h2 {
    font-size: clamp(1.65rem, 3vw, 2.7rem);
    line-height: 1.08;
    letter-spacing: -0.04em;
  }

  .section-heading p,
  .source-section p {
    max-inline-size: var(--measure-prose, 68ch);
    margin-top: 0.65rem;
    color: var(--ratio-dim);
    line-height: 1.65;
  }

  .translation-line {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: clamp(1rem, 4vw, 3rem);
    align-items: center;
    margin-top: 2rem;
    padding: clamp(1.25rem, 3vw, 2rem);
    border: 1px solid var(--ratio-stroke);
    border-radius: 18px;
    background: var(--ratio-card);
  }

  .translation-line > div {
    display: grid;
    gap: 0.45rem;
  }

  .translation-line > div:last-child {
    text-align: right;
  }

  .translation-line strong {
    font-size: clamp(1.4rem, 3vw, 2.6rem);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.035em;
  }

  .translation-line > i {
    color: var(--ratio-accent);
    font-size: 1.5rem;
  }

  .family-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 2rem;
  }

  .family-card {
    display: grid;
    grid-template-rows: auto auto 1fr auto;
    gap: 0.9rem;
    padding: clamp(1.2rem, 2vw, 1.6rem);
    border: 1px solid var(--ratio-stroke);
    border-radius: 16px;
    background: var(--ratio-card);
  }

  .family-ratio {
    display: flex;
    align-items: center;
    gap: 0.65rem;
  }

  .family-ratio span {
    color: var(--ratio-dim);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 680;
  }

  .family-ratio i {
    color: var(--ratio-accent);
  }

  .family-ratio strong {
    font-size: 1.45rem;
    font-variant-numeric: tabular-nums;
  }

  .family-card > p,
  .family-card li {
    color: var(--ratio-dim);
    line-height: 1.5;
  }

  .family-card > p {
    font-size: var(--font-size-min, 0.875rem);
  }

  .family-card ul {
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding-left: 1.2rem;
  }

  .turn-table-wrap {
    min-width: 0;
    max-width: 100%;
    margin-top: 2rem;
    overflow-x: auto;
    border: 1px solid var(--ratio-stroke);
    border-radius: 16px;
    background: var(--ratio-card);
  }

  table {
    width: 100%;
    min-width: 34rem;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  th,
  td {
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--ratio-stroke);
    text-align: left;
  }

  thead th {
    color: var(--ratio-dim);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 750;
    letter-spacing: 0.07em;
    text-transform: uppercase;
  }

  tbody th,
  .ratio-cell {
    color: var(--ratio-text);
    font-weight: 750;
  }

  tbody tr:last-child > * {
    border-bottom: 0;
  }

  .petal-cell {
    display: flex;
    gap: 0.45rem;
    align-items: center;
  }

  .petal-cell span:nth-child(2) {
    color: var(--ratio-dim);
  }

  .formula-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
    margin-top: 2rem;
  }

  .formula-grid > div {
    display: grid;
    gap: 0.7rem;
    padding: clamp(1.2rem, 2vw, 1.6rem);
    border: 1px solid var(--ratio-stroke);
    border-radius: 16px;
  }

  .formula-grid strong {
    font-size: clamp(1.15rem, 2vw, 1.55rem);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.025em;
  }

  .formula-grid p {
    color: var(--ratio-dim);
    line-height: 1.55;
  }

  .source-section {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.8fr);
    gap: clamp(2rem, 7vw, 7rem);
    align-items: end;
    padding-top: clamp(2rem, 5vw, 4rem);
    border-top: 1px solid var(--ratio-stroke);
  }

  .source-section nav {
    display: grid;
    gap: 0.7rem;
  }

  .ratio-key a:hover,
  .family-card > a:hover,
  .source-section a:hover {
    border-color: color-mix(in srgb, var(--ratio-accent) 76%, transparent);
    background: color-mix(in srgb, var(--ratio-accent) 15%, transparent);
  }

  a:focus-visible {
    outline: 3px solid color-mix(in srgb, var(--ratio-accent) 72%, white);
    outline-offset: 3px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 72rem) {
    .hero,
    .source-section {
      grid-template-columns: 1fr;
      align-items: start;
    }

    .ratio-key,
    .source-section nav {
      max-width: 42rem;
    }
  }

  @media (max-width: 58rem) {
    .family-grid,
    .formula-grid {
      grid-template-columns: 1fr;
    }

    .family-card {
      grid-template-columns: minmax(11rem, 0.75fr) minmax(0, 1fr);
      grid-template-rows: auto auto auto;
    }

    .family-card ul {
      grid-column: 2;
      grid-row: 1 / span 2;
    }

    .family-card > a {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 48rem) {
    .ratio-guide {
      padding-top: 6.5rem;
    }

    .translation-line {
      grid-template-columns: 1fr;
    }

    .translation-line > i {
      rotate: 90deg;
      justify-self: center;
    }

    .translation-line > div:last-child {
      text-align: left;
    }

    .family-card {
      grid-template-columns: 1fr;
      grid-template-rows: auto;
    }

    .family-card ul,
    .family-card > a {
      grid-column: auto;
      grid-row: auto;
    }

    table {
      min-width: 0;
      table-layout: fixed;
    }

    thead th:nth-child(1) {
      width: 22%;
    }

    thead th:nth-child(2) {
      width: 22%;
    }

    thead th:nth-child(3) {
      width: 24%;
    }

    thead th:nth-child(4) {
      width: 32%;
    }

    th,
    td {
      padding: 0.7rem 0.45rem;
    }

    thead th {
      font-size: 0.64rem;
      letter-spacing: 0.025em;
    }

    .petal-cell {
      gap: 0.3rem;
    }

    .section-heading {
      grid-template-columns: 2rem minmax(0, 1fr);
      gap: 0.65rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ratio-key a,
    .family-card > a,
    .source-section a {
      transition: none;
    }
  }
</style>
