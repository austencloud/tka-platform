<script lang="ts">
  /**
   * Hand-float arrow review harness.
   *
   * Every quarter hand-float the guide pages can author, rendered through the
   * REAL pipeline (PRO shift on HAND props → PictographPreparer hand-path mode
   * → FLOAT arrow), one pictograph per (location, handpath direction, color).
   *
   * Each cell's caption carries an independent oracle: the expected chord
   * direction computed from pure grid geometry (end − start), NOT from the
   * arrow pipeline. The rendered float chevron must point the same way as the
   * caption's big arrow. Any cell where they disagree is a pipeline bug.
   *
   * Born from the 2026-08-09 gamma-page incident: hand-path floats stamped a
   * cw/ccw rotationDirection that shouldMirrorArrow interpreted as a prop
   * spin, mirroring every ccw chevron. See
   * tests/unit/arrow-adjustment/HandPathFloatMirroring.test.ts.
   */
  import PictographContainer from "$lib/shared/pictograph/shared/components/PictographContainer.svelte";
  import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
  import {
    MotionType,
    MotionColor,
  } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
  import {
    GridMode,
    GridLocation,
  } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
  import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
  import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";

  const { NORTH, EAST, SOUTH, WEST, NORTHEAST, SOUTHEAST, SOUTHWEST, NORTHWEST } =
    GridLocation;

  // Screen-space unit coords per location (y down, like the rendered grid).
  const COORD: Record<string, [number, number]> = {
    [NORTH]: [0, -1],
    [NORTHEAST]: [1, -1],
    [EAST]: [1, 0],
    [SOUTHEAST]: [1, 1],
    [SOUTH]: [0, 1],
    [SOUTHWEST]: [-1, 1],
    [WEST]: [-1, 0],
    [NORTHWEST]: [-1, -1],
  };

  // Quarter-step rings. Cardinal floats land on cardinals, intercardinal on
  // intercardinals — matching what the guide/hand-path builders author.
  const CARDINALS = [NORTH, EAST, SOUTH, WEST];
  const INTERCARDINALS = [NORTHEAST, SOUTHEAST, SOUTHWEST, NORTHWEST];

  const nextOnRing = (ring: GridLocation[], loc: GridLocation, cw: boolean) => {
    const i = ring.indexOf(loc);
    return ring[(i + (cw ? 1 : ring.length - 1)) % ring.length]!;
  };

  // Independent oracle: chord direction end−start → one of 8 unicode arrows.
  const chordArrow = (from: GridLocation, to: GridLocation): string => {
    const [ax, ay] = COORD[from]!;
    const [bx, by] = COORD[to]!;
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    const key = `${dx},${dy}`;
    const ARROWS: Record<string, string> = {
      "0,-1": "↑", "1,-1": "↗", "1,0": "→", "1,1": "↘",
      "0,1": "↓", "-1,1": "↙", "-1,0": "←", "-1,-1": "↖",
    };
    return ARROWS[key] ?? "?";
  };

  const OPPOSITE: Record<string, GridLocation> = {
    [NORTH]: SOUTH, [SOUTH]: NORTH, [EAST]: WEST, [WEST]: EAST,
    [NORTHEAST]: SOUTHWEST, [SOUTHWEST]: NORTHEAST,
    [NORTHWEST]: SOUTHEAST, [SOUTHEAST]: NORTHWEST,
  };

  const SHORT: Record<string, string> = {
    [NORTH]: "N", [EAST]: "E", [SOUTH]: "S", [WEST]: "W",
    [NORTHEAST]: "NE", [SOUTHEAST]: "SE", [SOUTHWEST]: "SW", [NORTHWEST]: "NW",
  };

  // Authored exactly like GammaPage: PRO shift, HAND prop; the preparer's
  // hand-path mode converts it to FLOAT. The other hand sits STATIC opposite.
  const motion = (color: MotionColor, from: GridLocation, to: GridLocation) =>
    createMotionData({
      motionType: from === to ? MotionType.STATIC : MotionType.PRO,
      startLocation: from,
      endLocation: to,
      color,
      propType: PropType.HAND,
      gridMode: GridMode.DIAMOND,
    });

  type Case = {
    label: string;
    expected: string;
    data: PictographData;
  };

  const makeCase = (
    movingColor: MotionColor,
    from: GridLocation,
    to: GridLocation,
    cw: boolean
  ): Case => {
    const staticLoc = OPPOSITE[from]!;
    const moving = motion(movingColor, from, to);
    const still = motion(
      movingColor === MotionColor.BLUE ? MotionColor.RED : MotionColor.BLUE,
      staticLoc,
      staticLoc
    );
    return {
      label: `${SHORT[from]}→${SHORT[to]} ${cw ? "cw" : "ccw"}`,
      expected: chordArrow(from, to),
      data: {
        id: `hfr-${movingColor}-${SHORT[from]}-${SHORT[to]}`,
        letter: null,
        startPosition: null,
        endPosition: null,
        gridMode: GridMode.DIAMOND,
        motions:
          movingColor === MotionColor.BLUE
            ? { blue: moving, red: still }
            : { blue: still, red: moving },
      } as unknown as PictographData,
    };
  };

  type Section = { title: string; cases: Case[] };

  const sectionFor = (color: MotionColor, cw: boolean): Section => {
    const cases: Case[] = [];
    for (const ring of [CARDINALS, INTERCARDINALS]) {
      for (const from of ring) {
        cases.push(makeCase(color, from, nextOnRing(ring, from, cw), cw));
      }
    }
    return {
      title: `${color === MotionColor.BLUE ? "Blue" : "Red"} hand — ${cw ? "clockwise" : "counter-clockwise"} handpath`,
      cases,
    };
  };

  const SECTIONS: Section[] = [
    sectionFor(MotionColor.BLUE, true),
    sectionFor(MotionColor.BLUE, false),
    sectionFor(MotionColor.RED, true),
    sectionFor(MotionColor.RED, false),
  ];
</script>

<svelte:head>
  <title>Hand-Float Arrow Review</title>
</svelte:head>

<main class="review">
  <header>
    <h1>Hand-Float Arrow Review</h1>
    <p>
      Every quarter hand-float, rendered through the real hand-path pipeline.
      The big arrow under each cell is the expected chord direction, computed
      from pure geometry — the rendered chevron must point the same way. Any
      disagreement is a pipeline bug.
    </p>
  </header>

  {#each SECTIONS as section (section.title)}
    <section>
      <h2>{section.title}</h2>
      <div class="grid">
        {#each section.cases as c (c.data.id)}
          <figure class="cell">
            <div class="picto">
              <PictographContainer
                pictographData={c.data}
                gridMode={GridMode.DIAMOND}
                bluePropTypeOverride={PropType.HAND}
                redPropTypeOverride={PropType.HAND}
                showGrid={true}
                showTKA={false}
                showPositions={false}
                showElemental={false}
                showReversals={false}
                showTnD={false}
                showNonRadialPoints={false}
                showHandPoints={true}
                darkMode={true}
                disableTransitions={true}
              />
            </div>
            <figcaption>
              <span class="label">{c.label}</span>
              <span class="expected" aria-label="expected direction">{c.expected}</span>
            </figcaption>
          </figure>
        {/each}
      </div>
    </section>
  {/each}
</main>

<style>
  .review {
    max-width: 100rem;
    margin: 0 auto;
    padding: 2rem clamp(1rem, 3vw, 3rem) 4rem;
    color: var(--theme-text, #e8e8f0);
  }

  header {
    margin-bottom: 2rem;
    max-width: 48rem;
  }

  h1 {
    font-size: 1.75rem;
    margin: 0 0 0.5rem;
  }

  header p {
    margin: 0;
    opacity: 0.8;
    line-height: 1.5;
  }

  section {
    margin-bottom: 2.5rem;
  }

  h2 {
    font-size: 1.15rem;
    margin: 0 0 1rem;
    opacity: 0.9;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr));
    gap: 0.75rem;
  }

  @media (max-width: 1400px) {
    .grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .cell {
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .picto {
    aspect-ratio: 1;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 0.5rem;
    overflow: hidden;
    background: #0d0d14;
  }

  figcaption {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
    font-size: 0.85rem;
  }

  .expected {
    font-size: 1.35rem;
    line-height: 1;
    font-family: system-ui, sans-serif;
  }
</style>
