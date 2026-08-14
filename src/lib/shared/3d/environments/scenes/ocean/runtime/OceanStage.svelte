<script lang="ts">
  import { getSceneFeatureContext } from "../../../../scene-features/context/scene-feature-context";
  import RuinsPlatform from "./RuinsPlatform.svelte";

  interface Props {
    stageWidth?: number;
    stageDepth?: number;
    stageZOffset?: number;
  }

  let { stageWidth = 6, stageDepth = 6, stageZOffset = 0 }: Props = $props();

  const sceneFeatures = getSceneFeatureContext();
  const stageOn = $derived(sceneFeatures?.isEnabled("stage") ?? true);

  const BASE_WIDTH = 8;
  const BASE_DEPTH = 6;

  // The original gorgeous stage: a rectangular weathered-stone dais (8×6) with an
  // animated bioluminescent green crack network on top — a live shader that can't
  // bake to glTF, so this stays procedural (Blender-first rule's shader exception).
  //   width 8 × depth 6, slab height 0.5, elevation 0.5 → deck top at +1.0.
  //   groundOffset 1.5 = seabed surface; performer offset (1.5 + 1.0) in
  //   Viewer3DScene stands the performer on the flat deck.
  const config = $derived({
    enabled: stageOn,
    width: Math.max(BASE_WIDTH, stageWidth),
    depth: Math.max(BASE_DEPTH, stageDepth),
    height: 0.5,
    elevation: 0.5,
    // Pale reef limestone — bleached coral stone, the same material the reef is
    // built out of, so the dais belongs to the seabed instead of being imported
    // onto it. It is meant to be the brightest thing in frame: the performer
    // stands on it, and a stage the eye has to hunt for is not a stage.
    //
    // The two earlier values were both fighting the wrong problem. #1a2028 was
    // near-black and rendered as a silhouette; #5a6672 was a blue-grey chosen so
    // the Gate 2 key's falloff would show on it. Neither could work, because the
    // material wrote gl_FragColor directly and received no light at all — the
    // colour was the entire image. Now that the stone is lit, fogged and tone-
    // mapped (see ruins-shaders.ts) the base colour is albedo again and can be
    // the material it should have been from the start.
    //
    // #cdc3a8 was the first lit value and it was too high: measured on the
    // rendered deck it put the key's pool at (160,165,162) against sand at
    // (26,34,37), a 5:1 jump with almost no internal range, so the slab read as
    // a white card laid over the reef. Dropping the albedo ~45% keeps it the
    // brightest thing in frame while leaving room for the pool to have a bright
    // centre and dark corners, which is what makes it read as lit stone.
    stoneColor: "#9d9482",
    runeGlowColor: "#44ddaa",
    // Demoted from 0.5 on the theory that emissive on lit stone needs less than
    // an unlit add did, then measured: at 0.3 the crack network was invisible in
    // the frame. Emissive competes with the key's own pool here, and the pool
    // wins. 0.55 puts light back in the joints without the deck reading as a
    // circuit board -- the joints are darkened albedo, so the glow sits in a
    // recess rather than on the surface.
    glowIntensity: 0.55,
    mossIntensity: 0.8,
    columnCount: 6,
    groundOffset: 1.5,
    zOffset: stageZOffset,
  });
</script>

<RuinsPlatform {config} />
