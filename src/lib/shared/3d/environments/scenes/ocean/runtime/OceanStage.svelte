<script lang="ts">
  import { getSceneFeatureContext } from "../../../../scene-features/context/scene-feature-context";
  import RuinsPlatform from "./RuinsPlatform.svelte";

  const sceneFeatures = getSceneFeatureContext();
  const stageOn = $derived(sceneFeatures?.isEnabled("stage") ?? true);

  // Green-glow bioluminescent ruins platform — the original ocean stage values
  // (recovered from the pre-ocean-v2 monolith). Top surface sits at
  // groundY + elevation(1.0) + height(0.5) = groundY + 1.5, which is exactly the
  // OCEAN performer foot offset, so the performer stands on the platform.
  const config = $derived({
    enabled: stageOn,
    width: 8,
    depth: 6,
    height: 0.5,
    elevation: 1.0,
    stoneColor: "#1a2028",
    runeGlowColor: "#44ddaa",
    glowIntensity: 0.5,
    mossIntensity: 0.8,
    columnCount: 6,
  });
</script>

<RuinsPlatform {config} />
