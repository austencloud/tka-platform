<script lang="ts">
  import { T, useTask } from "@threlte/core";
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
    baseY: number;
    baseZ: number;
    speed: number;
    phase: number;
    bobAmplitude: number;
    driftRadius: number;
  }

  // One shared unit sphere — scaled per-mesh, disposed once.
  const sharedCoreGeo = untrack(() => new SphereGeometry(1, 12, 12));

  // Build wisp configs/groups/materials ONCE. wispCount: 4 low / 6 med / 9 high.
  const wisps: Wisp[] = untrack(() => {
    const count = quality.wispCount;
    const built: Wisp[] = [];
    for (let i = 0; i < count; i++) {
      // Scatter around a ring so wisps drift between the trees.
      const angle = (i / count) * Math.PI * 2 + i * 0.37;
      const radius = 8.0 + (i % 3) * 2.0;
      // Varied hover height between ~1 and ~4 units above the ground.
      const height = 1 + ((i * 0.618) % 1) * 3;
      // Small core scale, varied per wisp. The emissive bloom supplies the halo;
      // the geometry itself should never read as a floating white ball.
      const scale = 0.008 + ((i * 0.41) % 1) * 0.006;

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
        baseY: groundY + height,
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

  useTask((delta) => {
    elapsed += delta;
    for (const wisp of wisps) {
      const t = elapsed * wisp.speed + wisp.phase;
      wisp.group.position.set(
        wisp.baseX + Math.sin(t * 0.7) * wisp.driftRadius,
        wisp.baseY + Math.sin(t) * wisp.bobAmplitude,
        wisp.baseZ + Math.cos(t * 0.5) * wisp.driftRadius
      );
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

<!-- Drifting emissive cores. Bloom carries the halo without adding several
     scene-wide point-light calculations to every ground and flora fragment. -->
{#each wisps as wisp (wisp)}
  <T
    is={wisp.group}
    position.x={wisp.baseX}
    position.y={wisp.baseY}
    position.z={wisp.baseZ}
  />
{/each}
