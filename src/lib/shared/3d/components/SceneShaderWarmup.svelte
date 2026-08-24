<script lang="ts">
  import { tick } from "svelte";

  import { getSceneFeatureContext } from "../scene-features/context/scene-feature-context";

  interface Props {
    onReadyChange?: (ready: boolean) => void;
    waitForAllFeatures?: boolean;
    /** Reuse a completed warm-up while its keyed scene remains mounted. */
    cacheKey?: string | null;
    /** Hosts with async cast assets can hold warm-up until those settle. */
    additionalReady?: boolean;
  }

  let {
    onReadyChange,
    waitForAllFeatures = false,
    cacheKey = null,
    additionalReady = true,
  }: Props = $props();

  const sceneFeatures = getSceneFeatureContext();
  const compiledKeys = new Set<string>();

  const afterPaint = () =>
    new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  $effect(() => {
    // A streaming host lets deferred GLBs mount over the first usable frame.
    // Gated viewers wait for the initial-reveal set plus any host-owned cast
    // readiness before the two hidden warm-up frames run.
    const featuresReady = waitForAllFeatures
      ? sceneFeatures.allEnabledReady
      : sceneFeatures.allInitialRevealFeaturesReady;
    const requestedCacheKey = cacheKey;
    onReadyChange?.(false);
    if (!featuresReady || !additionalReady) return;
    if (requestedCacheKey && compiledKeys.has(requestedCacheKey)) {
      onReadyChange?.(true);
      return;
    }

    let cancelled = false;

    async function warmScene(): Promise<void> {
      // Readiness can be reported in the same update that mounts the final GLB.
      // Let Svelte attach it, then allow two real frames to render behind the
      // opaque curtain. This warms the exact path the shot uses without
      // compileAsync polling materials that effects may replace underneath it.
      await tick();
      if (cancelled) return;
      await afterPaint();
      if (cancelled) return;
      await afterPaint();

      if (!cancelled) {
        if (requestedCacheKey) compiledKeys.add(requestedCacheKey);
        onReadyChange?.(true);
      }
    }

    void warmScene();

    return () => {
      cancelled = true;
    };
  });
</script>
