<script lang="ts">
  import { goto } from "$app/navigation";
  import MuseumFloorPlanPreview from "$lib/features/museum/components/editor/MuseumFloorPlanPreview.svelte";
  import "$lib/features/museum/components/museum-theme.css";
  import { buildVulcanCaveFloorPlan } from "$lib/features/museum/data/vulcan-cave-floor-plan";
  import type { MuseumFloorPlanLayer } from "$lib/features/museum/domain/museum-floor-plan-types";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";

  const plan = buildVulcanCaveFloorPlan();
  const programZones = plan.zones.toSorted((a, b) => a.number - b.number);
  const planRatio = plan.grid.width / plan.grid.height;
  const planWidthMetres = plan.grid.width * plan.grid.tileScale;
  const planHeightMetres = plan.grid.height * plan.grid.tileScale;
  const minimumCorridorTiles = Math.min(
    ...plan.edges.map((edge) => edge.corridorWidth ?? 4)
  );
  const minimumCorridorMetres = minimumCorridorTiles * plan.grid.tileScale;
  const performerCount = plan.grid.performers.length;
  const performersAreSolo = plan.modeRooms.every((mode) => {
    const room = plan.grid.wings.find((wing) => wing.id === mode.roomId);
    if (!room) return false;
    return (
      plan.grid.performers.filter(
        (performer) =>
          performer.tileX > room.bounds.x &&
          performer.tileX < room.bounds.x + room.bounds.width - 1 &&
          performer.tileY > room.bounds.y &&
          performer.tileY < room.bounds.y + room.bounds.height - 1
      ).length === 1
    );
  });

  const layerOptions: {
    value: MuseumFloorPlanLayer;
    label: string;
    shortLabel: string;
  }[] = [
    { value: "program", label: "Program overlay", shortLabel: "Program" },
    { value: "tiles", label: "Built tile grid", shortLabel: "Tiles" },
  ];

  let layer = $state<MuseumFloorPlanLayer>("program");
</script>

<svelte:head>
  <title>Vulcan Cave Floor Plan | The Kinetic Archive</title>
  <meta
    name="description"
    content="The six-performer Vulcan Cave floor plan for The Kinetic Archive web prototype."
  />
</svelte:head>

<main class="cave-plan-page museum-gold-scope">
  <header class="hero">
    <div class="hero-copy">
      <div class="eyebrow-row">
        <span class="eyebrow">The Kinetic Archive</span>
        <span class="proposal-badge">Vulcan Cave plan 01</span>
      </div>
      <h1>Six performers. Six chambers. Never an ensemble.</h1>
      <p>
        The cave is one deliberate route, not a hub. Each turn removes the last
        performer before revealing the next, then the path seals at a warm
        sandstone threshold to Egypt.
      </p>
    </div>

    <dl class="metrics" aria-label="Cave floor plan measurements">
      <div>
        <dt>Solo figures</dt>
        <dd>{performerCount}</dd>
      </div>
      <div>
        <dt>Spaces</dt>
        <dd>{plan.grid.wings.length}</dd>
      </div>
      <div>
        <dt>Plan field</dt>
        <dd>{planWidthMetres} × {planHeightMetres} m</dd>
      </div>
      <div>
        <dt>Min. passage</dt>
        <dd>{minimumCorridorMetres} m</dd>
      </div>
    </dl>
  </header>

  <section class="workspace" aria-labelledby="plan-heading">
    <div class="plan-column">
      <div class="plan-toolbar panel-glass">
        <div>
          <span class="section-kicker">Compiled room graph</span>
          <h2 id="plan-heading">Lobby threshold to the Egypt seal</h2>
        </div>

        <div class="toolbar-actions">
          <div class="layer-switcher">
            <SegmentedControl
              options={layerOptions}
              value={layer}
              onchange={(value) => (layer = value)}
              color="accent"
              size="sm"
              ariaLabel="Cave floor plan layer"
            />
          </div>
          <PanelButton
            variant="primary"
            onclick={() => goto("/test/museum-cave-3d")}
            ariaLabel="Walk the Vulcan Cave in 3D"
          >
            <i class="fas fa-person-walking" aria-hidden="true"></i>
            <span>Walk in 3D</span>
          </PanelButton>
          <PanelButton
            variant="secondary"
            onclick={() => goto("/test/museum-lobby-plan")}
            ariaLabel="Return to the entrance lobby floor plan"
          >
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
            <span>Lobby plan</span>
          </PanelButton>
        </div>
      </div>

      <div class="plan-stage panel-glass">
        <div class="plan-board" style={`--plan-ratio: ${planRatio}`}>
          <MuseumFloorPlanPreview
            grid={plan.grid}
            zones={plan.zones}
            circulation={plan.circulation}
            {layer}
            ariaLabel="Vulcan Cave floor plan with nine sequential spaces and six solo performer chambers"
            caption="One square is half a metre. Numbered rooms follow the only visitor route from the lobby threshold to the sealed Egypt transition. Green figure markers show the six solo automata."
          />
        </div>
      </div>
    </div>

    <aside class="mode-ledger panel-glass" aria-labelledby="mode-heading">
      <div class="section-heading">
        <span class="section-kicker">Performer ledger</span>
        <h2 id="mode-heading">One body for each mode</h2>
        <p>
          These labels are for development. Visitors get geology, light,
          acoustics, and motion instead of category names on the walls.
        </p>
      </div>

      <ol class="mode-list">
        {#each plan.modeRooms as mode, index (mode.roomId)}
          <li class={`mode-card mode-${mode.label.toLowerCase()}`}>
            <span class="mode-index">{String(index + 1).padStart(2, "0")}</span>
            <div class="mode-copy">
              <div class="mode-title-row">
                <h3>{mode.label}</h3>
                <span class="mode-category">{mode.category}</span>
              </div>
              <p>{mode.technicalMode}</p>
            </div>
            <i class="fa-solid fa-person" aria-hidden="true"></i>
          </li>
        {/each}
      </ol>

      <div class="solo-rule">
        <span class="section-kicker">The rule</span>
        <p>
          Solo describes the staging, not the headcount. Six figures can live in
          the wing because the route never frames two as a group.
        </p>
      </div>
    </aside>
  </section>

  <section
    class="program-section panel-glass"
    aria-labelledby="program-heading"
  >
    <div class="section-heading program-heading">
      <div>
        <span class="section-kicker">Spatial sequence</span>
        <h2 id="program-heading">Nine beats, in order</h2>
      </div>
      <p>
        The room compiler sets the final dimensions. The plan uses scale,
        compression, and bent door axes to do the storytelling before the cave
        receives finished rockwork.
      </p>
    </div>

    <ol class="program-grid">
      {#each programZones as zone (zone.id)}
        <li>
          <div class="program-topline">
            <span class="program-number">{zone.number}</span>
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </div>
          <h3>{zone.title}</h3>
          <p>{zone.description}</p>
        </li>
      {/each}
    </ol>
  </section>

  <section
    class="reasoning-grid"
    aria-label="Floor plan reasoning and validation"
  >
    <article class="decision-card panel-glass">
      <span class="section-kicker">Why this shape</span>
      <h2>The cave teaches through distance.</h2>
      <p>
        The squeeze erases the lobby. Water and Fire establish the encounter.
        Earth supplies the major expansion. Air releases upward. Sun and Moon
        become the deepest pair without sharing a stage.
      </p>
    </article>

    <article class="counterargument panel-glass">
      <span class="section-kicker">Design pressure</span>
      <h2>Six rooms can become six copies.</h2>
      <p>
        The architecture has to carry the difference. Room scale, ceiling
        profile, light behavior, acoustic decay, floor texture, and approach
        angle must change. Literal elemental costumes would flatten the idea.
      </p>
    </article>

    <article class="validation-card panel-glass">
      <div class="validation-heading">
        <div>
          <span class="section-kicker">Build checks</span>
          <h2>Production grid validation</h2>
        </div>
        <span class:valid={plan.validation.valid} class="validation-state">
          {plan.validation.valid ? "Pass" : "Review"}
        </span>
      </div>

      <ul>
        <li class:pass={plan.validation.spawnOnWalkable}>
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          Visitor starts on walkable stone
        </li>
        <li class:pass={plan.validation.unreachableRooms.length === 0}>
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          All nine spaces connect
        </li>
        <li class:pass={plan.validation.overlaps.length === 0}>
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          No room overlap
        </li>
        <li class:pass={performersAreSolo && performerCount === 6}>
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          Six chambers hold one performer each
        </li>
        <li class:pass={minimumCorridorTiles >= 3}>
          <i class="fa-solid fa-check" aria-hidden="true"></i>
          Every passage is at least three tiles wide
        </li>
      </ul>

      <p class="source-note">
        Built from the museum's <code>RoomNode</code>, corridor router, tile
        stamper, and flood-fill validator. Interior room area totals
        {plan.totalInteriorAreaMetres} m².
      </p>
    </article>
  </section>
</main>

<style>
  .cave-plan-page {
    --page-bg: #070706;
    --page-panel: rgba(19, 18, 16, 0.86);
    --page-panel-strong: rgba(24, 22, 19, 0.96);
    --page-line: rgba(200, 180, 140, 0.16);
    --page-line-strong: rgba(200, 180, 140, 0.34);
    --page-text: #f1ede3;
    --page-dim: rgba(231, 224, 210, 0.64);
    --page-accent: #c8b48c;
    --page-radius: clamp(0.7rem, 1vw, 1.2rem);
    min-block-size: 100svh;
    padding: clamp(1rem, 2.2vw, 4.5rem);
    background:
      linear-gradient(rgba(200, 180, 140, 0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(200, 180, 140, 0.018) 1px, transparent 1px),
      radial-gradient(
        circle at 18% 3%,
        rgba(96, 69, 37, 0.25),
        transparent 33rem
      ),
      radial-gradient(
        circle at 88% 42%,
        rgba(51, 69, 72, 0.12),
        transparent 38rem
      ),
      var(--page-bg);
    background-size:
      2rem 2rem,
      2rem 2rem,
      auto,
      auto,
      auto;
    color: var(--page-text);
    color-scheme: dark;
    --theme-panel-bg: var(--page-panel);
    --theme-card-bg: rgba(255, 255, 255, 0.045);
    --theme-card-hover-bg: rgba(255, 255, 255, 0.075);
    --theme-stroke: var(--page-line);
    --theme-stroke-strong: var(--page-line-strong);
    --theme-text: var(--page-text);
    --theme-text-dim: var(--page-dim);
    --theme-accent: var(--page-accent);
    --theme-text-on-accent: #14110c;
    --min-touch-target: 2.75rem;
    --duration-normal: 0.18s;
    --duration-fast: 0.1s;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: clamp(1.5rem, 5vw, 8rem);
    align-items: end;
    padding-block-end: clamp(1.4rem, 3vw, 3.5rem);
    border-block-end: 1px solid var(--page-line);
  }

  .hero-copy {
    max-inline-size: 72rem;
  }

  .eyebrow-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.7rem;
    margin-block-end: 0.9rem;
  }

  .eyebrow,
  .section-kicker {
    color: var(--museum-gold-65);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 760;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .proposal-badge,
  .mode-category,
  .validation-state {
    padding: 0.25rem 0.55rem;
    border: 1px solid var(--museum-gold-20);
    border-radius: 999px;
    background: var(--museum-gold-06);
    color: var(--museum-gold-80);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.2;
  }

  .hero h1 {
    max-inline-size: 18ch;
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(2.3rem, 4.5vw, 6.8rem);
    font-weight: 470;
    letter-spacing: -0.046em;
    line-height: 0.97;
    text-wrap: balance;
  }

  .hero-copy > p {
    max-inline-size: 66ch;
    margin: 1.2rem 0 0;
    color: var(--page-dim);
    font-size: clamp(0.95rem, 1.1vw, 1.35rem);
    line-height: 1.65;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(8.5rem, 1fr));
    min-inline-size: 20rem;
    margin: 0;
    border-block: 1px solid var(--page-line);
  }

  .metrics div {
    padding: 0.75rem;
    border-block-end: 1px solid var(--page-line);
  }

  .metrics div:nth-last-child(-n + 2) {
    border-block-end: 0;
  }

  .metrics div:nth-child(odd) {
    border-inline-end: 1px solid var(--page-line);
  }

  .metrics dt {
    color: var(--page-dim);
    font-size: var(--font-size-compact, 0.75rem);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .metrics dd {
    margin: 0.3rem 0 0;
    color: var(--museum-gold-90);
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(35rem, 1.38fr) minmax(22rem, 0.62fr);
    gap: clamp(1rem, 2vw, 2.5rem);
    align-items: stretch;
    padding-block-start: clamp(1.25rem, 2.5vw, 3rem);
  }

  .plan-column {
    display: grid;
    min-inline-size: 0;
    gap: 0.8rem;
  }

  .panel-glass {
    border: 1px solid var(--page-line);
    border-radius: var(--page-radius);
    background: var(--page-panel);
    box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(1.1rem);
  }

  .plan-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: clamp(0.85rem, 1.3vw, 1.25rem);
  }

  .plan-toolbar h2,
  .mode-ledger h2,
  .program-section h2,
  .validation-card h2 {
    margin: 0.2rem 0 0;
    font-size: clamp(1rem, 1.3vw, 1.4rem);
    font-weight: 620;
    letter-spacing: -0.015em;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.65rem;
    flex: 1 1 auto;
  }

  .layer-switcher {
    inline-size: min(18rem, 42vw);
    flex: 0 0 auto;
  }

  .plan-stage {
    display: grid;
    place-items: start center;
    padding: clamp(0.7rem, 1.5vw, 1.5rem);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.014), transparent 45%),
      var(--page-panel-strong);
  }

  .plan-board {
    inline-size: min(100%, calc(82svh * var(--plan-ratio)));
  }

  .mode-ledger {
    min-inline-size: 0;
    padding: clamp(1rem, 1.7vw, 1.6rem);
  }

  .section-heading > p,
  .program-heading > p {
    margin: 0.6rem 0 0;
    color: var(--page-dim);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.55;
  }

  .mode-list {
    display: grid;
    gap: 0.5rem;
    margin: 1.2rem 0 0;
    padding: 0;
    list-style: none;
  }

  .mode-card {
    --mode-color: #c8b48c;
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr) auto;
    gap: 0.75rem;
    align-items: center;
    min-block-size: 4.3rem;
    padding: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--mode-color) 27%, transparent);
    border-inline-start: 0.22rem solid var(--mode-color);
    border-radius: 0.65rem;
    background: color-mix(in srgb, var(--mode-color) 6%, transparent);
  }

  .mode-water {
    --mode-color: #9fcfe0;
  }

  .mode-fire {
    --mode-color: #df967d;
  }

  .mode-earth {
    --mode-color: #a4c99b;
  }

  .mode-air {
    --mode-color: #a1b6d8;
  }

  .mode-sun {
    --mode-color: #e4c06e;
  }

  .mode-moon {
    --mode-color: #bba1e0;
  }

  .mode-index {
    color: color-mix(in srgb, var(--mode-color) 80%, white);
    font-family: ui-monospace, "Cascadia Code", monospace;
    font-size: var(--font-size-compact, 0.75rem);
  }

  .mode-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.7rem;
  }

  .mode-card h3 {
    margin: 0;
    color: color-mix(in srgb, var(--mode-color) 78%, white);
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 720;
  }

  .mode-category {
    border-color: color-mix(in srgb, var(--mode-color) 34%, transparent);
    background: color-mix(in srgb, var(--mode-color) 8%, transparent);
    color: color-mix(in srgb, var(--mode-color) 82%, white);
    font-family: ui-monospace, "Cascadia Code", monospace;
    font-weight: 760;
  }

  .mode-card p {
    margin: 0.2rem 0 0;
    color: var(--page-dim);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.35;
  }

  .mode-card > i {
    color: var(--mode-color);
    font-size: 1.1rem;
    filter: drop-shadow(
      0 0 0.5rem color-mix(in srgb, var(--mode-color) 36%, transparent)
    );
  }

  .solo-rule {
    margin-block-start: 1rem;
    padding-block-start: 1rem;
    border-block-start: 1px solid var(--page-line);
  }

  .solo-rule p {
    margin: 0.4rem 0 0;
    color: var(--museum-gold-80);
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1rem, 1.35vw, 1.35rem);
    line-height: 1.35;
  }

  .program-section {
    margin-block-start: clamp(1rem, 2vw, 2.5rem);
    padding: clamp(1rem, 1.8vw, 1.75rem);
    content-visibility: auto;
    contain-intrinsic-size: auto 64rem;
  }

  .program-heading {
    display: grid;
    grid-template-columns: minmax(14rem, 0.45fr) minmax(20rem, 0.55fr);
    gap: 2rem;
    align-items: end;
  }

  .program-heading > p {
    max-inline-size: 65ch;
    justify-self: end;
  }

  .program-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    margin: 1.2rem 0 0;
    padding: 0;
    border-block-start: 1px solid var(--page-line);
    border-inline-start: 1px solid var(--page-line);
    list-style: none;
  }

  .program-grid li {
    min-block-size: 10.5rem;
    padding: clamp(0.85rem, 1.25vw, 1.25rem);
    border-block-end: 1px solid var(--page-line);
    border-inline-end: 1px solid var(--page-line);
  }

  .program-topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--museum-gold-35);
  }

  .program-number {
    display: grid;
    place-items: center;
    inline-size: 1.85rem;
    aspect-ratio: 1;
    border: 1px solid var(--museum-gold-35);
    border-radius: 50%;
    color: var(--museum-gold-90);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
  }

  .program-grid li:last-child .program-topline i {
    display: none;
  }

  .program-grid h3 {
    margin: 1.1rem 0 0;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 700;
  }

  .program-grid p {
    margin: 0.4rem 0 0;
    color: var(--page-dim);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.55;
  }

  .reasoning-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: clamp(1rem, 2vw, 2.5rem);
    margin-block-start: clamp(1rem, 2vw, 2.5rem);
    content-visibility: auto;
    contain-intrinsic-size: auto 24rem;
  }

  .decision-card,
  .counterargument,
  .validation-card {
    padding: clamp(1rem, 1.8vw, 1.6rem);
  }

  .decision-card {
    background:
      linear-gradient(130deg, var(--museum-gold-06), transparent 58%),
      var(--page-panel);
  }

  .counterargument {
    border-color: rgba(214, 150, 117, 0.24);
    background: rgba(43, 28, 23, 0.72);
  }

  .counterargument .section-kicker {
    color: rgba(229, 174, 146, 0.78);
  }

  .decision-card h2,
  .counterargument h2 {
    max-inline-size: 24ch;
    margin: 0.5rem 0 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.4rem, 2vw, 2.25rem);
    font-weight: 480;
    line-height: 1.08;
  }

  .decision-card p,
  .counterargument p {
    margin: 0.75rem 0 0;
    color: var(--page-dim);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.6;
  }

  .counterargument p {
    color: rgba(241, 218, 205, 0.76);
  }

  .validation-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    margin-block-end: 1rem;
  }

  .validation-state {
    border-color: rgba(219, 147, 124, 0.38);
    color: rgba(239, 176, 154, 0.9);
    font-weight: 760;
    text-transform: uppercase;
  }

  .validation-state.valid {
    border-color: rgba(145, 198, 142, 0.38);
    color: rgba(177, 224, 174, 0.92);
  }

  .validation-card ul {
    display: grid;
    gap: 0.55rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .validation-card li {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    color: var(--page-dim);
    font-size: var(--font-size-sm, 0.875rem);
  }

  .validation-card li i {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    inline-size: 1.15rem;
    block-size: 1.15rem;
    border: 1px solid currentColor;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.32);
    font-size: 0.55rem;
  }

  .validation-card li.pass i {
    color: rgba(159, 211, 156, 0.88);
  }

  .source-note {
    margin: 1rem 0 0;
    padding-block-start: 0.9rem;
    border-block-start: 1px solid var(--page-line);
    color: rgba(231, 224, 210, 0.48);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.5;
  }

  code {
    color: var(--museum-gold-75);
    font-family: ui-monospace, "Cascadia Code", monospace;
  }

  @media (min-width: 105rem) {
    .workspace {
      grid-template-columns: minmax(48rem, 1.5fr) minmax(31rem, 0.5fr);
    }

    .mode-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .program-grid {
      grid-template-columns: repeat(9, minmax(0, 1fr));
    }

    .program-grid li {
      min-block-size: 13rem;
    }
  }

  @media (max-width: 70rem) {
    .hero {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .metrics {
      inline-size: 100%;
      min-inline-size: 0;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .plan-board {
      inline-size: min(100%, calc(92svh * var(--plan-ratio)));
    }

    .mode-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .reasoning-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .validation-card {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 44rem) {
    .cave-plan-page {
      padding: 0.8rem;
      background-size:
        1.25rem 1.25rem,
        1.25rem 1.25rem,
        auto,
        auto,
        auto;
    }

    .hero h1 {
      font-size: clamp(2.15rem, 12vw, 3.5rem);
    }

    .metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .plan-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .toolbar-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .layer-switcher {
      inline-size: 100%;
    }

    .plan-stage {
      padding: 0.45rem;
      content-visibility: auto;
      contain-intrinsic-size: auto 18rem;
    }

    .panel-glass {
      backdrop-filter: none;
    }

    .plan-board {
      inline-size: 100%;
    }

    .mode-list,
    .program-grid,
    .reasoning-grid,
    .program-heading {
      grid-template-columns: 1fr;
    }

    .program-heading {
      gap: 0;
    }

    .program-heading > p {
      justify-self: start;
    }

    .program-grid li {
      min-block-size: 0;
    }

    .validation-card {
      grid-column: auto;
    }
  }

  @media (max-height: 32rem) and (orientation: landscape) {
    .cave-plan-page {
      padding: 0.75rem;
    }

    .hero {
      grid-template-columns: minmax(0, 1.3fr) minmax(18rem, 0.7fr);
      gap: 1.25rem;
      padding-block-end: 0.9rem;
    }

    .eyebrow-row {
      margin-block-end: 0.45rem;
    }

    .hero h1 {
      max-inline-size: 26ch;
      font-size: clamp(2rem, 5vw, 3rem);
    }

    .hero-copy > p {
      margin-block-start: 0.5rem;
      font-size: 0.8rem;
      line-height: 1.4;
    }

    .metrics div {
      padding: 0.45rem 0.65rem;
    }

    .workspace {
      padding-block-start: 0.8rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cave-plan-page * {
      scroll-behavior: auto;
    }
  }
</style>
