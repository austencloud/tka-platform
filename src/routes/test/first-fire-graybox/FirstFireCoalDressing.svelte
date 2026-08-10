<script lang="ts">
  /**
   * Coal dressing for the first section of the walk: Water door, threshold,
   * the water-to-dj transfer, and the approach into the DJ court.
   *
   * Placement is DERIVED from the approved contract, never eyeballed. The
   * corridor centreline and width come out of pathSections, the threshold out
   * of contract.threshold, the court out of contract.courts. Nothing here
   * moves a wall or a route - it only decides what the visitor sees standing
   * on geometry the plan already fixed.
   *
   * The vocabulary is the one the look-dev room settled:
   *   - banked coal cribbing as the wall treatment
   *   - chain lamps marking the route
   *   - a quench vent where the walk arrives from Water
   *
   * The quench vent is doing double duty. Austen's brief asks for a thread
   * connecting the exhibits, and this is the one place in the museum where two
   * rooms physically meet: a visitor steps out of Water and the first thing
   * this room does is put their element on hot slag and boil it off. The
   * transition IS the exhibit label.
   */
  import { T } from "@threlte/core";
  import { MeshStandardMaterial } from "three";
  import type { FirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";
  import FirstFireCoalWall from "$lib/shared/3d/environments/scenes/first-fire/FirstFireCoalWall.svelte";
  import FirstFireCoalLamp from "$lib/shared/3d/environments/scenes/first-fire/FirstFireCoalLamp.svelte";
  import FirstFireSteamVent from "$lib/shared/3d/environments/scenes/first-fire/FirstFireSteamVent.svelte";

  interface Props {
    contract: FirstFireBlenderContract;
    /** Cut with the extinguish beat, same as the rest of the court dressing. */
    lit?: boolean;
  }

  const { contract, lit = true }: Props = $props();

  /** Blender (X, Y, Z) -> runtime (X, Z, -Y). Same mapping the walk scene uses. */
  const toRuntime = (point: { x: number; y: number }): [number, number] => [
    point.x,
    -point.y,
  ];

  const CEILING_Y = 5.4;
  /** Height of the quench-vent housing above the floor. */
  const VENT_SINK = 0.3;

  const iron = new MeshStandardMaterial({
    color: "#2b2320",
    roughness: 0.72,
    metalness: 0.2,
  });

  /**
   * The first section of the walk is three contract path sections end to end:
   * the steam threshold you arrive on from Water, the ember bridge, and the
   * lane that turns into the DJ court. They share endpoints, so the dedupe
   * below keeps the centreline a single unbroken polyline.
   */
  const APPROACH_SECTIONS = [
    "water-steam-threshold",
    "ember-bridge",
    "torch-lane-to-dj",
  ];

  const approach = $derived(
    APPROACH_SECTIONS.map((id) =>
      contract.pathSections.find((section) => section.id === id)
    ).filter((section) => section !== undefined)
  );

  const transfer = $derived(approach.length > 0 ? approach[0] : null);

  /** Corridor centreline in runtime XZ. */
  const centreline = $derived.by(() => {
    const points: [number, number][] = [];
    for (const section of approach) {
      for (const point of section.blenderPoints) {
        const next = toRuntime(point);
        const last = points.at(-1);
        if (last && Math.hypot(last[0] - next[0], last[1] - next[1]) < 1e-6) {
          continue;
        }
        points.push(next);
      }
    }
    return points;
  });

  interface Placement {
    x: number;
    z: number;
    /** Yaw so the placed thing faces the corridor. */
    yaw: number;
    /** Distance along the centreline, for spacing decisions. */
    along: number;
  }

  /**
   * Walk the centreline and drop a placement every `spacing` metres, offset
   * sideways by `offset` (signed, so the same call does both walls).
   *
   * Sampling by arc length rather than per vertex matters: the plan's corridor
   * vertices bunch up around the turn into the court, and per-vertex placement
   * would crowd the fittings exactly where the visitor most needs a clear read.
   */
  function sampleAlong(
    points: readonly [number, number][],
    spacing: number,
    offset: number,
    startAt = 0
  ): Placement[] {
    if (points.length < 2) return [];
    const out: Placement[] = [];
    let travelled = 0;
    let next = startAt;

    for (let i = 0; i < points.length - 1; i += 1) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const segment = Math.hypot(dx, dz);
      if (segment < 1e-6) continue;
      const nx = dx / segment;
      const nz = dz / segment;
      // Left normal in XZ. Sign of `offset` picks the side.
      const px = -nz;
      const pz = nx;

      while (next <= travelled + segment) {
        const t = next - travelled;
        out.push({
          x: ax + nx * t + px * offset,
          z: az + nz * t + pz * offset,
          yaw: Math.atan2(nx, nz),
          along: next,
        });
        next += spacing;
      }
      travelled += segment;
    }
    return out;
  }

  const corridorWidth = $derived(transfer?.width ?? 4.5);
  /**
   * Flush with the wall face. The plan's wall band starts at half the corridor
   * width and runs 1.2m outward, so anything placed past that face is inside
   * solid basalt - the first pass put the run at +0.9 and buried it. The
   * cribbing's own relief is what keeps it out of the walkway.
   */
  const wallOffset = $derived(corridorWidth / 2);

  const CRIB_BAY = 3.2;
  const CRIB_HEIGHT = 4.2;
  /** Corridor profile: the run projects ~0.6m, leaving 3.3m clear between. */
  const CRIB_RELIEF = 0.42;

  /**
   * Cribbing down both sides. Bays are placed at bay-width intervals so the
   * runs read continuous around the corridor's bends rather than as separate
   * panels with basalt showing between them.
   *
   * Light per bay is deliberately weak and short-range. A run this dense puts
   * five bays inside any one lump's light radius, so anything strong enough to
   * read alone stacks five deep down the corridor and washes the coal back to
   * pale rubble.
   */
  const leftCrib = $derived(sampleAlong(centreline, CRIB_BAY, -wallOffset, 1.2));
  const rightCrib = $derived(sampleAlong(centreline, CRIB_BAY, wallOffset, 1.2));

  /**
   * Lamps down the centreline. 3.4m is roughly four walking paces - close
   * enough that the next fixture is already lit when the visitor leaves the
   * last one, which is what makes a row of them read as a route instead of as
   * scattered decoration.
   */
  const lamps = $derived(sampleAlong(centreline, 3.4, 0, 2.2));

  /**
   * Only the first lamp sheds. A coal falling out of every fixture at once
   * reads as a malfunction rather than as one lamp that happens to be shedding
   * as you pass under it.
   */
  const dripAt = 0;

  const thresholdCentre = $derived(toRuntime(contract.threshold.blenderCentre));
  const waterDoor = $derived(toRuntime(contract.doors.water.blender));

  /**
   * On the threshold centre, across the line of travel, so the visitor sees it
   * on arrival and then walks over it. The first pass split the difference back
   * toward the door and put it directly under the spawn, where the one piece of
   * dressing that names the Water-to-Fire seam was the one piece nobody saw.
   */
  const ventPosition = $derived<[number, number]>(thresholdCentre);
  const ventYaw = $derived(
    Math.atan2(
      thresholdCentre[0] - waterDoor[0],
      thresholdCentre[1] - waterDoor[1]
    )
  );
</script>

{#if lit && centreline.length > 1}
  <!-- ===== Water threshold: the quench vent =====
       Lifted by its own sink depth. The vent is authored as a slot cut into the
       floor, and the graybox floor is a solid slab with no hole in it - sunk at
       y=0 the entire station renders inside the slab, which is why the first
       pass produced no grate, no up-light and no steam. Standing it on the
       floor turns the slot into a housing the visitor steps over, which reads
       the same and needs no hole. -->
  <T.Group
    position={[ventPosition[0], VENT_SINK, ventPosition[1]]}
    rotation.y={ventYaw}
  >
    <FirstFireSteamVent
      width={3.4}
      depth={1.3}
      sink={VENT_SINK}
      ceilingY={CEILING_Y - VENT_SINK}
      material={iron}
    />
  </T.Group>

  <!-- ===== Transfer corridor: cribbing down both sides ===== -->
  <!-- A bay's face is its local +Z, and `yaw` points along the walk, so each
       side turns the OPPOSITE quarter to look back across the centreline. Turn
       them the same way and both runs present their backs to the visitor. -->
  {#each leftCrib as bay, i (`l${i}`)}
    <T.Group position={[bay.x, 0, bay.z]} rotation.y={bay.yaw - Math.PI / 2}>
      <FirstFireCoalWall
        bayWidth={CRIB_BAY}
        height={CRIB_HEIGHT}
        lumpsPerBay={640}
        relief={CRIB_RELIEF}
        lightIntensity={1.5}
        lightDistance={5}
        seed={17 + i * 5}
        material={iron}
      />
    </T.Group>
  {/each}
  {#each rightCrib as bay, i (`r${i}`)}
    <T.Group position={[bay.x, 0, bay.z]} rotation.y={bay.yaw + Math.PI / 2}>
      <FirstFireCoalWall
        bayWidth={CRIB_BAY}
        height={CRIB_HEIGHT}
        lumpsPerBay={640}
        relief={CRIB_RELIEF}
        lightIntensity={1.5}
        lightDistance={5}
        seed={83 + i * 5}
        material={iron}
      />
    </T.Group>
  {/each}

  <!-- ===== Lamps marking the way ===== -->
  {#each lamps as lamp, i (`c${i}`)}
    <T.Group position={[lamp.x, 0, lamp.z]}>
      <FirstFireCoalLamp
        ceilingY={CEILING_Y}
        basketY={2.55}
        lightIntensity={i === dripAt ? 9 : 7.5}
        dripCount={i === dripAt ? 14 : 0}
      />
    </T.Group>
  {/each}
{/if}
