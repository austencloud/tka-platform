<script lang="ts">
  /**
   * Graybox shell for the Moon — the Vulcan Cave moon bay, and the Sun's
   * inversion.
   *
   * EVERY radius, elevation and blocked region below comes off
   * buildMoonLayout(grid). There is not one world coordinate in this file. If a
   * shape here disagrees with where physics puts the player, the layout is
   * wrong, not this file.
   *
   * Two things carry the room, and both are the Sun's opposite:
   *
   * ONE HARD LIGHT. A single white directional key, fixed — it does not track
   * the visitor, because the Sun room's whole mechanism was a sun the visitor
   * drives and this room is what that mechanism is not. Fill is nearly zero, so
   * shadows go to near-black. That is the physical difference between standing
   * in air and standing in vacuum, and it is what makes the two rooms read as
   * opposites at a glance rather than as the same room in a different colour.
   *
   * A HOLE IN THE FLOOR. The plain is a ShapeGeometry with a real hole punched
   * in it at the arrival, not a disc with a dark decal — so the shaft below is
   * genuinely seen through it, and the Sun's plinth genuinely sits inside it
   * with a gap all the way round. The visitor arrives by coming UP through it.
   *
   * Nothing here spirals. Sun is quarter-time / same-direction and therefore
   * four-fold chiral; Moon is quarter-time / opposite-direction and therefore
   * four-fold MIRRORED. The plan reflects about the arrival axis and holds
   * still.
   */
  import { T } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    BoxGeometry,
    CylinderGeometry,
    DirectionalLight,
    DoubleSide,
    MeshBasicMaterial,
    MeshStandardMaterial,
    Path,
    Shape,
    ShapeGeometry,
    SphereGeometry,
  } from "three";
  import type { MuseumGrid } from "../../domain/museum-grid-types";
  import {
    buildMoonLayout,
    MOON_FLOOR_Y,
    MOON_ROOM_ID,
    type MoonLayout,
  } from "../../data/moon-layout";
  import type { WorldRect } from "../../data/drowned-gallery-terrain";
  // The lunar sky, borrowed rather than rebuilt. See the sky block in the
  // markup for why, and for what is deliberately NOT taken from it.
  import Starfield from "$lib/shared/3d/environments/primitives/Starfield.svelte";
  import EarthSphere from "$lib/shared/3d/environments/scenes/cosmic/EarthSphere.svelte";
  import EarthGodRays from "$lib/shared/3d/environments/scenes/cosmic/EarthGodRays.svelte";
  import NebulaLayer from "$lib/shared/3d/environments/scenes/cosmic/NebulaLayer.svelte";
  import MeteorStreaks from "$lib/shared/3d/environments/scenes/cosmic/MeteorStreaks.svelte";
  import { createDefaultCosmicNightConfig } from "$lib/shared/3d/environments/domain/models/scene-configs";

  interface Props {
    grid: MuseumGrid;
    /** Room the player is standing in; the key light idles when they are elsewhere. */
    currentRoomId?: string | null;
    visible?: boolean;
  }
  const {
    grid,
    currentRoomId = null,
    visible = true,
  }: Props = $props();

  // ── Palette ───────────────────────────────────────────────────────────────
  // Regolith is not grey-blue moonlight — that is what the Moon looks like from
  // Earth, through air. Standing on it, it is a warm-neutral dust, and the only
  // reason it reads as cold is that nothing is scattering the light.
  const REGOLITH = "#8e8a82";
  const RIM_ROCK = "#4b4741";
  /** The Sun's stone, carried up through the floor. Warmer than anything else here. */
  const SUN_STONE = "#b4a184";
  const MOUND = "#9a958b";
  const SHAFT = "#151312";
  const KEY_COLOUR = "#ffffff";

  /** How high the crater rim stands. Above eye height on purpose: the horizon
   *  is rock, the sky is the only thing above it, and a rim you can see over
   *  turns the plain back into a room with walls. */
  const RIM_HEIGHT = 2.4;

  /**
   * The cosmic scene's own night config. Its numbers are taken rather than
   * re-tuned, so this room and the Cosmic background read as the same Moon —
   * same Earth, same starfield density — instead of two authors' guesses at
   * one.
   *
   * ONE value is overridden, and honestly: Earth's position. The cosmic scene
   * hangs it at `[-40, 2, -60]`, which is nearly on its horizon — fine on an
   * open performance platform, invisible here behind a 2.4 m crater rim. It is
   * lifted into the sky so a visitor standing in a walled crater can actually
   * see the thing the room exists to show them. Distance is kept close to the
   * original so its apparent size does not change.
   */
  const cosmicDefaults = createDefaultCosmicNightConfig();
  const cosmic = {
    ...cosmicDefaults,
    earth: { ...cosmicDefaults.earth, position: [-30, 34, -45] as [number, number, number] },
  };
  const meteors = cosmic.particles?.effects?.meteorStreaks;
  /** How far the arrival shaft is drawn down before it goes to black. */
  const SHAFT_DEPTH = 7;
  const SLAB_T = 0.3;

  // ── Shared geometry + materials ───────────────────────────────────────────
  const unitBox = new BoxGeometry(1, 1, 1);

  const materials = {
    regolith: new MeshStandardMaterial({
      color: REGOLITH,
      roughness: 1,
      side: DoubleSide,
    }),
    rim: new MeshStandardMaterial({ color: RIM_ROCK, roughness: 1 }),
    sunStone: new MeshStandardMaterial({ color: SUN_STONE, roughness: 0.8 }),
    mound: new MeshStandardMaterial({ color: MOUND, roughness: 1 }),
    shaft: new MeshStandardMaterial({
      color: SHAFT,
      roughness: 1,
      side: DoubleSide,
    }),
    // The sky is not lit and must never be — it is the absence of atmosphere.
    sky: new MeshBasicMaterial({ color: "#000000", side: DoubleSide }),
  } as const;

  type MaterialKey = keyof typeof materials;

  onDestroy(() => {
    unitBox.dispose();
    for (const m of Object.values(materials)) m.dispose();
  });

  const cx = (r: WorldRect) => (r.minX + r.maxX) / 2;
  const cz = (r: WorldRect) => (r.minZ + r.maxZ) / 2;
  const sx = (r: WorldRect) => r.maxX - r.minX;
  const sz = (r: WorldRect) => r.maxZ - r.minZ;

  interface Box {
    id: string;
    pos: [number, number, number];
    size: [number, number, number];
    material: MaterialKey;
  }

  function slab(id: string, r: WorldRect, topY: number, material: MaterialKey): Box {
    return {
      id,
      pos: [cx(r), topY - SLAB_T / 2, cz(r)],
      size: [Math.max(sx(r), 0.01), SLAB_T, Math.max(sz(r), 0.01)],
      material,
    };
  }

  // ── The plain ─────────────────────────────────────────────────────────────
  //
  // A Shape with a Path hole. Not decoration: the hole in the mesh IS the hole
  // in the room, so the shaft is seen through the floor rather than painted on
  // it, and it can never drift out of register with the layout's arrival.
  function plainGeometry(l: MoonLayout): ShapeGeometry {
    const outline = new Shape();
    outline.absarc(0, 0, l.chamberRadius, 0, Math.PI * 2, false);
    const hole = new Path();
    // ShapeGeometry is authored in XY and rotated -90° about X to lie flat,
    // which flips the Z axis — so the hole's local Y is the NEGATED world
    // offset in Z. Getting this backwards puts the hole on the wrong side of
    // the room and nothing else looks wrong.
    hole.absarc(
      l.arrival.x - l.centre.x,
      -(l.arrival.z - l.centre.z),
      l.arrivalHoleRadius,
      0,
      Math.PI * 2,
      true
    );
    outline.holes.push(hole);
    return new ShapeGeometry(outline, 96);
  }

  /**
   * The crater rim, minus a gap at each real door approach. Three.js cylinder
   * theta shares this room's bearing convention — `x = r·sin θ, z = r·cos θ` —
   * so a bearing goes straight into `thetaStart`.
   */
  interface Arc {
    id: string;
    thetaStart: number;
    thetaLength: number;
  }

  function rimArcs(gaps: { centre: number; half: number }[]): Arc[] {
    const norm = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const sorted = gaps
      .map((g) => ({ from: norm(g.centre - g.half), to: norm(g.centre + g.half) }))
      .sort((a, b) => a.from - b.from);
    const arcs: Arc[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const start = sorted[i]!.to;
      const end = sorted[(i + 1) % sorted.length]!.from;
      let length = end - start;
      if (length <= 0) length += Math.PI * 2;
      if (length > 0.02) {
        arcs.push({ id: `moon-rim-${i}`, thetaStart: start, thetaLength: length });
      }
    }
    return arcs;
  }

  interface Scene {
    plain: ShapeGeometry;
    plinth: CylinderGeometry;
    shaft: CylinderGeometry;
    mound: CylinderGeometry;
    sky: SphereGeometry;
    boxes: Box[];
    arcs: Arc[];
  }

  function buildScene(l: MoonLayout): Scene {
    // The two door approaches. These are the ONLY rectangles drawn as floor,
    // and each is the exact band `blockedAt` opens through the rock — so
    // everything the visitor can see to stand on, they can stand on.
    const band = l.doorBand;
    const boxes: Box[] = [
      slab(
        "moon-approach-west",
        {
          minX: l.interior.minX,
          maxX: l.centre.x - l.chamberRadius + 0.2,
          minZ: band.minZ,
          maxZ: band.maxZ,
        },
        MOON_FLOOR_Y,
        "regolith"
      ),
      slab(
        "moon-approach-east",
        {
          minX: l.centre.x + l.chamberRadius - 0.2,
          maxX: l.interior.maxX,
          minZ: band.minZ,
          maxZ: band.maxZ,
        },
        MOON_FLOOR_Y,
        "regolith"
      ),
    ];

    // The rim gaps are the door band's own angular half-width at the rim
    // radius, not a hand-picked constant — so the opening in the rock is
    // exactly as wide as the floor that runs through it.
    const half = Math.atan2((band.maxZ - band.minZ) / 2, l.chamberRadius);
    const arcs = rimArcs([
      { centre: -Math.PI / 2, half },
      { centre: Math.PI / 2, half },
    ]);

    return {
      plain: plainGeometry(l),
      plinth: new CylinderGeometry(l.arrivalRadius, l.arrivalRadius, 1, 48),
      shaft: new CylinderGeometry(
        l.arrivalHoleRadius,
        l.arrivalHoleRadius,
        1,
        48,
        1,
        true
      ),
      mound: new CylinderGeometry(1, 1, 1, 32),
      // Upper hemisphere only, centred on the plain and mounted only while the
      // visitor is in this room, so it can never black out its neighbours.
      // 90 m, and that is load-bearing: the cosmic starfield is a 75 m shell,
      // the nebula 70 m and Earth ~64 m out. At the original 48 the dome sat
      // IN FRONT of all three and the sky was simply black.
      sky: new SphereGeometry(90, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      boxes,
      arcs,
    };
  }

  const layout = $derived(buildMoonLayout(grid));
  const scene = $derived(layout ? buildScene(layout) : null);

  $effect(() => {
    const current = scene;
    return () => {
      if (!current) return;
      current.plain.dispose();
      current.plinth.dispose();
      current.shaft.dispose();
      current.mound.dispose();
      current.sky.dispose();
    };
  });

  const inRoom = $derived(currentRoomId === MOON_ROOM_ID);
  const lit = $derived(visible && (currentRoomId === null || inRoom));

  // ── The key ───────────────────────────────────────────────────────────────
  //
  // One hard white sun, low and from the east so the mounds throw long shadows
  // WEST across the plain, toward the arrival — the visitor surfaces looking
  // down the shadows rather than at their tips. Fitted to the plain, not the
  // bay: a shadow map stretched over the corridors spends its resolution on
  // rock nobody looks at.
  const KEY_DISTANCE = 45;
  const KEY_ELEVATION_DEG = 22;
  const KEY_BEARING = Math.PI / 2; // east
  const key = new DirectionalLight(KEY_COLOUR, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -13;
  key.shadow.camera.right = 13;
  key.shadow.camera.top = 13;
  key.shadow.camera.bottom = -13;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 90;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.05;
  // three.js will not recompute the projection matrix for a frustum set after
  // construction, and a stale -5..5 box shadows a 10 m sliver of a 20 m plain.
  key.shadow.camera.updateProjectionMatrix();
  onDestroy(() => key.dispose());

  $effect(() => {
    if (!layout) return;
    const elevation = (KEY_ELEVATION_DEG * Math.PI) / 180;
    const cosE = Math.cos(elevation);
    key.position.set(
      layout.centre.x + Math.sin(KEY_BEARING) * cosE * KEY_DISTANCE,
      Math.sin(elevation) * KEY_DISTANCE,
      layout.centre.z + Math.cos(KEY_BEARING) * cosE * KEY_DISTANCE
    );
    key.target.position.set(layout.centre.x, 0, layout.centre.z);
    key.target.updateMatrixWorld();
    key.intensity = lit ? 4.2 : 0;
  });
</script>

{#if scene && layout}
  <T.Group {visible}>
    <!-- The regolith plain, with the arrival punched clean through it -->
    <T.Mesh
      geometry={scene.plain}
      material={materials.regolith}
      position={[layout.centre.x, MOON_FLOOR_Y, layout.centre.z]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    />

    <!-- The two door approaches: the only rectangles drawn as floor here, and
         each one exactly the band `blockedAt` opens through the rock -->
    {#each scene.boxes as box (box.id)}
      <T.Mesh
        geometry={unitBox}
        material={materials[box.material]}
        position={box.pos}
        scale={box.size}
        receiveShadow
      />
    {/each}

    <!-- The shaft under the arrival. Open-ended and double-sided: what you see
         through the hole is the inside of a tube going down to the Sun. -->
    <T.Mesh
      geometry={scene.shaft}
      material={materials.shaft}
      position={[
        layout.arrival.x,
        MOON_FLOOR_Y - SHAFT_DEPTH / 2,
        layout.arrival.z,
      ]}
      scale={[1, SHAFT_DEPTH, 1]}
    />

    <!-- The Sun's own stone, sitting in the hole with a gap all the way round.
         Its top is flush with the regolith, so the seam the gravity changes at
         is a seam you can see. -->
    <T.Mesh
      geometry={scene.plinth}
      material={materials.sunStone}
      position={[layout.arrival.x, MOON_FLOOR_Y - 0.45, layout.arrival.z]}
      scale={[1, 0.9, 1]}
      castShadow
      receiveShadow
    />

    <!-- The three Quarter-Opposite stations. Low: nothing rises on the Moon. -->
    {#each layout.mounds as mound (mound.id)}
      <T.Mesh
        geometry={scene.mound}
        material={materials.mound}
        position={[mound.centre.x, mound.topY / 2, mound.centre.z]}
        scale={[mound.radius, Math.max(mound.topY, 0.01), mound.radius]}
        castShadow
        receiveShadow
      />
    {/each}

    <!-- The crater rim: the horizon is rock, and above it there is only sky.
         It CASTS, unlike the Sun chamber's wall — there the light came from
         above through a collapsed roof, so a casting wall put the whole room in
         shadow. Here the key is low and outside, and the rim's shadow reaching
         in across the dust is most of what says "no atmosphere". -->
    {#each scene.arcs as arc (arc.id)}
      <T.Mesh
        material={materials.rim}
        position={[layout.centre.x, RIM_HEIGHT / 2, layout.centre.z]}
        castShadow
        receiveShadow
      >
        <T.CylinderGeometry
          args={[
            layout.chamberRadius,
            layout.chamberRadius,
            RIM_HEIGHT,
            96,
            1,
            true,
            arc.thetaStart,
            arc.thetaLength,
          ]}
        />
      </T.Mesh>
    {/each}

    <!-- The sky. Mounted only while the visitor is standing in this room, so a
         48 m dome and a 75 m starfield can never swallow the rooms next door.

         The black dome is the backdrop, and the rest is NOT hand-rolled: the
         cosmic scene in `shared/3d/environments/scenes/cosmic` already IS a
         lunar surface — Earth hanging in the sky, a starfield, nebula and
         meteor streaks, all driven off `createDefaultCosmicNightConfig()`. The
         first version of this room drew an empty black hemisphere and called
         it the Moon while that scene sat one directory away. Austen:
         *"Look at my scenes package. Find cosmic. That's the moon."*

         Only the SKY is borrowed. The ground, the mounds and the arrival hole
         stay with this module, because they carry the room's geometry contract
         and the cosmic scene's own floor is a performance stage. -->
    {#if inRoom}
      <T.Mesh
        geometry={scene.sky}
        material={materials.sky}
        position={[layout.centre.x, MOON_FLOOR_Y - 0.5, layout.centre.z]}
      />
      <T.Group position={[layout.centre.x, MOON_FLOOR_Y, layout.centre.z]}>
        <Starfield config={cosmic.starfield} />
        {#if cosmic.nebula.enabled}
          <NebulaLayer config={cosmic.nebula} />
        {/if}
        <!-- Earth. The reason to look up, and the reason this room needs no
             ornament of its own: the wing's other five chambers are all
             underground, and this is the one where you can see where you came
             from. -->
        <EarthSphere config={cosmic.earth} />
        {#if cosmic.earth.enabled}
          <EarthGodRays config={cosmic.godRays} earthConfig={cosmic.earth} />
        {/if}
        <!-- Optional-chained, because `particles.effects` is not present on
             every cosmic variant. Reading it straight threw inside the group
             and took the ENTIRE sky down with it — Earth, stars and nebula all
             silently gone, with only a promise rejection in the console to say
             so. -->
        {#if meteors?.enabled}
          <MeteorStreaks config={meteors} />
        {/if}
      </T.Group>
    {/if}

    <T is={key} />
    <T is={key.target} />

    <!-- Almost nothing. This is the whole difference from the Sun room, which
         runs 0.55 of hemisphere fill so its shadow drawing stays readable. In
         vacuum there is no sky to bounce light back, so the shadowed side of
         everything goes to near-black — and that is the exhibit. -->
    <T.HemisphereLight
      position={[layout.centre.x, 20, layout.centre.z]}
      intensity={lit ? 0.05 : 0}
      color="#20242c"
      groundColor="#0a0a0b"
    />
  </T.Group>
{/if}
