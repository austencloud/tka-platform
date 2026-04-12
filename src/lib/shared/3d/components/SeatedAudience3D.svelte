<script lang="ts">
  /**
   * SeatedAudience3D
   *
   * Renders an arc of real Mixamo avatars on the downstage (+Z) side of
   * the stage, each playing a sitting-idle animation. Variety comes
   * from:
   *   - Six different character GLBs, cycled per seat
   *   - Two sitting idle FBX variants, alternated per seat
   *   - Per-seat random start-time offset so the six figures fidget out
   *     of sync
   *   - Slight scale jitter
   *
   * How it works:
   *   1. A module-level `seatedAudienceLoader` caches one GLTF per
   *      avatar URL and one raw clip per FBX URL.
   *   2. On mount, the component asks the loader for N animated clones,
   *      each built from its assigned (model, animation) pair.
   *   3. Each clone is dropped into its seat's T.Group via `<T is={...}>`
   *      which lets Threlte host a pre-existing Three.js object inside
   *      its scene graph.
   *   4. A single useTask loop updates every clone's mixer each frame.
   *
   * Convention: +Z = downstage (toward audience), -Z = upstage (behind
   * performer), +X = character-right, -X = character-left, +Y = up.
   */

  import { T, useTask } from "@threlte/core";
  import { onDestroy, onMount } from "svelte";
  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import {
    seatedAudienceLoader,
    type SeatedAudienceClone,
  } from "../services/implementations/SeatedAudienceLoader";

  interface Props {
    /** Number of seated figures in the arc. Default 6. */
    count?: number;
    /**
     * Distance from world origin to each figure in meters. Should be
     * larger than the stage half-size so the audience sits outside
     * the stage, looking in. Default 2.9.
     */
    arcRadius?: number;
    /**
     * Total angular spread of the arc in radians. π*0.45 gives a
     * tight crescent directly in front of the stage that doesn't
     * wrap around the sides.
     */
    arcSpread?: number;
  }

  let {
    count = 6,
    arcRadius = 2.9,
    arcSpread = Math.PI * 0.45,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  // Six Mixamo avatars cycled through the arc so no two adjacent seats
  // share a character. Every avatar in /models/avatars/ uses the same
  // Mixamo rig, so retargeting the sitting FBX onto any of them works.
  const AVATAR_URLS = [
    "/models/avatars/ch18.glb",
    "/models/avatars/ch21.glb",
    "/models/avatars/ch22.glb",
    "/models/avatars/ch24.glb",
    "/models/avatars/ch34.glb",
    "/models/avatars/ch41.glb",
  ] as const;

  // Two sitting-idle FBX variants from Mixamo. Alternating between them
  // gives two different idle gestures in the crowd instead of all six
  // figures doing exactly the same breath / weight shift cycle.
  const ANIMATION_URLS = [
    "/animations/sitting-idle-a.fbx",
    "/animations/sitting-idle-b.fbx",
  ] as const;

  interface Seat {
    x: number;
    z: number;
    yaw: number;
    sizeScale: number;
    modelUrl: string;
    animationUrl: string;
    timeOffset: number;
  }

  const seats = $derived.by<Seat[]>(() => {
    const result: Seat[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = (t - 0.5) * arcSpread;
      result.push({
        x: Math.sin(angle) * arcRadius,
        z: Math.cos(angle) * arcRadius,
        // Each figure looks toward the performer at origin. Mixamo
        // default-forward is +Z; from the downstage arc we want to
        // look at -Z, so yaw = π + angle produces "face origin".
        yaw: Math.PI + angle,
        // Mild per-seat size jitter so the crowd doesn't read as a
        // row of clones. Deterministic by index, so the variety is
        // reproducible across renders.
        sizeScale: 0.92 + ((i * 37) % 10) * 0.016,
        modelUrl: AVATAR_URLS[i % AVATAR_URLS.length]!,
        animationUrl: ANIMATION_URLS[i % ANIMATION_URLS.length]!,
        // Deterministic desync: each seat advances its mixer a
        // different amount on spawn so the six idle cycles don't
        // breathe in perfect lockstep.
        timeOffset: (i * 0.47) % 2.3,
      });
    }
    return result;
  });

  // Reactive clone list. Starts empty; onMount fills it after the loader
  // finishes fetching the GLBs + FBXs. The {#if} in the template
  // renders nothing for empty slots during the load gap.
  let clones = $state<(SeatedAudienceClone | null)[]>([]);

  onMount(async () => {
    try {
      // Preload in parallel so all six clones spawn together rather
      // than filling in one-at-a-time as individual GLBs stream in.
      await seatedAudienceLoader.preload(AVATAR_URLS, ANIMATION_URLS);

      const result: (SeatedAudienceClone | null)[] = [];
      for (const seat of seats) {
        const c = await seatedAudienceLoader.createClone(
          seat.modelUrl,
          seat.animationUrl,
          seat.timeOffset
        );
        result.push(c);
      }
      clones = result;
    } catch (err) {
      console.error("[SeatedAudience3D] Failed to load audience assets:", err);
    }
  });

  useTask((delta) => {
    for (const c of clones) {
      c?.mixer.update(delta);
    }
  });

  onDestroy(() => {
    for (const c of clones) {
      c?.mixer.stopAllAction();
    }
  });
</script>

<!--
  Audience root at the ground level of the current environment. Each
  seat is a child group at local (x, 0, z) with its own yaw so the
  figures form an arc facing the stage. The clip was authored as a
  complete seated pose — butt at ground level, pelvis rotated forward
  for the sit — so we play it straight: no pitch correction, no lift,
  no extra rotation. The <T is={clone.root} /> binding injects the
  cloned Mixamo scene graph as-is at the seat origin.
-->
<T.Group position={[0, groundY, 0]}>
  {#each seats as seat, i (i)}
    <T.Group
      position={[seat.x, 0, seat.z]}
      rotation.y={seat.yaw}
      scale={seat.sizeScale}
    >
      {#if clones[i]?.root}
        <T is={clones[i]!.root} />
      {/if}
    </T.Group>
  {/each}
</T.Group>
