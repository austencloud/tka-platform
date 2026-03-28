<script lang="ts">
  import type { MuseumGrid, MuseumTile } from "./domain/museum-grid-types";
  import { tileKey } from "./domain/museum-grid-types";
  import { createMuseum2DState } from "./state/museum-2d-state.svelte";
  import { setMuseum2DContext } from "./state/museum-2d-context";
  import SplitScreenLayout from "./components/layout/SplitScreenLayout.svelte";
  import Museum2DGame from "./components/game/Museum2DGame.svelte";
  import DetailPanel from "./components/panel/DetailPanel.svelte";

  // ── Build the Discovery Chamber grid ──

  const WIDTH = 20;
  const HEIGHT = 24;

  function buildDiscoveryChamber(): MuseumGrid {
    const tiles = new Map<string, MuseumTile>();

    // Fill the entire room with stone floor
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        tiles.set(tileKey(x, y), { type: "floor", material: "stone" });
      }
    }

    // Perimeter walls
    for (let x = 0; x < WIDTH; x++) {
      tiles.set(tileKey(x, 0), { type: "wall" });
      tiles.set(tileKey(x, HEIGHT - 1), { type: "wall" });
    }
    for (let y = 0; y < HEIGHT; y++) {
      tiles.set(tileKey(0, y), { type: "wall" });
      tiles.set(tileKey(WIDTH - 1, y), { type: "wall" });
    }

    // South wall entrance gap: cols 7-12 on row 23 become floor (door)
    for (let x = 7; x <= 12; x++) {
      tiles.set(tileKey(x, HEIGHT - 1), { type: "door" });
    }

    // Pedestals at (9,2) and (10,2)
    tiles.set(tileKey(9, 2), { type: "pedestal", refId: "lascaux-tablets" });
    tiles.set(tileKey(10, 2), { type: "pedestal", refId: "lascaux-tablets" });

    // Exhibit panels on the north wall at y=1, cols 8-11
    for (let x = 8; x <= 11; x++) {
      tiles.set(tileKey(x, 1), {
        type: "exhibit-panel",
        refId: "lascaux-tablets",
        facing: "south",
      });
    }

    // Performer stations at (9,4) and (10,4)
    tiles.set(tileKey(9, 4), {
      type: "performer-station",
      refId: "discovery-performer",
      facing: "south",
    });
    tiles.set(tileKey(10, 4), {
      type: "performer-station",
      refId: "discovery-performer",
      facing: "south",
    });

    // Torches at four positions
    tiles.set(tileKey(1, 5), { type: "torch" });
    tiles.set(tileKey(1, 18), { type: "torch" });
    tiles.set(tileKey(18, 5), { type: "torch" });
    tiles.set(tileKey(18, 18), { type: "torch" });

    return {
      width: WIDTH,
      height: HEIGHT,
      tileScale: 0.5,
      tiles,
      wings: [
        {
          id: "discovery-chamber",
          name: "The Discovery Chamber",
          bounds: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
          theme: "cave",
        },
      ],
      spawn: { x: 10, y: 20, facing: "north" },
      exhibits: [
        {
          id: "lascaux-tablets",
          tileX: 9,
          tileY: 1,
          plaque: {
            title: "The Lascaux Tablets",
            subtitle: "40,000 BCE (replica)",
            body:
              "40,000 years ago, someone pressed their hands against cave walls " +
              "and blew pigment around them. Not to decorate. To say: I was here. " +
              "I moved. My body made this shape.\n\n" +
              "The Kinetic Alphabet starts from the same impulse. " +
              "Before notation, before language, before writing, " +
              "there was a person holding something and turning.",
            footer: "Wing I: Origins",
          },
        },
      ],
      performers: [
        {
          id: "discovery-performer",
          tileX: 9,
          tileY: 4,
          facing: "south",
          autoPlay: false,
        },
      ],
      triggers: [],
    };
  }

  const grid = buildDiscoveryChamber();
  const state = createMuseum2DState(grid);

  setMuseum2DContext({ state });
</script>

<div class="museum-2d-module">
  <SplitScreenLayout>
    {#snippet left()}
      <Museum2DGame />
    {/snippet}
    {#snippet right()}
      <DetailPanel />
    {/snippet}
  </SplitScreenLayout>
</div>

<style>
  .museum-2d-module {
    width: 100%;
    height: 100%;
    background: #0a0a0a;
  }
</style>
