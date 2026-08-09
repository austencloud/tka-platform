<script lang="ts">
  import boardUrl from "../../../../docs/superpowers/specs/earth-long-terrace/earth-long-terrace-gate1-board.svg?url";
  import {
    buildEarthLongTerracePlanForGrid,
    earthLongTerraceApparentBodyHeightDegrees,
    earthLongTerraceMaximumGrade,
    earthLongTerraceMinimumFloorMargin,
    earthLongTerraceRouteLength,
    earthLongTerraceViewingSamples,
  } from "$lib/features/museum/data/earth-long-terrace-plan";
  import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";

  const cave = buildVulcanCaveFloorPlan();
  const plan = buildEarthLongTerracePlanForGrid(cave.grid);
  if (!plan) throw new Error("Earth Long Terrace plan is unavailable");

  const viewingSamples = earthLongTerraceViewingSamples(plan);
  const finalSizes = plan.performers.map((performer) =>
    earthLongTerraceApparentBodyHeightDegrees(
      plan,
      plan.finalCamera.position,
      performer
    )
  );
</script>

<svelte:head>
  <title>Earth Long Terrace · Gate 1 review</title>
  <meta
    name="description"
    content="Measured Earth Long Terrace floor plan, sightline proof, and visitor experience review."
  />
</svelte:head>

<main class="review-page">
  <header class="review-header">
    <div>
      <p class="kicker">Earth · Gate 1 candidate · not approved</p>
      <h1>The Long Terrace</h1>
      <p class="lede">
        One synchronized row is the hero. A blind root turn erases Fire, cool
        daylight reveals G, H, and I together, and a forward terrace changes
        which performer is closest before the final three-body view.
      </p>
    </div>
    <a class="board-link" href={boardUrl} target="_blank" rel="noreferrer">
      Open the complete evidence board
    </a>
  </header>

  <section class="metrics" aria-label="Measured plan results">
    <article class="metric">
      <span>Forward route</span>
      <strong>{earthLongTerraceRouteLength(plan).toFixed(1)} m</strong>
      <p>
        2.4 m clear width · {(earthLongTerraceMaximumGrade(plan) * 100).toFixed(
          1
        )}% maximum grade · no retrace
      </p>
    </article>
    <article class="metric">
      <span>Full-ribbon proof</span>
      <strong>{(viewingSamples.length * 3).toLocaleString()} rays</strong>
      <p>
        {viewingSamples.length} legal eye positions sampled every 0.2 m along and
        across the route
      </p>
    </article>
    <article class="metric">
      <span>Worst floor margin</span>
      <strong>+{earthLongTerraceMinimumFloorMargin(plan).toFixed(2)} m</strong>
      <p>Every ray aims at a stage floor, not at a convenient torso target.</p>
    </article>
    <article class="metric">
      <span>Final body size</span>
      <strong>{Math.min(...finalSizes).toFixed(1)}° min</strong>
      <p>
        G, H, and I fit head-to-foot inside the real 75° vertical camera frame.
      </p>
    </article>
  </section>

  <figure class="artifact plan-artifact">
    <figcaption>
      <span>Top-down floor plan</span>
      <strong
        >Fire → blind turn → trio reveal → G → H → I → near ensemble → Air</strong
      >
    </figcaption>
    <svg
      viewBox="30 100 1335 930"
      role="img"
      aria-label="Measured Earth Long Terrace top-down floor plan"
      preserveAspectRatio="xMidYMid meet"
    >
      <image href={boardUrl} x="0" y="0" width="2200" height="1500" />
    </svg>
  </figure>

  <div class="proof-grid">
    <figure class="artifact">
      <figcaption>
        <span>Vertical section</span>
        <strong
          >The visitor stays above the row while the canyon falls to −25 m.</strong
        >
      </figcaption>
      <svg
        viewBox="1370 96 800 430"
        role="img"
        aria-label="Long Terrace vertical canyon section"
        preserveAspectRatio="xMidYMid meet"
      >
        <image href={boardUrl} x="0" y="0" width="2200" height="1500" />
      </svg>
    </figure>

    <figure class="artifact">
      <figcaption>
        <span>Eye-level proof</span>
        <strong
          >The reveal reads as one row; the near stand makes all three larger.</strong
        >
      </figcaption>
      <svg
        viewBox="1370 525 800 315"
        role="img"
        aria-label="Daylight reveal and near ensemble eye-level frames"
        preserveAspectRatio="xMidYMid meet"
      >
        <image href={boardUrl} x="0" y="0" width="2200" height="1500" />
      </svg>
    </figure>
  </div>

  <section class="motion-section">
    <div class="section-heading">
      <p class="kicker">Performance → environment</p>
      <h2>One hand path. Three prop relationships.</h2>
    </div>
    <div class="motion-grid">
      {#each plan.performers as performer}
        <article
          class:performer-g={performer.id === "g"}
          class:performer-h={performer.id === "h"}
          class:performer-i={performer.id === "i"}
        >
          <span>{performer.label}</span>
          <strong>{performer.literalMotion}</strong>
          <p>{performer.traceMeaning}</p>
        </article>
      {/each}
    </div>
    <p class="interaction-note">
      Proximity reveals and retains the wall traces. Nothing waits for a shared
      beat because these loops are continuous. At the near stand, the stored
      traces brighten once to acknowledge sustained attention.
    </p>
  </section>

  <section class="route-section">
    <div class="section-heading">
      <p class="kicker">Player experience</p>
      <h2>What happens, in order</h2>
    </div>
    <ol class="route-grid">
      {#each plan.stops as stop}
        <li>
          <span class="stop-number">{stop.number}</span>
          <div>
            <strong>{stop.title}</strong>
            <p>{stop.experience}</p>
            <small>{stop.roomResponse}</small>
          </div>
        </li>
      {/each}
    </ol>
  </section>

  <aside class="canon-note">
    <span>Decision needed</span>
    <p>
      The story bible says “sequential close encounters.” This candidate keeps
      all three performers visible and synchronized, while terrace position
      makes G, then H, then I the nearest read. Gate 1 cannot pass until that
      interpretation is accepted or rejected.
    </p>
  </aside>

  <footer>
    Blender is frozen. Gate 2 begins only after this floor plan passes, and it
    must use the finished live avatars on the three flat stage surfaces.
  </footer>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #08100c;
  }

  .review-page {
    --shell: min(112rem, 94vw);
    --panel: #111b15;
    --card: #17231b;
    --stroke: rgba(192, 221, 182, 0.17);
    --text: #f4f0e3;
    --muted: #aab7ab;
    --route: #a2d482;
    --warning: #e29472;
    container-type: inline-size;
    box-sizing: border-box;
    min-block-size: 100vh;
    padding: clamp(1rem, 2.5vw, 3rem);
    color: var(--text);
    background:
      radial-gradient(
        circle at 25% 0%,
        rgba(89, 135, 71, 0.21),
        transparent 30rem
      ),
      #08100c;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .review-page > * {
    inline-size: min(100%, var(--shell));
    margin-inline: auto;
  }

  .review-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1.5rem;
    margin-block-end: clamp(1rem, 2vw, 2rem);
  }

  .review-header > div {
    max-inline-size: 68rem;
  }

  .kicker,
  h1,
  h2,
  p,
  footer {
    margin: 0;
  }

  .kicker,
  .metric span,
  figcaption span,
  .canon-note span {
    color: var(--route);
    font-size: max(0.76rem, 12px);
    font-weight: 780;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h1,
  h2,
  .metric strong,
  figcaption strong {
    font-family: Georgia, "Times New Roman", serif;
    font-weight: 540;
  }

  h1 {
    margin-block: 0.2rem 0.5rem;
    font-size: clamp(2.2rem, 5cqw, 5.2rem);
    line-height: 0.96;
  }

  .lede {
    color: var(--muted);
    font-size: clamp(0.98rem, 1.3cqw, 1.3rem);
    line-height: 1.55;
  }

  .board-link {
    flex: 0 0 auto;
    min-block-size: 44px;
    padding: 0.85rem 1.1rem;
    border: 1px solid rgba(162, 212, 130, 0.5);
    border-radius: 999px;
    color: #edf6e4;
    background: rgba(58, 93, 49, 0.62);
    font-size: max(0.88rem, 14px);
    font-weight: 720;
    text-decoration: none;
  }

  .board-link:hover,
  .board-link:focus-visible {
    border-color: var(--route);
    background: rgba(77, 121, 62, 0.78);
    outline: none;
  }

  .metrics {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    margin-block-end: clamp(1rem, 2vw, 2rem);
  }

  .metric,
  .artifact,
  .motion-section,
  .route-section,
  .canon-note,
  footer {
    border: 1px solid var(--stroke);
    background: var(--card);
  }

  .metric {
    display: grid;
    gap: 0.35rem;
    min-block-size: 8.5rem;
    padding: clamp(0.9rem, 1.5cqw, 1.5rem);
    border-radius: 1rem;
  }

  .metric strong {
    align-self: end;
    font-size: clamp(1.55rem, 2.25cqw, 2.55rem);
  }

  .metric p,
  .motion-grid p,
  .interaction-note,
  .route-grid p,
  .route-grid small,
  .canon-note p,
  footer {
    color: var(--muted);
    font-size: max(0.88rem, 14px);
    line-height: 1.48;
  }

  .artifact {
    overflow: hidden;
    margin-block: 0 1rem;
    border-radius: 1.2rem;
  }

  .artifact figcaption {
    display: grid;
    gap: 0.25rem;
    padding: 0.9rem 1rem;
    border-block-end: 1px solid var(--stroke);
  }

  .artifact figcaption strong {
    font-size: clamp(1rem, 1.4cqw, 1.45rem);
  }

  .artifact svg {
    display: block;
    inline-size: 100%;
    block-size: auto;
    background: #0b1210;
  }

  .proof-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .motion-section,
  .route-section,
  .canon-note,
  footer {
    margin-block-start: 1rem;
    padding: clamp(1rem, 2cqw, 2rem);
    border-radius: 1.2rem;
  }

  .section-heading {
    margin-block-end: 1rem;
  }

  h2 {
    margin-block-start: 0.2rem;
    font-size: clamp(1.65rem, 3.2cqw, 3.2rem);
  }

  .motion-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .motion-grid article {
    display: grid;
    gap: 0.6rem;
    padding: 1rem;
    border-inline-start: 4px solid var(--route);
    border-radius: 0.8rem;
    background: rgba(8, 16, 12, 0.55);
  }

  .motion-grid article > span {
    font-size: 1.5rem;
    font-weight: 820;
  }

  .motion-grid article > strong {
    line-height: 1.4;
  }

  .performer-g {
    border-color: #9bd480 !important;
  }

  .performer-h {
    border-color: #e2bd70 !important;
  }

  .performer-i {
    border-color: #8bc5d9 !important;
  }

  .interaction-note {
    margin-block-start: 1rem;
    max-inline-size: 78rem;
  }

  .route-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.7rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .route-grid li {
    display: grid;
    grid-template-columns: 2.6rem 1fr;
    gap: 0.8rem;
    padding: 0.85rem;
    border-radius: 0.8rem;
    background: rgba(8, 16, 12, 0.55);
  }

  .stop-number {
    display: grid;
    inline-size: 2.4rem;
    block-size: 2.4rem;
    place-items: center;
    border-radius: 50%;
    color: #0b120d;
    background: var(--route);
    font-weight: 820;
  }

  .route-grid strong {
    display: block;
    margin-block-end: 0.25rem;
  }

  .route-grid small {
    display: block;
    margin-block-start: 0.35rem;
    color: var(--route);
  }

  .canon-note {
    border-color: rgba(226, 148, 114, 0.4);
    background: rgba(85, 48, 33, 0.34);
  }

  .canon-note span {
    color: var(--warning);
  }

  .canon-note p {
    margin-block-start: 0.45rem;
    max-inline-size: 92rem;
    color: #e9d8cc;
  }

  footer {
    margin-block-end: 2rem;
    text-align: center;
  }

  @container (min-width: 42rem) {
    .metrics,
    .motion-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    .route-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @container (min-width: 72rem) {
    .metrics {
      grid-template-columns: repeat(4, 1fr);
    }

    .proof-grid {
      grid-template-columns: 1fr 1fr;
    }

    .motion-grid {
      grid-template-columns: repeat(3, 1fr);
    }

    .route-grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @container (max-width: 48rem) {
    .review-header {
      align-items: stretch;
      flex-direction: column;
    }

    .board-link {
      align-self: flex-start;
    }
  }
</style>
