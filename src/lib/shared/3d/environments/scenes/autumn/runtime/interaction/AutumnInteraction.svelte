<script lang="ts" module>
  import type { MeshStandardMaterial } from "three";

  /**
   * One glow target the interaction layer can pulse.
   *
   * The single producer is WillOWisps.svelte → onWispTargets: the core material
   * plus its owning Group's live `position` Vector3. The Group drifts every
   * frame, and because it is the SAME Vector3 instance, this layer reads the
   * live drifting position for free with no per-frame sync. The runtime
   * composer adds `baseIntensity` from the material's resting
   * `emissiveIntensity` — the value the glow decays back to.
   *
   * The authored fairy-ring mushrooms are deliberately NOT targets, and this is
   * a property of the asset pipeline rather than an oversight. The optimizer's
   * GPU-instancing pass collapses all 16 mushroom clusters into a single
   * InstancedMesh sharing one material ("Autumn Fairy Mushroom 1"). The pulse
   * loop below writes `mat.emissiveIntensity` per target in sequence, so a set
   * of targets sharing one material resolves to "last target wins" rather than
   * "nearest wins" — and because the two rings sit ~15m apart, approaching one
   * would visibly light the other. Per-instance emissive would need a custom
   * instanced shader, which is not a trade this scene should make: runtime
   * efficiency was its weakest dimension in review. A `mushroomTargets` prop
   * used to be declared and documented here but was never supplied by anything.
   */
  export interface PulseTarget {
    material: MeshStandardMaterial;
    /**
     * World-space position used for the proximity test. May be a live
     * (mutated-in-place) Vector3 — e.g. a wisp Group's `.position` — so the
     * pulse follows moving targets without any per-frame copy.
     */
    position: import("three").Vector3;
    /** Resting emissiveIntensity the glow decays back to when the cursor is away. */
    baseIntensity: number;
  }
</script>

<script lang="ts">
  /**
   * AutumnInteraction
   *
   * The scene's premium differentiator: the forest responds to presence. As the
   * pointer moves across the forest floor, nearby will-o-wisp and mushroom
   * emissive materials brighten, then decay back to their resting glow.
   *
   * Pointer tracking + cursor-ray construction mirror
   * ocean/runtime/interaction/OceanInteraction.svelte exactly (NDC from the
   * canvas rect, `useThrelte` renderer/camera via the `.current ??` accessor,
   * window-level pointer listeners, a `useTask` loop). Where Ocean exposes the
   * raw cursor ray for boid shaders, this layer raycasts that ray against the
   * ground plane (y = groundY) to get a world-space focus point, then pulses by
   * distance from that point.
   *
   * Audio: intentionally OMITTED. ocean-audio is an ambient-track *unlock*
   * helper, not a per-event chime, and the autumn scene has no audio engine or
   * track set. A proximity chime would need a new low-latency sound source —
   * out of scope for the visual feature and not low-risk. Left as a Task 13
   * follow-up if a soft woodland chime is wanted.
   */
  import { useThrelte, useTask } from "@threlte/core";
  import { onDestroy } from "svelte";
  import {
    Raycaster,
    Vector2,
    Vector3,
    Plane,
    type Camera,
    type WebGLRenderer,
  } from "three";

  interface Props {
    /**
     * Glow targets assembled by the orchestrator (Task 13). Each pairs an
     * emissive material with its world position + resting intensity. See the
     * PulseTarget docs in the module block for how wisps vs mushrooms are paired.
     */
    targets?: PulseTarget[];
    /** Forest-floor height the cursor ray intersects to find the focus point. */
    groundY?: number;
    /** Radius (world units) within which a target lights up. */
    radius?: number;
    /** Peak emissiveIntensity boost added at the focus point (decays with distance). */
    boost?: number;
    /** Glow rise/decay rate per second toward the target intensity. Higher = snappier. */
    responsiveness?: number;
  }

  let {
    targets = [],
    groundY = 0,
    radius = 4,
    boost = 1.8,
    responsiveness = 6,
  }: Props = $props();

  const { renderer, camera } = useThrelte();

  // ── Renderer/camera accessors ───────────────────────────────────────────
  //
  // Threlte's context types are honest about the difference: `renderer` is the
  // renderer itself, while `camera` is a CurrentWritable whose value lives on
  // `.current`. This used to read `(x as any)?.current ?? (x as any)` for both,
  // which papered over that difference and contradicted AutumnScene, where the
  // same two values were cast to plain objects.

  function getGl(): WebGLRenderer | undefined {
    return renderer;
  }

  function getCam(): Camera | undefined {
    return camera.current;
  }

  // ── Pointer tracking (NDC from the canvas rect) ─────────────────────────

  let mouseOnCanvas = false;
  let lastNdcX = 0;
  let lastNdcY = 0;

  function onPointerMove(event: PointerEvent): void {
    const gl = getGl();
    const el = gl?.domElement as HTMLCanvasElement | undefined;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const cx = event.clientX;
    const cy = event.clientY;
    if (cx < rect.left || cx > rect.right || cy < rect.top || cy > rect.bottom) {
      mouseOnCanvas = false;
      return;
    }

    mouseOnCanvas = true;
    lastNdcX = ((cx - rect.left) / rect.width) * 2 - 1;
    lastNdcY = -((cy - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerLeave(): void {
    mouseOnCanvas = false;
  }

  // ── Per-frame raycast + pulse — NO per-frame allocation ─────────────────

  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0); // updated to -groundY below
  const focus = new Vector3(); // cursor focus point on the forest floor
  let focusActive = false;

  useTask((delta) => {
    const cam = getCam();

    // Resolve the cursor focus point: cast the cursor ray onto y = groundY.
    focusActive = false;
    if (cam && mouseOnCanvas) {
      // Plane is y - groundY = 0  →  normal (0,1,0), constant -groundY.
      groundPlane.constant = -groundY;
      ndc.set(lastNdcX, lastNdcY);
      raycaster.setFromCamera(ndc, cam);
      const hit = raycaster.ray.intersectPlane(groundPlane, focus);
      focusActive = hit !== null;
    }

    // Smoothly approach each target's goal intensity (rise toward boosted,
    // decay toward baseIntensity). Frame-rate-independent exponential lerp.
    const alpha = 1 - Math.exp(-responsiveness * delta);
    const invRadius = radius > 0 ? 1 / radius : 0;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]!;
      const mat = target.material;

      let goal = target.baseIntensity;
      if (focusActive) {
        // Horizontal distance from focus to the target on the floor plane.
        const dx = target.position.x - focus.x;
        const dz = target.position.z - focus.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        // Smooth falloff: smoothstep of (1 - dist/radius), 0 outside radius.
        const n = 1 - dist * invRadius;
        if (n > 0) {
          const fall = n * n * (3 - 2 * n); // smoothstep
          goal = target.baseIntensity + boost * fall;
        }
      }

      mat.emissiveIntensity += (goal - mat.emissiveIntensity) * alpha;
    }
  });

  // ── Window-level pointer listeners (registered + cleaned up) ────────────

  $effect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerleave", onPointerLeave);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
    };
  });

  // Reset every target to its resting glow when this layer unmounts, so a
  // half-pulsed material doesn't get left bright if the scene tears down.
  onDestroy(() => {
    for (const target of targets) {
      target.material.emissiveIntensity = target.baseIntensity;
    }
  });
</script>
