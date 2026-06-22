<script lang="ts" module>
  import type { MeshStandardMaterial } from "three";

  /**
   * One glow target the interaction layer can pulse.
   *
   * The orchestrator (Task 13) assembles these. Both upstream producers emit
   * bare `MeshStandardMaterial[]` with NO position:
   *   - WillOWisps.svelte → onWispMaterials (core mats; their owning Group
   *     drifts every frame, so a wisp's "position" is its live Group, not a
   *     fixed point).
   *   - authored/AutumnFlora.svelte → onMushroomMaterials (cloned emissive mats
   *     belonging to scattered cloned scene graphs; positions live in the
   *     mushroom *placement* data, not on the material).
   *
   * So proximity pulsing needs a position paired with each material, and only
   * the orchestrator holds both halves. It pairs them into PulseTarget[]:
   *   - mushrooms: pass the mushroom placement world position (static).
   *   - wisps: pass the wisp Group's `position` Vector3 (mutated in place each
   *     frame by WillOWisps' drift task) — because it's the SAME Vector3
   *     instance, this layer reads the live drifting position for free, no sync.
   *
   * `baseIntensity` is the material's resting `emissiveIntensity` (wisp 1.2,
   * mushroom 0.8 at time of writing) — the value glow decays back to.
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
  import { Raycaster, Vector2, Vector3, Plane } from "three";

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

  // ── Renderer/camera accessors (mirror OceanInteraction's `.current ??`) ──

  function getGl(): import("three").WebGLRenderer | undefined {
    return (renderer as any)?.current ?? (renderer as any);
  }

  function getCam(): import("three").Camera | undefined {
    return (camera as any)?.current ?? (camera as any);
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
