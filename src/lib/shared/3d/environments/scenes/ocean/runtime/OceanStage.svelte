<script lang="ts">
  import { getSceneFeatureContext } from "../../../../scene-features/context/scene-feature-context";
  import RuinsPlatform from "./RuinsPlatform.svelte";

  const sceneFeatures = getSceneFeatureContext();
  const stageOn = $derived(sceneFeatures?.isEnabled("stage") ?? true);

  // The original gorgeous stage: a rectangular weathered-stone dais (8×6) with an
  // animated bioluminescent green crack network on top — a live shader that can't
  // bake to glTF, so this stays procedural (Blender-first rule's shader exception).
  //   width 8 × depth 6, slab height 0.5, elevation 0.5 → deck top at +1.0.
  //   groundOffset 1.5 = seabed surface; performer offset (1.5 + 1.0) in
  //   Viewer3DScene stands the performer on the flat deck.
  const config = $derived({
    enabled: stageOn,
    width: 8,
    depth: 6,
    height: 0.5,
    elevation: 0.5,
    stoneColor: "#1a2028",
    runeGlowColor: "#44ddaa",
    glowIntensity: 0.5,
    mossIntensity: 0.8,
    columnCount: 6,
    groundOffset: 1.5,
  });
</script>

<RuinsPlatform {config} />
