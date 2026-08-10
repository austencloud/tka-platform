<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { onDestroy, untrack } from "svelte";
  import {
    SphereGeometry,
    MeshStandardMaterial,
    Color,
    Group,
    Mesh,
    type Vector3,
  } from "three";
  import type { AutumnQualityConfig } from "../../quality/autumn-quality";
  import {
    prefersReducedMotion,
    resolveMotionScale,
  } from "../../../../primitives/motion-preference";

  interface Props {
    quality: AutumnQualityConfig;
    groundY?: number;
    /**
     * Emits one entry per wisp pairing its emissive core material with the LIVE
     * `group.position` Vector3 (mutated in place each frame by the drift task).
     * The interaction layer reads the moving position for free — no per-frame
     * copy. baseIntensity is captured downstream from material.emissiveIntensity.
     */
    onWispTargets?: (
      targets: { material: MeshStandardMaterial; position: Vector3 }[]
    ) => void;
  }

  let { quality, groundY = 0, onWispTargets }: Props = $props();

  // Cool-biased bioluminescence separates the wisps from the amber canopy.
  const WISP_COLORS = ["#68f4dc", "#b58cff", "#ffbf73"] as const;
  const BASE_EMISSIVE = 1.6;

  // ── Per-wisp drift state ─────────────────────────────────────────────

  interface Wisp {
    group: Group;
    coreMat: MeshStandardMaterial;
    baseX: number;
    /**
     * Hover height ABOVE the ground, not an absolute Y. The wisps are built
     * once and only remount on a tier change, so baking groundY in here left
     * every wisp stranded at the old height whenever the user changed their
     * proportions.
     */
    baseHeight: number;
    baseZ: number;
    speed: number;
    phase: number;
    bobAmplitude: number;
    driftRadius: number;
  }

  // One shared unit sphere — scaled per-mesh, disposed once. This reads no
  // reactive state, so it needs no untrack.
  const sharedCoreGeo = new SphereGeometry(1, 12, 12);
  const { camera } = useThrelte();

  // Build wisp configs/groups/materials ONCE. Counts live in autumn-quality.ts.
  const wisps: Wisp[] = untrack(() => {
    const count = quality.wispCount;
    const built: Wisp[] = [];
    for (let i = 0; i < count; i++) {
      // Scatter around a ring so wisps drift between the trees.
      const angle = (i / count) * Math.PI * 2 + i * 0.37;
      const radius = 8.0 + (i % 3) * 2.0;
      // Varied hover height between ~1 and ~4 units above the ground.
      const height = 1 + ((i * 0.618) % 1) * 3;
      // Core scale. The original 0.008-0.014 assumed a bloom pass supplied the
      // halo, but no bloom runs in this scene, so the bare geometry rendered as
      // 8-14mm specks indistinguishable from dead pixels. These are sized to
      // read as glowing motes at performance distance on their own.
      const scale = 0.05 + ((i * 0.41) % 1) * 0.045;

      const group = new Group();
      const wispColor = new Color(WISP_COLORS[i % WISP_COLORS.length]);

      const coreMat = new MeshStandardMaterial({
        color: wispColor,
        emissive: wispColor,
        emissiveIntensity: BASE_EMISSIVE,
        roughness: 0.3,
        transparent: true,
        opacity: 0.58,
        depthWrite: false,
      });
      const core = new Mesh(sharedCoreGeo, coreMat);
      core.scale.setScalar(scale);
      group.add(core);

      built.push({
        group,
        coreMat,
        baseX: Math.cos(angle) * radius,
        baseHeight: height,
        baseZ: Math.sin(angle) * radius,
        speed: 0.12 + i * 0.03,
        phase: i * 1.7,
        bobAmplitude: 0.3 + i * 0.06,
        driftRadius: 0.5 + i * 0.08,
      });
    }
    return built;
  });

  // ── Expose pulse targets for the interaction layer (Task 11/12) ──
  // Fire ONCE from an $effect (never from a derivation — those must stay pure).
  // Pass the LIVE group.position Vector3 so the pulse follows each drifting wisp.
  let materialsFired = false;
  $effect(() => {
    if (materialsFired) return;
    materialsFired = true;
    onWispTargets?.(
      wisps.map((w) => ({ material: w.coreMat, position: w.group.position }))
    );
  });

  // ── Drift animation ──────────────────────────────────────────────────

  let elapsed = 0;

  const reducedMotion = $derived(prefersReducedMotion());
  const motionScale = $derived(resolveMotionScale(reducedMotion));

  useTask((delta) => {
    elapsed += delta * motionScale;
    const ground = groundY;
    const activeCamera = camera.current;
    for (const wisp of wisps) {
      const t = elapsed * wisp.speed + wisp.phase;
      wisp.group.position.set(
        wisp.baseX + Math.sin(t * 0.7) * wisp.driftRadius,
        ground + wisp.baseHeight + Math.sin(t) * wisp.bobAmplitude,
        wisp.baseZ + Math.cos(t * 0.5) * wisp.driftRadius
      );

      // A 10cm wisp is a readable mote across the clearing but becomes a
      // screen-filling lavender disk if its orbit crosses the camera. Ease
      // down both scale and opacity in that near-camera interval; the wisp
      // returns at full strength by 4m and keeps the same path, count, and
      // interaction target.
      if (activeCamera) {
        const distance = wisp.group.position.distanceTo(activeCamera.position);
        const linearProximity = Math.max(
          0,
          Math.min(1, (distance - 1.2) / 2.8)
        );
        const proximity =
          linearProximity * linearProximity * (3 - 2 * linearProximity);
        wisp.group.scale.setScalar(0.25 + proximity * 0.75);
        wisp.coreMat.opacity = 0.58 * proximity;
      }
    }
  });

  // ── Cleanup ──────────────────────────────────────────────────────────

  onDestroy(() => {
    // Shared geometry disposed once; materials disposed per-wisp.
    sharedCoreGeo.dispose();
    for (const wisp of wisps) {
      wisp.coreMat.dispose();
    }
  });
</script>

<!-- Drifting emissive cores, sized to read on their own. No bloom pass runs in
     this scene, so the geometry has to carry the glow rather than relying on a
     post-process that was never wired. -->
{#each wisps as wisp (wisp)}
  <T
    is={wisp.group}
    position.x={wisp.baseX}
    position.y={groundY + wisp.baseHeight}
    position.z={wisp.baseZ}
  />
{/each}
