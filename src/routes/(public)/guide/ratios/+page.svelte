<script lang="ts">
  /**
   * /guide/ratios is a reference page, not a landing page. Every flower on it
   * is painted by the Shape Engine's own guide painter through
   * ShapeMatrixMandalaArt, and every number in the ladder table is derived from
   * the same domain functions the engine uses (ratioLabel, flowerPetals,
   * levelForTurnValue). Nothing here is a hand-written copy of engine data, so
   * the page cannot drift away from the app it documents.
   */
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import GuideShell from "../_components/GuideShell.svelte";
  import GuideSeo from "../level-1/_components/GuideSeo.svelte";
  import ShapeMatrixGrid from "$lib/shared/shape-matrix/components/ShapeMatrixGrid.svelte";
  import ShapeMatrixMandalaArt from "$lib/shared/shape-matrix/components/ShapeMatrixMandalaArt.svelte";
  import { headerArtworkSrc } from "$lib/shared/shape-matrix/services/shape-matrix-artwork";
  import {
    loadShapeMatrix,
    type ShapeMatrixData,
  } from "$lib/shared/shape-matrix/services/shape-matrix-flowers";
  import { applyFilter } from "$lib/shared/shape-matrix/domain/filter-flower-axis";
  import { matrixFiltersForSize } from "$lib/shared/shape-matrix/domain/matrix-size-preset";
  import {
    buildFloatAxis,
    flowerKey,
    flowerLabel,
    flowerPetals,
    ratioLabel,
    type Flower,
    type FlowerStyle,
    type RotatingFlower,
  } from "$lib/shared/shape-matrix/domain/flower-signature";
  import { matrixTurnsForLevel } from "$lib/shared/shape-matrix/domain/matrix-turn-band";
  import {
    levelForTurnValue,
    levelForTurns,
    turnValueToKey,
    type TurnValue,
  } from "$lib/shared/create/services/level-turn-values";
  import {
    KINETIC_SHAPE_ENGINE_AUTHOR,
    ORIGINAL_SHAPE_MATRIX_NAME,
    ORIGINAL_SHAPE_MATRIX_URL,
    SHAPE_ENGINE_SHORT_NAME,
    SPIN_SCIENCE_URL,
  } from "$lib/shared/shape-matrix/app/shape-engine-identity";

  /** The engine's own 144 band: three ratios, both styles, both starts, diamond. */
  const ORIGINAL_AXIS_FILTER = matrixFiltersForSize("large").left;
  const FAMILY_TURNS = [0, 1, 2] as const;

  function rotating(turns: number, style: FlowerStyle): RotatingFlower {
    return {
      style,
      turns,
      ori: "in",
      grid: "diamond",
      petals: flowerPetals({ style, turns }),
    };
  }

  const floatFlower = buildFloatAxis()[0]!;

  /** One row per turn value the Kinetic Alphabet can carry, Float included. */
  const ladder = matrixTurnsForLevel(4).map((turns: TurnValue) => ({
    turns,
    ratio: ratioLabel(turns),
    level: levelForTurnValue(turns),
    turnLabel: turns === "fl" ? "Float" : String(turns),
    pro: turns === "fl" ? null : rotating(turns as number, "pro"),
    anti: turns === "fl" ? null : rotating(turns as number, "anti"),
  }));

  const example = { pro: rotating(1, "pro"), anti: rotating(1, "anti") };

  function styleWord(style: FlowerStyle): string {
    return style === "pro" ? "Prospin" : "Antispin";
  }

  function petalWord(petals: number): string {
    if (petals === 0) return "no petals";
    return `${petals} petal${petals === 1 ? "" : "s"}`;
  }

  function bandHref(turns: number): string {
    const key = turnValueToKey(turns);
    return `/shape-engine?level=2&leftTurn=${key}&rightTurn=${key}&axis=both&labels=ratios&prop=staff`;
  }

  function pairHref(left: Flower, right: Flower): string {
    const params = new URLSearchParams({
      level: String(levelForTurns(left.turns, right.turns)),
      leftTurn: turnValueToKey(left.turns),
      rightTurn: turnValueToKey(right.turns),
      left: flowerKey(left),
      right: flowerKey(right),
      axis: "both",
      labels: "ratios",
      prop: "staff",
    });
    return `/shape-engine?${params}`;
  }

  let data = $state<ShapeMatrixData | null>(null);
  let loadError = $state("");

  const originalAxis = $derived(
    data ? applyFilter(data.axis, ORIGINAL_AXIS_FILTER, false) : []
  );

  const families = $derived(
    FAMILY_TURNS.map((turns) => ({
      turns,
      ratio: ratioLabel(turns),
      shapes: originalAxis.filter((flower) => flower.turns === turns),
    }))
  );

  /** Blue hand ink, the same painter the matrix rows use. */
  function paintFlower(flower: Flower) {
    return (sizePx: number) =>
      data ? headerArtworkSrc(data, flower, "left", sizePx) : "";
  }

  onMount(async () => {
    try {
      data = await loadShapeMatrix();
    } catch (error) {
      loadError = String(error);
    }
  });
</script>

<GuideSeo
  title="Spin ratios and Kinetic Alphabet turns · The Kinetic Alphabet Guide"
  description="Reference table for VTG spin ratios written hands to props, the Kinetic Alphabet turn value each one names, the petals it draws, and the 1:1, 1:3, and 1:5 families behind the 144 Shape Matrix."
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
  <article class="ratios guide-page-route">
    <header class="page-head">
      <h1>Spin ratios</h1>
      <p>
        A spin ratio counts one pattern twice: how many circles the hand
        travels, and how many rotations the prop makes over the same span. It is
        written hands first, so <strong>1:3</strong> is one hand circle to three prop
        rotations. The Kinetic Alphabet counts the same motion as turns, where one
        turn is 180 degrees of prop rotation on top of the base rotation the motion
        already carries.
      </p>
      <p>
        Lorq Nichols, who publishes as <a
          href={SPIN_SCIENCE_URL}
          target="_blank"
          rel="noopener noreferrer">Spin Science</a
        >, built the {ORIGINAL_SHAPE_MATRIX_NAME} from three of these ratios: 1:1,
        1:3, and 1:5. The {SHAPE_ENGINE_SHORT_NAME} generates the same pairings and
        carries the construction through the rest of the turn ladder.
      </p>
    </header>

    <section class="reading" aria-labelledby="reading-heading">
      <div class="reading-copy">
        <h2 id="reading-heading">Reading a ratio</h2>

        <dl class="terms">
          <div>
            <dt>Hand cycles, H</dt>
            <dd>Complete circles the hand travels.</dd>
          </div>
          <div>
            <dt>Prop rotations, P</dt>
            <dd>Complete rotations the prop makes over those circles.</dd>
          </div>
        </dl>

        <p>
          For a moving hand the two systems convert directly. Prop rotations per
          hand cycle are <code>P / H = 2 × turns + 1</code>, and the same
          relation read backwards is <code>turns = (P / H − 1) / 2</code>.
        </p>
        <p>
          The reduced ratio also fixes the petal count. A prospin flower draws
          <code>|P − H|</code> petals and an antispin flower draws
          <code>P + H</code>. Both counts follow one tracked prop end. A two
          ended prop such as a staff traces the mirrored figure as well, so the
          drawing shows twice as many petals as the count.
        </p>
        <p>
          Float sits outside the arithmetic. The prop makes no rotation of its
          own while the hand circles, which is the ratio 1:0, and the Kinetic
          Alphabet names it Float instead of a number.
        </p>
      </div>

      <figure class="worked">
        <figcaption>1:3, one turn</figcaption>
        <div class="worked-shapes">
          {#each [example.pro, example.anti] as flower (flowerKey(flower))}
            <div class="worked-shape">
              <span class="still still-lg">
                <ShapeMatrixMandalaArt
                  paint={paintFlower(flower)}
                  artKey={flowerKey(flower)}
                  alt={flowerLabel(flower)}
                />
              </span>
              <span class="shape-name">{styleWord(flower.style)}</span>
              <span class="shape-meta">{petalWord(flower.petals)}</span>
            </div>
          {/each}
        </div>
        <p class="worked-note">
          P is 3 and H is 1, so prospin draws 2 petals and antispin draws 4.
        </p>
      </figure>
    </section>

    <section class="ladder" aria-labelledby="ladder-heading">
      <div class="ladder-copy">
        <h2 id="ladder-heading">Ratios and turns</h2>
        <p>
          Every turn value the Kinetic Alphabet carries, the ratio that names
          it, and the two flowers one hand draws at that ratio.
        </p>
        <p>
          Level 1 uses 0 turns only. Level 2 adds whole turns. Level 3 adds half
          turns and Float. Level 4 adds quarter turns, including the negative
          quarter the engine shows at 2:1.
        </p>
        <p>
          Half and quarter turns reduce to ratios with two hand cycles. Those
          patterns need two circles of the hand before the prop returns to its
          starting angle.
        </p>
      </div>

      <div class="ladder-table-scroll">
        <table class="ladder-table">
          <thead>
            <tr>
              <th scope="col">Ratio</th>
              <th scope="col">Turns</th>
              <th scope="col">Level</th>
              <th scope="col" colspan="2">Prospin</th>
              <th scope="col" colspan="2">Antispin</th>
            </tr>
          </thead>
          <tbody>
            {#each ladder as row (row.turnLabel)}
              <tr
                class:family-row={row.turns === 0 ||
                  row.turns === 1 ||
                  row.turns === 2}
              >
                <th scope="row" class="ratio-cell">{row.ratio}</th>
                <td class="num">{row.turnLabel}</td>
                <td class="num level">{row.level}</td>
                {#if row.pro && row.anti}
                  <td class="art">
                    <span class="still">
                      <ShapeMatrixMandalaArt
                        paint={paintFlower(row.pro)}
                        artKey={flowerKey(row.pro)}
                        alt={flowerLabel(row.pro)}
                      />
                    </span>
                  </td>
                  <td class="num petals">{row.pro.petals}p</td>
                  <td class="art">
                    <span class="still">
                      <ShapeMatrixMandalaArt
                        paint={paintFlower(row.anti)}
                        artKey={flowerKey(row.anti)}
                        alt={flowerLabel(row.anti)}
                      />
                    </span>
                  </td>
                  <td class="num petals">{row.anti.petals}p</td>
                {:else}
                  <td class="art">
                    <span class="still">
                      <ShapeMatrixMandalaArt
                        paint={paintFlower(floatFlower)}
                        artKey={flowerKey(floatFlower)}
                        alt={flowerLabel(floatFlower)}
                      />
                    </span>
                  </td>
                  <td class="float-note" colspan="3">
                    Float has no spin direction. The prop holds one absolute
                    angle while the hand circles.
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="twelve" aria-labelledby="twelve-heading">
      <div class="twelve-copy">
        <h2 id="twelve-heading">The original twelve</h2>
        <p>
          Nichols took four even petaled driving styles from each family, which
          gives twelve shapes for one hand. The {SHAPE_ENGINE_SHORT_NAME} reaches
          the same twelve from its own axis: three ratios, prospin and antispin, and
          the two starting orientations named in and out. A start pointing in puts
          the prop toward the center of the hand path, a start pointing out puts it
          away, and that choice moves where the figure sits.
        </p>
        <p>
          The 1:1 prospin pair shows what the start does most plainly. Starting
          in holds the tracked end of the prop in one place, so it draws a
          point. Starting out carries that end around the whole hand circle.
        </p>
      </div>

      {#if loadError}
        <p class="load-status error">
          The flower engine failed to load: {loadError}
        </p>
      {:else}
        <div class="family-list">
          {#each families as family (family.turns)}
            <section class="family" aria-label={`${family.ratio} family`}>
              <header class="family-head">
                <span class="family-ratio">{family.ratio}</span>
                <span class="family-turns"
                  >{family.turns} turn{family.turns === 1 ? "" : "s"}</span
                >
                <a class="family-link" href={bandHref(family.turns)}>
                  Open the {family.ratio} band
                </a>
              </header>
              <ol class="family-shapes">
                {#each family.shapes as flower (flowerKey(flower))}
                  <li>
                    <span class="still still-md">
                      <ShapeMatrixMandalaArt
                        paint={paintFlower(flower)}
                        artKey={flowerKey(flower)}
                        alt={flowerLabel(flower)}
                      />
                    </span>
                    <span class="shape-name">{styleWord(flower.style)}</span>
                    <span class="shape-meta">
                      {petalWord(flower.petals)}, starts {flower.ori}
                    </span>
                  </li>
                {:else}
                  <li class="load-status">Building flowers</li>
                {/each}
              </ol>
            </section>
          {/each}
        </div>
      {/if}
    </section>

    <section class="pairings" aria-labelledby="pairings-heading">
      <div class="pairings-copy">
        <h2 id="pairings-heading">The 144 pairings</h2>
        <p>
          One left hand shape over one right hand shape makes a cell. Twelve
          shapes on each axis is 144 cells. The grid here is the engine's own
          matrix restricted to the three original ratios, drawn by the same
          painter the {SHAPE_ENGINE_SHORT_NAME} animates. Blue rows are the left hand
          and red columns are the right hand, so a cell shows both paths at once.
        </p>
        <p>Choosing a cell opens that pairing in the engine.</p>
      </div>

      <div class="matrix-stage">
        {#if loadError}
          <p class="load-status error">{loadError}</p>
        {:else if !data}
          <p class="load-status">Building flowers</p>
        {:else}
          <ShapeMatrixGrid
            {data}
            rowAxis={originalAxis}
            colAxis={originalAxis}
            maxCellPx={72}
            onselect={({ left, right }) => goto(pairHref(left, right))}
          />
        {/if}
      </div>
    </section>

    <section class="beyond" aria-labelledby="beyond-heading">
      <h2 id="beyond-heading">Past the original twelve</h2>
      <p>
        The engine keeps the row and column pairing and widens the axes. Levels
        3 and 4 add the half turn, quarter turn, and Float rows from the table
        above, and each axis picks its band on its own, so the two hands do not
        have to sit in the same family. The Theory Matrix sets the level system
        aside and pairs any two whole number ratios up to 15 on each side.
      </p>
    </section>

    <section class="sources" aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources</h2>
      <ul class="source-list">
        <li>
          <a
            href={ORIGINAL_SHAPE_MATRIX_URL}
            target="_blank"
            rel="noopener noreferrer"
            >Lorq Nichols, {ORIGINAL_SHAPE_MATRIX_NAME}, on Spin Science</a
          >
        </li>
        <li>
          <a href="/history#archive-record-vtg">The Vulcan Tech Gospel record</a
          >
        </li>
        <li>
          <a href="/history#archive-record-lorq">The Lorq Nichols record</a>
        </li>
        <li><a href="/shape-engine">{SHAPE_ENGINE_SHORT_NAME}</a></li>
      </ul>
      <p class="attribution">
        The {SHAPE_ENGINE_SHORT_NAME} was built independently by {KINETIC_SHAPE_ENGINE_AUTHOR}.
        It does not reproduce Nichols' original diagram and is not an official
        Spin Science release.
      </p>
    </section>
  </article>
</GuideShell>

<style>
  .ratios {
    --rule: var(--theme-stroke, oklch(0.4 0.04 270 / 0.22));
    --ink: var(--theme-text, oklch(0.94 0.01 270));
    --ink-dim: var(--theme-text-dim, oklch(0.72 0.01 270));
    --ink-faint: oklch(0.58 0.02 270);
    --surface: var(--theme-card-bg, oklch(0.17 0.018 270 / 0.5));
    display: grid;
    gap: clamp(2.75rem, 5vw, 4.5rem);
    padding: clamp(1.5rem, 3vw, 3rem) clamp(1rem, 3vw, 3rem)
      clamp(4rem, 7vw, 7rem);
  }

  .ratios h1 {
    grid-column: auto;
    margin: 0 0 1rem;
    padding: 0;
    font-family: "Inter", system-ui, sans-serif;
    font-size: clamp(2.1rem, 1.6rem + 1.6vw, 3.2rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.05;
    text-align: left;
  }

  .ratios h2 {
    margin: 0 0 0.85rem;
  }

  .ratios p {
    max-inline-size: var(--measure-prose, 72ch);
  }

  .ratios code {
    padding: 0.1em 0.35em;
    border-radius: 5px;
    background: var(--surface);
    color: var(--ink);
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 0.92em;
    white-space: nowrap;
  }

  .ratios a {
    color: var(--theme-accent, oklch(0.74 0.11 265));
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .ratios a:focus-visible {
    outline: 2px solid var(--theme-accent, oklch(0.74 0.11 265));
    outline-offset: 3px;
    border-radius: 3px;
  }

  .page-head p:last-child {
    margin-bottom: 0;
  }

  /* Two column sections: prose keeps a reading measure, the visual takes the
     rest of the band, so a wide screen gains content instead of stretch. */
  .reading,
  .ladder,
  .twelve,
  .pairings {
    display: grid;
    gap: clamp(1.5rem, 3vw, 3rem);
    padding-top: clamp(1.75rem, 3vw, 2.75rem);
    border-top: 1px solid var(--rule);
  }

  @media (min-width: 62rem) {
    .reading {
      grid-template-columns: minmax(0, 1fr) minmax(20rem, 0.72fr);
      align-items: start;
    }

    /* The ladder is seven columns wide and carries the page's densest
       information, so it takes the larger share of the band. */
    .ladder {
      grid-template-columns: minmax(17rem, 0.5fr) minmax(0, 1fr);
      align-items: start;
    }

    /* The matrix is square, so it gets a square stage instead of a wide box
       with dead space either side of the grid. */
    .pairings {
      grid-template-columns: minmax(17rem, 0.5fr) minmax(0, 1fr);
      align-items: start;
    }

    .pairings .matrix-stage {
      height: auto;
      aspect-ratio: 1;
      max-block-size: min(78vh, 44rem);
    }
  }

  .terms {
    display: grid;
    gap: 0.4rem;
    margin: 0 0 1.25rem;
  }

  .terms > div {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: baseline;
  }

  .terms dt {
    color: var(--ink);
    font-weight: 640;
  }

  .terms dd {
    margin: 0;
    color: var(--ink-dim);
  }

  .worked {
    margin: 0;
    padding: 1.25rem;
    border: 1px solid var(--rule);
    border-radius: 14px;
    background: var(--surface);
  }

  .worked figcaption {
    margin-bottom: 1rem;
    color: var(--ink);
    font-size: 1.05rem;
    font-variant-numeric: tabular-nums;
    font-weight: 640;
  }

  .worked-shapes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 1rem;
  }

  .worked-shape {
    display: grid;
    justify-items: center;
    gap: 0.3rem;
  }

  .worked-note {
    margin: 1rem 0 0;
    color: var(--ink-faint);
    font-size: var(--font-size-min, 0.875rem);
  }

  /* Reserved square for every still: the engine loads async and the box never
     changes size, so nothing moves when the artwork arrives. */
  .still {
    display: block;
    inline-size: 3rem;
    aspect-ratio: 1;
  }

  .still-md {
    inline-size: clamp(4rem, 9vw, 5.5rem);
  }

  .still-lg {
    inline-size: clamp(5rem, 12vw, 7rem);
  }

  .shape-name {
    color: var(--ink);
    font-size: var(--font-size-min, 0.875rem);
    font-weight: 620;
  }

  .shape-meta {
    color: var(--ink-faint);
    font-size: var(--font-size-compact, 0.78rem);
    text-align: center;
  }

  .ladder-table-scroll {
    overflow-x: auto;
    border: 1px solid var(--rule);
    border-radius: 14px;
    background: var(--surface);
  }

  .ladder-table {
    width: 100%;
    border-collapse: collapse;
    font-variant-numeric: tabular-nums;
  }

  .ladder-table th,
  .ladder-table td {
    padding: 0.35rem 0.7rem;
    border-bottom: 1px solid var(--rule);
    text-align: left;
    vertical-align: middle;
  }

  .ladder-table thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--theme-panel-bg, oklch(0.15 0.018 270));
    color: var(--ink-faint);
    font-size: var(--font-size-compact, 0.78rem);
    font-weight: 640;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .ladder-table tbody tr:last-child th,
  .ladder-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .ladder-table tbody tr.family-row {
    background: color-mix(
      in srgb,
      var(--theme-accent, oklch(0.74 0.11 265)) 9%,
      transparent
    );
  }

  .ratio-cell {
    color: var(--ink);
    font-size: 1.05rem;
    font-weight: 660;
    white-space: nowrap;
  }

  .ladder-table .num {
    color: var(--ink-dim);
    white-space: nowrap;
  }

  .ladder-table .level::before {
    content: "L";
    color: var(--ink-faint);
  }

  .ladder-table .petals {
    color: var(--ink);
    font-weight: 600;
  }

  .ladder-table .art {
    width: 3rem;
    padding-block: 0.2rem;
  }

  .ladder-table .float-note {
    color: var(--ink-faint);
    font-size: var(--font-size-min, 0.875rem);
    white-space: normal;
  }

  /* At phone widths the seven columns fit by tightening the cells rather than
     leaving the antispin half of the ladder behind a horizontal scroll. */
  @media (max-width: 30rem) {
    .ladder-table th,
    .ladder-table td {
      padding: 0.3rem 0.3rem;
    }

    .ladder-table .art,
    .ladder-table .art .still {
      inline-size: 2.25rem;
      width: 2.25rem;
    }

    .ratio-cell {
      font-size: 0.95rem;
    }
  }

  .family-list {
    display: grid;
    gap: clamp(1rem, 2vw, 1.75rem);
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 21rem), 1fr));
  }

  .family {
    padding: 1.1rem 1.25rem 1.35rem;
    border: 1px solid var(--rule);
    border-radius: 14px;
    background: var(--surface);
  }

  .family-head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5rem 0.9rem;
    padding-bottom: 0.9rem;
    margin-bottom: 1rem;
    border-bottom: 1px solid var(--rule);
  }

  .family-ratio {
    color: var(--ink);
    font-size: 1.5rem;
    font-variant-numeric: tabular-nums;
    font-weight: 680;
    letter-spacing: -0.02em;
  }

  .family-turns {
    color: var(--ink-dim);
    font-size: var(--font-size-min, 0.875rem);
  }

  .family-link {
    margin-left: auto;
    font-size: var(--font-size-min, 0.875rem);
  }

  /* Four shapes per family, so the track count stays even and no row is
     ever left holding a single orphan. */
  .family-shapes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .family-shapes li {
    display: grid;
    justify-items: center;
    gap: 0.25rem;
    margin: 0;
  }

  /* ShapeMatrixGrid is container sized, so its stage owns an explicit box.
     Below the 44px touch floor the grid scrolls inside this stage rather than
     shrinking its own cells. */
  .matrix-stage {
    height: min(78vh, 44rem);
    border: 1px solid var(--rule);
    border-radius: 14px;
    overflow: hidden;
  }

  .load-status {
    display: grid;
    place-items: center;
    height: 100%;
    margin: 0;
    color: var(--ink-faint);
  }

  .load-status.error {
    color: var(--semantic-error, oklch(0.7 0.16 25));
  }

  .beyond,
  .sources {
    padding-top: clamp(1.75rem, 3vw, 2.75rem);
    border-top: 1px solid var(--rule);
  }

  .source-list {
    display: grid;
    gap: 0.55rem;
    margin: 0 0 1.5rem;
    padding: 0;
    list-style: none;
  }

  .source-list li {
    margin: 0;
  }

  .source-list a {
    display: inline-flex;
    align-items: center;
    min-height: var(--min-touch-target, 44px);
  }

  .attribution {
    color: var(--ink-faint);
    font-size: var(--font-size-min, 0.875rem);
  }
</style>
