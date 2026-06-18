<script lang="ts">
  /**
   * SeatedAudience3D
   *
   * Renders an arc of real Mixamo avatars on the downstage (+Z) side
   * of the stage, each playing a sitting-idle animation. Variety comes
   * from six different character GLBs, two idle animation variants
   * alternated per seat, per-seat time offsets for desync, and mild
   * scale jitter.
   *
   * All GLBs, FBX clips, and remapped animation clips are preloaded
   * and pre-baked before the audience renders. The scene feature
   * registry only reports "audience" ready once every asset is cached,
   * so the SceneLoadingCurtain stays down until the audience can
   * populate with zero main-thread hitches during sequence playback.
   */

  import { T } from "@threlte/core";
  import { onMount } from "svelte";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { seatedAudienceLoader } from "@austencloud/scene-3d";
  import SeatedFigure3D from "./SeatedFigure3D.svelte";
  import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";
  import { isProduction } from "../../environment/environment-features";

  // The avatar GLBs (16–124 MB each, ~711 MB raw Mixamo) are gitignored and
  // deployed nowhere — every `/models/avatars/chXX.glb` 404s in production and
  // floods the console. They can't ship until re-exported through the Blender
  // optimization pipeline (decimate + KTX2 + Draco) and hosted on R2. Until
  // then the audience is dev-only: skip the preload and render zero seats in
  // production so no 404 fires. Re-enable by removing this guard once optimized
  // avatars live on R2 and AVATAR_URLS points at the CDN.
  const audienceDisabled = isProduction();

  interface Props {
    count?: number;
    arcRadius?: number;
    arcSpread?: number;
  }

  let {
    count = 6,
    arcRadius = 4.8,
    arcSpread = Math.PI * 0.45,
  }: Props = $props();

  const groundY = $derived(userProportionsState.groundY);

  const AVATAR_URLS = [
    "/models/avatars/ch18.glb",
    "/models/avatars/ch24.glb",
    "/models/avatars/ch34.glb",
    "/models/avatars/ch10.glb",
    "/models/avatars/ch12.glb",
    "/models/avatars/ch44.glb",
  ] as const;

  const ANIMATION_URLS = [
    "/animations/sitting-idle-a.fbx",
    "/animations/sitting-idle-b.fbx",
  ] as const;

  let sceneFeatures: ReturnType<typeof getSceneFeatureContext> | null = null;
  try {
    sceneFeatures = getSceneFeatureContext();
  } catch {
    // May be rendered outside scene feature system
  }

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
    if (audienceDisabled) return [];
    const result: Seat[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = (t - 0.5) * arcSpread;
      result.push({
        x: Math.sin(angle) * arcRadius,
        z: Math.cos(angle) * arcRadius,
        yaw: Math.PI + angle,
        sizeScale: 0.92 + ((i * 37) % 10) * 0.016,
        modelUrl: AVATAR_URLS[i % AVATAR_URLS.length]!,
        animationUrl: ANIMATION_URLS[i % ANIMATION_URLS.length]!,
        timeOffset: (i * 0.47) % 2.3,
      });
    }
    return result;
  });

  let isReady = $state(false);

  onMount(() => {
    // Production: assets aren't deployed — don't fire 404s. Report ready so the
    // SceneLoadingCurtain still lifts, just with an empty audience.
    if (audienceDisabled) {
      isReady = true;
      sceneFeatures?.reportReady("audience");
      return;
    }

    let cancelled = false;
    seatedAudienceLoader
      .preloadAll(AVATAR_URLS, ANIMATION_URLS)
      .then(() => {
        if (cancelled) return;
        isReady = true;
        sceneFeatures?.reportReady("audience");
      })
      .catch((err) => {
        console.error("[SeatedAudience3D] preload failed:", err);
        // Still report ready so the curtain can lift - better a missing
        // audience than a permanent loading state.
        if (!cancelled) sceneFeatures?.reportReady("audience");
      });
    return () => {
      cancelled = true;
    };
  });
</script>

{#if isReady}
  <T.Group position={[0, groundY, 0]}>
    {#each seats as seat, i (i)}
      <T.Group
        position={[seat.x, 0, seat.z]}
        rotation.y={seat.yaw}
        scale={seat.sizeScale}
      >
        <SeatedFigure3D
          modelUrl={seat.modelUrl}
          animationUrl={seat.animationUrl}
          timeOffset={seat.timeOffset}
        />
      </T.Group>
    {/each}
  </T.Group>
{/if}
