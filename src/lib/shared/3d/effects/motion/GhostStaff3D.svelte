<script lang="ts">
  /**
   * GhostStaff3D - beat-onset phantoms of a staff in 3D.
   *
   * Mirrors the 2D Echo2DRenderer behaviour: on each beat boundary
   * (`floor(currentStep / interval) > lastStepIndex`), captures the current
   * prop's worldPosition + worldRotation into a ring buffer. Each phantom
   * is rendered as a translucent staff-shaped mesh (cylinder) with alpha
   * that fades linearly over `decay` beats.
   *
   * Rotation convention matches Staff3D: `worldRotation * (90° around Z)`
   * to orient the vertical default cylinder horizontally.
   */

  import { T } from "@threlte/core";
  import { Vector3, Quaternion, Euler } from "three";
  import type { PropState3D } from "@austencloud/scene-3d";

  interface Props {
    /** Live prop state - read at beat onsets to capture a phantom. */
    propState: PropState3D | null;
    /** Whether the effect is active (gates both capture + render). */
    enabled: boolean;
    /** 0-1 - phantom peak alpha. */
    intensity: number;
    /** 1-8 - age (in intervals) at which a phantom is culled / alpha reaches 0. */
    decay: number;
    /** Capture interval in beats. */
    interval: number;
    /** Hex color for the phantom material. */
    color: string;
    /** Staff length in scene units. */
    staffLength: number;
    /** Staff thickness (radius) for the phantom cylinder. */
    staffRadius?: number;
    /** Current animation step index (fractional). */
    currentStep: number;
    /** Shape: "staff" = cylinder only, "tips" = small spheres at staff ends, "both" = cylinder + tip spheres. */
    shape?: "staff" | "tips" | "both";
  }

  let {
    propState,
    enabled,
    intensity,
    decay,
    interval,
    color,
    staffLength,
    staffRadius = 0.012,
    currentStep,
    shape = "staff",
  }: Props = $props();

  interface Phantom {
    id: number;
    pos: Vector3;
    quat: Quaternion;
    capturedStep: number;
  }

  // Ring buffer of captured phantoms. Kept as a reactive $state so Threlte
  // re-renders when we push/splice; Vector3/Quaternion are treated as opaque
  // references - we never mutate them after capture.
  let phantoms = $state<Phantom[]>([]);
  let lastStepIndex = -1;
  let nextId = 0;

  // Static rotation adjustment: Staff3D renders a Y-axis cylinder then
  // multiplies worldRotation by a 90° Z quaternion. Mirror that here so
  // phantoms orient identically to the live staff.
  const horizontalQuat = new Quaternion().setFromEuler(
    new Euler(0, 0, Math.PI / 2),
  );

  // Beat-onset capture. Driven by `currentStep` changes; falls back to
  // a no-op when disabled or when propState is missing.
  $effect(() => {
    if (!enabled) return;
    if (!propState) return;
    const stepNumber = Math.floor(currentStep / interval);
    if (stepNumber > lastStepIndex) {
      phantoms.push({
        id: nextId++,
        pos: propState.worldPosition.clone(),
        quat: propState.worldRotation.clone(),
        capturedStep: currentStep,
      });
      lastStepIndex = stepNumber;
    }
    // Cull. Age measured in intervals, matches the 2D renderer.
    const cullAge = decay;
    phantoms = phantoms.filter(
      (p) => (currentStep - p.capturedStep) / interval < cullAge,
    );
  });

  // Reset beat index + ring buffer when the effect toggles off so re-enabling
  // doesn't replay stale phantoms.
  $effect(() => {
    if (!enabled) {
      phantoms = [];
      lastStepIndex = -1;
    }
  });

  function computeRotation(quat: Quaternion): [number, number, number] {
    // Apply Staff3D's horizontal adjustment before extracting Euler.
    const finalQuat = quat.clone().multiply(horizontalQuat);
    const e = new Euler().setFromQuaternion(finalQuat);
    return [e.x, e.y, e.z];
  }

  function tipPositions(phantom: Phantom): { a: Vector3; b: Vector3 } {
    // Match the `calculatePropEnds` logic used elsewhere in EffectsLayer.
    const finalQuat = phantom.quat.clone().multiply(horizontalQuat);
    const worldAxis = new Vector3(0, 1, 0).applyQuaternion(finalQuat);
    const half = staffLength / 2;
    return {
      a: phantom.pos.clone().add(worldAxis.clone().multiplyScalar(half)),
      b: phantom.pos.clone().add(worldAxis.clone().multiplyScalar(-half)),
    };
  }
</script>

{#if enabled}
  {#each phantoms as phantom (phantom.id)}
    {@const age = (currentStep - phantom.capturedStep) / interval}
    {@const alpha = intensity * Math.max(0, 1 - age / decay)}
    {#if alpha > 0}
      {#if shape === "staff" || shape === "both"}
        <T.Mesh
          position={[phantom.pos.x, phantom.pos.y, phantom.pos.z]}
          rotation={computeRotation(phantom.quat)}
        >
          <T.CylinderGeometry
            args={[staffRadius, staffRadius, staffLength, 12, 1]}
          />
          <T.MeshBasicMaterial
            {color}
            transparent
            opacity={alpha}
            depthWrite={false}
          />
        </T.Mesh>
      {/if}
      {#if shape === "tips" || shape === "both"}
        {@const ends = tipPositions(phantom)}
        <T.Mesh position={[ends.a.x, ends.a.y, ends.a.z]}>
          <T.SphereGeometry args={[staffRadius * 2.5, 10, 10]} />
          <T.MeshBasicMaterial
            {color}
            transparent
            opacity={alpha}
            depthWrite={false}
          />
        </T.Mesh>
        <T.Mesh position={[ends.b.x, ends.b.y, ends.b.z]}>
          <T.SphereGeometry args={[staffRadius * 2.5, 10, 10]} />
          <T.MeshBasicMaterial
            {color}
            transparent
            opacity={alpha}
            depthWrite={false}
          />
        </T.Mesh>
      {/if}
    {/if}
  {/each}
{/if}
