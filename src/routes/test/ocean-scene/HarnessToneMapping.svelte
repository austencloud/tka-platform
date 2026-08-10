<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { ACESFilmicToneMapping } from "three";

  const { renderer } = useThrelte();

  $effect(() => {
    // `useThrelte().renderer` is the WebGLRenderer itself, not a store. Reading
    // `.current` gave undefined, so this component has been bailing out on
    // every run and setting nothing -- the harness was silently rendering under
    // Threlte's Canvas default (AgX) while claiming to control the grade.
    const gl = renderer;
    if (!gl) return;
    const previousMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    // Must match the ocean branch of ScenePostProcessing, which the harness
    // route does not mount. AgX was in both and was the main reason the reef
    // read as washed out: it is a low-contrast, deliberately desaturating
    // curve meant to be finished with a look LUT this scene never had, so a
    // dim underwater grade came out of it as uniform slate. Same frame under
    // ACES has orange corals, warm firelight on the ruin, and cyan jellies.
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.15;
    return () => {
      gl.toneMapping = previousMapping;
      gl.toneMappingExposure = previousExposure;
    };
  });
</script>
