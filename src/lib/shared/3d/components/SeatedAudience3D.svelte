<script lang="ts">
  /**
   * SeatedAudience3D
   *
   * Renders an arc of real Mixamo avatars on the downstage (+Z) side
   * of the stage, each playing a sitting-idle animation. Variety comes
   * from six different character GLBs, two idle animation variants
   * alternated per seat, per-seat time offsets for desync, and mild
   * scale jitter.
   */

  import { T } from "@threlte/core";
  import { onMount } from "svelte";
  import { userProportionsState } from "../state/user-proportions-state.svelte";
  import { seatedAudienceLoader } from "../services/implementations/SeatedAudienceLoader";
  import SeatedFigure3D from "./SeatedFigure3D.svelte";
  import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";

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

  // Preload FBX animations so retargeting is fast once GLBs finish
  onMount(() => {
    seatedAudienceLoader.preloadAnimations(ANIMATION_URLS).then(() => {
      sceneFeatures?.reportReady("audience");
    });
  });
</script>

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
