<script lang="ts">
  /**
   * Banked coal wall - the room's wall treatment, not a panel.
   *
   * Built as a run of cribbing bays rather than one wide rectangle. A single
   * lit plane the width of a corridor reads as a backlit billboard no matter
   * what texture is on it; a run of bays with iron posts between them reads as
   * a structure someone built to hold fuel, and the posts give the eye a rhythm
   * to measure distance against as it walks the wall.
   *
   * Three layers, front to back, and the order is the whole trick:
   *   1. the crust shader, which is the heat
   *   2. a bank of COLD lumps standing in front of it, chopping that heat into
   *      slivers - coal is never the thing that glows, it is the thing that
   *      occludes the glow
   *   3. iron cribbing in front of the lumps, holding the bank back
   *
   * Also the room's only source of vertical light. Every other station throws
   * its light from waist height or lower, which is why anything hanging near
   * the ceiling has nothing to draw it. A lit wall behind a fixture gives that
   * fixture a silhouette.
   */
  import { T } from "@threlte/core";
  import { MeshStandardMaterial } from "three";
  import LavaCracks from "$lib/shared/3d/environments/scenes/ember/LavaCracks.svelte";
  import type { LavaCracksConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";
  import FirstFireCoalBank from "./FirstFireCoalBank.svelte";

  interface Props {
    /** Width of ONE bay. Total run is bayWidth x bays. */
    bayWidth?: number;
    height?: number;
    /** How many bays in the run. 1 is a hearth, 5+ is a corridor wall. */
    bays?: number;
    /**
     * The A/B this room was built to settle. "shader" is the crust alone -
     * kept switchable because it is the cheap version and someone will ask.
     */
    treatment?: "shader" | "lumps";
    emberColor?: string;
    /** Lump density per bay. Lower for background runs nobody stands at. */
    lumpsPerBay?: number;
    /** Light thrown into the room per bay. */
    lightIntensity?: number;
    lightDistance?: number;
    seed?: number;
    material: MeshStandardMaterial;
  }

  const {
    bayWidth = 5.2,
    height = 3.1,
    bays = 1,
    treatment = "lumps",
    emberColor = "#ff4a10",
    lumpsPerBay = 520,
    lightIntensity = 7.5,
    lightDistance = 12,
    seed = 11,
    material,
  }: Props = $props();

  const coals: LavaCracksConfig = $derived({
    enabled: true,
    crackColor: emberColor,
    intensity: 1.05,
    speed: 0.008,
    scale: 4.5,
    pulseSpeed: 0.25,
    pulseIntensity: 0.4,
  });

  const runWidth = $derived(bayWidth * bays);

  /** Bay centres, laid out symmetrically about the component origin. */
  const bayCentres = $derived(
    Array.from({ length: bays }, (_, i) => -runWidth / 2 + bayWidth * (i + 0.5))
  );

  /** Vertical grate bars within one bay. Spacing is fixed, so a wider bay gets
      more bars rather than the same bars stretched further apart. */
  const BAR_PITCH = 0.6;
  const barsPerBay = $derived(Math.max(3, Math.round((bayWidth - 0.6) / BAR_PITCH)));
  const bayBars = $derived(
    Array.from({ length: barsPerBay }, (_, i) => ({
      x: -bayWidth / 2 + 0.3 + i * ((bayWidth - 0.6) / (barsPerBay - 1)),
    }))
  );

  /** Posts between bays, plus one at each end of the run. */
  const posts = $derived(
    Array.from({ length: bays + 1 }, (_, i) => -runWidth / 2 + bayWidth * i)
  );
</script>

{#each bayCentres as centre, bay (bay)}
  <T.Group position.x={centre}>
    <!-- The heat, always. On its own this is the whole wall, and it reads as a
         red crackle pattern printed on a flat panel. -->
    <LavaCracks
      config={coals}
      groundSize={1}
      edgeFade={0}
      placement={{
        position: [0, height / 2 + 0.2, 0.04],
        rotation: [0, 0, 0],
        size: [bayWidth, height],
      }}
    />

    {#if treatment === "lumps"}
      <!-- The same heat, now with cold lumps standing in front of it. The lumps
           carry almost no glow of their own; they chop the shader behind them
           into hot slivers, which is what a coal bank actually looks like. -->
      <T.Group position={[0, 0.28, 0.62]}>
        <FirstFireCoalBank
          width={bayWidth - 0.2}
          height={height - 0.1}
          depth={0.55}
          count={lumpsPerBay}
          sizeRange={[0.07, 0.22]}
          {emberColor}
          heat="banked"
          seed={seed + bay * 7}
        />
      </T.Group>
    {/if}

    <!-- Grate holding the bank back. It has to sit IN FRONT of the coal to do
         that: behind it, the lumps bury it and the wall loses the one cue that
         says a person stacked this fuel here. -->
    {#each bayBars as bar, i (i)}
      <T.Mesh position={[bar.x, height / 2 + 0.2, 1.02]} {material}>
        <T.BoxGeometry args={[0.09, height, 0.09]} />
      </T.Mesh>
    {/each}

    <T.PointLight
      position={[0, height / 2 + 0.2, 1.1]}
      color={emberColor}
      intensity={lightIntensity}
      distance={lightDistance}
      decay={2}
    />
  </T.Group>
{/each}

<!-- Kerb and lintel run unbroken across every bay: the cribbing is one built
     thing with divisions in it, not a row of separate hearths. -->
<T.Mesh position={[0, 0.24, 1.02]} {material}>
  <T.BoxGeometry args={[runWidth + 0.3, 0.36, 0.5]} />
</T.Mesh>
<T.Mesh position={[0, height + 0.2, 1.02]} {material}>
  <T.BoxGeometry args={[runWidth + 0.3, 0.2, 0.3]} />
</T.Mesh>

<!-- Posts between bays. Deeper than the grate so they cast the bay next door
     into shadow at a glancing angle - that is what turns a long wall into a
     sequence of lit pockets rather than one continuous smear of orange. -->
{#each posts as postX, i (i)}
  <T.Mesh position={[postX, height / 2 + 0.2, 1.14]} {material}>
    <T.BoxGeometry args={[0.26, height + 0.5, 0.66]} />
  </T.Mesh>
{/each}
