<script lang="ts">
  import { goto } from "$app/navigation";
  import SegmentedControl from "$lib/shared/ui/components/SegmentedControl.svelte";
  import PanelButton from "$lib/shared/components/panel/PanelButton.svelte";
  import MuseumFloorPlanPreview from "$lib/features/museum/components/editor/MuseumFloorPlanPreview.svelte";
  import { buildLobbyFloorPlan } from "$lib/features/museum/data/lobby-floor-plan";
  import type { MuseumFloorPlanLayer } from "$lib/features/museum/domain/museum-floor-plan-types";
  import "$lib/features/museum/components/museum-theme.css";

  const plan = buildLobbyFloorPlan();
  const lobby = plan.grid.wings.find((wing) => wing.id === "lobby")!;
  const caveExit = plan.zones.find((zone) => zone.id === "cave-dogleg")!;
  const programZones = plan.zones.toSorted((a, b) => a.number - b.number);

  const layerOptions: {
    value: MuseumFloorPlanLayer;
    label: string;
    shortLabel: string;
  }[] = [
    { value: "program", label: "Program overlay", shortLabel: "Program" },
    { value: "tiles", label: "Built tile grid", shortLabel: "Tiles" },
  ];

  let layer = $state<MuseumFloorPlanLayer>("program");
  const planRatio = plan.grid.width / plan.grid.height;
</script>

<svelte:head>
  <title>Entrance Lobby Floor Plan | The Kinetic Archive</title>
  <meta
    name="description"
    content="A buildable floor plan proposal for The Kinetic Archive entrance lobby."
  />
</svelte:head>

<main class="lobby-plan-page museum-gold-scope">
  <header class="hero">
    <div class="hero-copy">
      <div class="eyebrow-row">
        <span class="eyebrow">The Kinetic Archive</span>
        <span class="proposal-badge">Floor plan proposal 01</span>
      </div>
      <h1>The lobby gives you one clear route and six reasons to slow down.</h1>
      <p>
        A formal Order-built room first. The strange part waits around the
        corner. This plan keeps the entrance readable, puts the museum's social
        life on the west wall, and lets the gift shop promise a return without
        opening the exit loop early.
      </p>
    </div>

    <dl class="metrics" aria-label="Floor plan dimensions">
      <div>
        <dt>Interior</dt>
        <dd>
          {plan.lobbyInterior.widthMetres} × {plan.lobbyInterior.heightMetres} m
        </dd>
      </div>
      <div>
        <dt>Grid</dt>
        <dd>
          {plan.lobbyInterior.widthTiles} × {plan.lobbyInterior.heightTiles} tiles
        </dd>
      </div>
      <div>
        <dt>Portal</dt>
        <dd>3 m, off-axis</dd>
      </div>
    </dl>
  </header>

  <section class="workspace" aria-labelledby="plan-heading">
    <div class="plan-column">
      <div class="plan-toolbar panel-glass">
        <div>
          <span class="section-kicker">Live layout data</span>
          <h2 id="plan-heading">Entrance lobby and cave threshold</h2>
        </div>
        <div class="toolbar-actions">
          <div class="layer-switcher">
            <SegmentedControl
              options={layerOptions}
              value={layer}
              onchange={(value) => (layer = value)}
              color="accent"
              size="sm"
              ariaLabel="Floor plan layer"
            />
          </div>
          <PanelButton
            variant="primary"
            onclick={() => goto("/test/museum-lobby-3d")}
            ariaLabel="Walk the lobby in 3D"
          >
            <i class="fa-solid fa-cube" aria-hidden="true"></i>
            <span>Walk the 3D lobby</span>
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
          />
        </div>
      </div>
    </div>

    <aside class="brief-column" aria-label="Lobby design brief">
      <section class="brief-section panel-glass">
        <div class="section-heading">
          <span class="section-kicker">Room program</span>
          <h2>What each part is doing</h2>
        </div>
        <ol class="program-list">
          {#each programZones as zone (zone.id)}
            <li>
              <span class="program-number">{zone.number}</span>
              <div>
                <h3>{zone.title}</h3>
                <p>{zone.description}</p>
              </div>
            </li>
          {/each}
        </ol>
      </section>

      <section class="decision-card panel-glass">
        <span class="section-kicker">Why this shape</span>
        <h2>Compression happens after orientation.</h2>
        <p>
          The lobby stays broad enough for the sculpture and two-sided browsing.
          The route then moves northeast, narrows to five tiles, and turns into
          the cave. The lighting and audio transition get real distance instead
          of happening in a doorway.
        </p>
      </section>

      <section class="counterargument panel-glass">
        <span class="section-kicker">Honest counterargument</span>
        <p>
          The cave is not visible from the front doors. That gives up an
          immediate spectacle in exchange for a stronger tonal reveal and a
          lobby that reads as a credible museum first.
        </p>
      </section>

      <section
        class="validation-card panel-glass"
        aria-label="Layout validation"
      >
        <div class="section-heading validation-heading">
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
            Visitor starts on walkable marble
          </li>
          <li class:pass={plan.validation.unreachableRooms.length === 0}>
            <i class="fa-solid fa-check" aria-hidden="true"></i>
            Lobby and cave threshold connect
          </li>
          <li class:pass={plan.validation.overlaps.length === 0}>
            <i class="fa-solid fa-check" aria-hidden="true"></i>
            No room overlap
          </li>
          <li class:pass={caveExit.width >= 5}>
            <i class="fa-solid fa-check" aria-hidden="true"></i>
            Dogleg keeps a five-tile clear route
          </li>
        </ul>
        <p class="source-note">
          Built from the museum's <code>RoomNode</code>,
          <code>MuseumGrid</code>, wall stamper, corridor router, and validator.
          One square is 0.5 metres.
        </p>
      </section>

      <section class="room-note panel-glass">
        <span class="section-kicker">Room boundary</span>
        <p>
          The numbered overlays describe use, not extra walls. The lobby remains
          one room node, so sightlines, navigation, lighting, and future 3D
          dressing all share one continuous
          {lobby.bounds.width - 2} × {lobby.bounds.height - 2} tile interior.
        </p>
      </section>
    </aside>
  </section>
</main>

<style>
  .lobby-plan-page {
    --page-bg: #080807;
    --page-panel: rgba(20, 19, 17, 0.84);
    --page-panel-strong: rgba(27, 25, 22, 0.94);
    --page-line: rgba(200, 180, 140, 0.16);
    --page-text: #f1ede3;
    --page-dim: rgba(231, 224, 210, 0.62);
    --page-accent: #c8b48c;
    min-block-size: 100svh;
    padding: clamp(1rem, 2.2vw, 4.5rem);
    background:
      linear-gradient(rgba(200, 180, 140, 0.022) 1px, transparent 1px),
      linear-gradient(90deg, rgba(200, 180, 140, 0.022) 1px, transparent 1px),
      radial-gradient(
        circle at 23% 8%,
        rgba(103, 85, 51, 0.2),
        transparent 34rem
      ),
      var(--page-bg);
    background-size:
      2rem 2rem,
      2rem 2rem,
      auto,
      auto;
    color: var(--page-text);
    font-family: inherit;
    color-scheme: dark;
    --theme-panel-bg: var(--page-panel);
    --theme-card-bg: rgba(255, 255, 255, 0.045);
    --theme-card-hover-bg: rgba(255, 255, 255, 0.07);
    --theme-stroke: var(--page-line);
    --theme-stroke-strong: rgba(200, 180, 140, 0.34);
    --theme-text: var(--page-text);
    --theme-text-dim: var(--page-dim);
    --theme-accent: var(--page-accent);
    --theme-text-on-accent: #14110c;
  }

  .hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: clamp(1.5rem, 5vw, 7rem);
    align-items: end;
    padding-block-end: clamp(1.4rem, 3vw, 3.5rem);
    border-block-end: 1px solid var(--page-line);
  }

  .hero-copy {
    max-inline-size: 66rem;
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

  .proposal-badge {
    padding: 0.25rem 0.55rem;
    border: 1px solid var(--museum-gold-20);
    border-radius: 999px;
    background: var(--museum-gold-06);
    color: var(--museum-gold-80);
    font-size: var(--font-size-compact, 0.75rem);
    line-height: 1.2;
  }

  .hero h1 {
    max-inline-size: 20ch;
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(2.2rem, 4.4vw, 6.7rem);
    font-weight: 470;
    letter-spacing: -0.045em;
    line-height: 0.98;
    text-wrap: balance;
  }

  .hero-copy > p {
    max-inline-size: 66ch;
    margin: 1.2rem 0 0;
    color: var(--page-dim);
    font-size: clamp(0.95rem, 1.15vw, 1.35rem);
    line-height: 1.65;
  }

  .metrics {
    display: grid;
    gap: 0;
    min-inline-size: 15rem;
    margin: 0;
    border-block: 1px solid var(--page-line);
  }

  .metrics div {
    display: grid;
    grid-template-columns: 5rem 1fr;
    gap: 1rem;
    align-items: baseline;
    padding-block: 0.7rem;
    border-block-end: 1px solid var(--page-line);
  }

  .metrics div:last-child {
    border-block-end: 0;
  }

  .metrics dt {
    color: var(--page-dim);
    font-size: var(--font-size-compact, 0.75rem);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .metrics dd {
    margin: 0;
    color: var(--museum-gold-90);
    font-size: var(--font-size-sm, 0.875rem);
    font-variant-numeric: tabular-nums;
    text-align: end;
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(28rem, 1.15fr) minmax(24rem, 0.85fr);
    gap: clamp(1rem, 2vw, 2.5rem);
    align-items: start;
    padding-block-start: clamp(1.25rem, 2.5vw, 3rem);
  }

  .plan-column,
  .brief-column {
    min-inline-size: 0;
  }

  .plan-column {
    display: grid;
    gap: 0.8rem;
  }

  .panel-glass {
    border-color: var(--page-line);
    background: var(--page-panel);
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
  .brief-section h2,
  .decision-card h2,
  .validation-card h2 {
    margin: 0.2rem 0 0;
    font-size: clamp(1rem, 1.3vw, 1.35rem);
    font-weight: 620;
    letter-spacing: -0.015em;
  }

  .layer-switcher {
    inline-size: min(18rem, 42vw);
    flex: 0 0 auto;
    --min-touch-target: 2.5rem;
    --duration-normal: 0.18s;
    --duration-fast: 0.1s;
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.65rem;
    flex: 1 1 auto;
    --min-touch-target: 2.5rem;
    --duration-normal: 0.18s;
  }

  .plan-stage {
    display: grid;
    place-items: start center;
    min-block-size: 30rem;
    padding: clamp(0.75rem, 1.8vw, 1.75rem);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.015), transparent 45%),
      var(--page-panel-strong);
  }

  .plan-board {
    inline-size: min(100%, calc(110svh * var(--plan-ratio)));
  }

  .brief-column {
    display: grid;
    gap: 1rem;
  }

  .brief-section,
  .decision-card,
  .counterargument,
  .validation-card,
  .room-note {
    padding: clamp(1rem, 1.8vw, 1.6rem);
  }

  .section-heading {
    margin-block-end: 1rem;
  }

  .program-list {
    display: grid;
    gap: 0;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .program-list li {
    display: grid;
    grid-template-columns: 2rem minmax(0, 1fr);
    gap: 0.75rem;
    padding-block: 0.9rem;
    border-block-start: 1px solid var(--page-line);
  }

  .program-number {
    display: grid;
    place-items: center;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: 1px solid var(--museum-gold-35);
    border-radius: 50%;
    color: var(--museum-gold-90);
    font-size: var(--font-size-compact, 0.75rem);
    font-weight: 800;
  }

  .program-list h3 {
    margin: 0;
    font-size: var(--font-size-sm, 0.875rem);
    font-weight: 680;
  }

  .program-list p,
  .decision-card p,
  .counterargument p,
  .room-note p {
    margin: 0.3rem 0 0;
    color: var(--page-dim);
    font-size: var(--font-size-sm, 0.875rem);
    line-height: 1.55;
  }

  .decision-card {
    background:
      linear-gradient(130deg, var(--museum-gold-06), transparent 58%),
      var(--page-panel);
  }

  .decision-card h2 {
    max-inline-size: 25ch;
    margin-block-start: 0.45rem;
    font-family: Georgia, "Times New Roman", serif;
    font-size: clamp(1.35rem, 2vw, 2.15rem);
    font-weight: 480;
    line-height: 1.08;
  }

  .counterargument {
    border-color: rgba(214, 150, 117, 0.24);
    background: rgba(43, 28, 23, 0.66);
  }

  .counterargument .section-kicker {
    color: rgba(229, 174, 146, 0.76);
  }

  .counterargument p {
    color: rgba(241, 218, 205, 0.76);
  }

  .validation-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }

  .validation-state {
    padding: 0.28rem 0.6rem;
    border: 1px solid rgba(219, 147, 124, 0.38);
    border-radius: 999px;
    color: rgba(239, 176, 154, 0.9);
    font-size: var(--font-size-compact, 0.75rem);
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
      grid-template-columns: minmax(40rem, 1.3fr) minmax(32rem, 0.7fr);
    }

    .brief-column {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .brief-section,
    .validation-card {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 70rem) {
    .hero {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .metrics {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .metrics div {
      grid-template-columns: 1fr;
      gap: 0.2rem;
      padding-inline: 0.75rem;
      border-block-end: 0;
      border-inline-end: 1px solid var(--page-line);
    }

    .metrics div:last-child {
      border-inline-end: 0;
    }

    .metrics dd {
      text-align: start;
    }

    .workspace {
      grid-template-columns: 1fr;
    }

    .plan-board {
      inline-size: min(100%, calc(105svh * var(--plan-ratio)));
    }
  }

  @media (max-width: 40rem) {
    .lobby-plan-page {
      padding: 0.8rem;
      background-size:
        1.25rem 1.25rem,
        1.25rem 1.25rem,
        auto,
        auto;
    }

    .hero h1 {
      font-size: clamp(2rem, 12vw, 3.25rem);
    }

    .metrics {
      min-inline-size: 0;
    }

    .metrics div {
      padding-inline: 0.45rem;
    }

    .metrics dd {
      font-size: 0.72rem;
    }

    .plan-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .layer-switcher {
      inline-size: 100%;
    }

    .toolbar-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .plan-stage {
      min-block-size: 0;
      padding: 0.55rem;
    }

    .plan-board {
      inline-size: 100%;
    }
  }
</style>
