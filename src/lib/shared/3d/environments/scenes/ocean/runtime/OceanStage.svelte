<script lang="ts">
  import { getSceneFeatureContext } from "../../../../scene-features/context/scene-feature-context";
  import RuinsPlatform from "./RuinsPlatform.svelte";

  const sceneFeatures = getSceneFeatureContext();
  const stageOn = $derived(sceneFeatures?.isEnabled("stage") ?? true);

  // Green-glow bioluminescent ruins platform — recovered colours/dimensions
  // from the pre-ocean-v2 monolith. ocean-v2's seabed sits ~1.5 above groundY,
  // so groundOffset=1.5 plants the dais ON the sand; elevation 0.5 raises the
  // deck on visible support pillars. Deck top = groundY + 1.5 + 0.5 + 0.5 = 2.5,
  // matched by the OCEAN performer offset in Viewer3DScene so the performer
  // stands on the deck. (SEABED 1.5 + DECK RISE 1.0.)
  const config = $derived({
    enabled: stageOn,
    width: 8,
    depth: 6,
    height: 0.5,
    elevation: 0.5,
    groundOffset: 1.5,
    stoneColor: "#1a2028",
    runeGlowColor: "#44ddaa",
    glowIntensity: 0.5,
    mossIntensity: 0.8,
    columnCount: 6,
  });
</script>

<RuinsPlatform {config} />
