<script lang="ts">
  /**
   * Club3D Component
   *
   * Renders a realistic 3D juggling club using LatheGeometry — a single smooth
   * mesh created by revolving a spline profile around the Y-axis. The grip
   * point sits at origin (0,0,0).
   *
   * Profile based on real juggling club proportions (Henrys Delphin reference):
   * - Knob: rounded bulge at the bottom of the handle
   * - Handle: thin cylindrical grip section
   * - Neck: smooth taper widening into the body
   * - Body/Barrel: widest point with a gentle teardrop bulge
   * - Tip: tapers to a rounded cap
   *
   * Overall length is ~65% of staff length since clubs are shorter than staves.
   */

  import { T } from "@threlte/core";
  import { Vector2, LatheGeometry, CatmullRomCurve3, Vector3 } from "three";
  import type { Prop3DProps } from "./Prop3DProps";
  import { PROP_COLORS } from "./Prop3DProps";
  import { computePropRotation } from "./prop3d-transforms";
  import { userProportionsState } from "../../state/user-proportions-state.svelte";
  import {
    LAYER_WORLD,
    LAYER_PLAYER_BODY,
  } from "$lib/shared/3d/layers/layer-constants";

  let {
    propState,
    color,
    visible = true,
    length,
    thickness,
    isActivePlayer = false,
    scale = 1,
  }: Prop3DProps = $props();

  const propLayer = $derived(isActivePlayer ? LAYER_PLAYER_BODY : LAYER_WORLD);

  const CLUB_LENGTH_RATIO = 0.65;

  const effectiveLength = $derived(
    (length ?? userProportionsState.staffLength) * CLUB_LENGTH_RATIO * scale
  );
  const baseRadius = $derived(
    (thickness ?? userProportionsState.dimensions.staffRadius) * scale
  );

  const palette = $derived(PROP_COLORS[color]);
  const rotation = $derived(computePropRotation(propState));

  // Grip ring dimensions
  const gripOuterRadius = $derived(baseRadius * 1.3);
  const gripTubeRadius = $derived(baseRadius * 0.15);

  /**
   * Build a smooth club profile using CatmullRom spline interpolation.
   *
   * We define control points as (radius, height) pairs normalized to the
   * club's effective length, then sample the spline densely for LatheGeometry.
   * The profile is rotationally symmetric — LatheGeometry handles the rest.
   *
   * Real club proportions (from Henrys Delphin, ~52cm total):
   *   Knob: 2cm ball at base
   *   Handle: 18cm thin grip (~35% of length)
   *   Neck: 4cm taper (~8%)
   *   Body: 22cm barrel with teardrop bulge (~42%)
   *   Tip: 6cm taper to rounded cap (~12%)
   */
  function buildClubProfile(len: number, rad: number): Vector2[] {
    // Control points: [radius, height] — height 0 = bottom of knob
    // Knob sits below origin; origin is at knobHeight
    const knobHeight = len * 0.04;

    const controlPoints = [
      // --- Knob (rounded bulge at bottom) ---
      new Vector3(0, 0, 0), // bottom center (closed)
      new Vector3(rad * 1.4, knobHeight * 0.5, 0), // knob widest
      new Vector3(rad * 0.9, knobHeight, 0), // knob top, narrowing into handle

      // --- Handle (thin cylindrical grip, ~35% of length) ---
      new Vector3(rad * 0.75, knobHeight + len * 0.02, 0),
      new Vector3(rad * 0.7, knobHeight + len * 0.10, 0),
      new Vector3(rad * 0.7, knobHeight + len * 0.25, 0),
      new Vector3(rad * 0.7, knobHeight + len * 0.34, 0),

      // --- Neck (smooth taper outward, ~8% of length) ---
      new Vector3(rad * 0.9, knobHeight + len * 0.38, 0),
      new Vector3(rad * 1.6, knobHeight + len * 0.42, 0),

      // --- Body/Barrel (teardrop bulge, ~42% of length) ---
      new Vector3(rad * 2.3, knobHeight + len * 0.48, 0),
      new Vector3(rad * 2.6, knobHeight + len * 0.55, 0), // peak width
      new Vector3(rad * 2.65, knobHeight + len * 0.62, 0), // widest point slightly above center
      new Vector3(rad * 2.5, knobHeight + len * 0.70, 0),
      new Vector3(rad * 2.2, knobHeight + len * 0.76, 0),

      // --- Tip taper (~12% of length) ---
      new Vector3(rad * 1.6, knobHeight + len * 0.82, 0),
      new Vector3(rad * 1.0, knobHeight + len * 0.88, 0),
      new Vector3(rad * 0.5, knobHeight + len * 0.94, 0),
      new Vector3(rad * 0.2, knobHeight + len * 0.98, 0),
      new Vector3(0, knobHeight + len, 0), // tip center (closed)
    ];

    // Interpolate with CatmullRom for smooth curves between control points
    const curve = new CatmullRomCurve3(controlPoints, false, "catmullrom", 0.5);
    const samples = curve.getPoints(80);

    // Convert to Vector2 (radius, height) for LatheGeometry and shift so
    // origin sits at the grip point (top of knob / bottom of handle)
    return samples.map((p) => new Vector2(Math.max(p.x, 0), p.y - knobHeight));
  }

  // Rebuild geometry when dimensions change
  const clubGeometry = $derived.by(() => {
    const profile = buildClubProfile(effectiveLength, baseRadius);
    const geom = new LatheGeometry(profile, 32);
    geom.computeVertexNormals();
    return geom;
  });
</script>

{#if visible}
  <T.Group {rotation} layers={propLayer}>
    <!-- Club body: single smooth lathe mesh -->
    <T.Mesh geometry={clubGeometry}>
      <T.MeshStandardMaterial
        color={palette.main}
        roughness={0.3}
        metalness={0.2}
      />
    </T.Mesh>

    <!-- Grip ring at origin (white torus where the hand holds) -->
    <T.Mesh>
      <T.TorusGeometry args={[gripOuterRadius, gripTubeRadius, 12, 24]} />
      <T.MeshStandardMaterial color="white" roughness={0.4} metalness={0.1} />
    </T.Mesh>
  </T.Group>

  <!-- Trail indicator sphere at the grip point -->
  <T.Mesh layers={propLayer}>
    <T.SphereGeometry args={[0.015, 8, 8]} />
    <T.MeshBasicMaterial color={palette.main} opacity={0.3} transparent />
  </T.Mesh>
{/if}
