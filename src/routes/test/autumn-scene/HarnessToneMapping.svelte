<script lang="ts">
  /**
   * HarnessToneMapping
   *
   * Sets AgX tone mapping on the live renderer for the autumn-scene
   * verification harness. AgX is the filmic default the production
   * ScenePostProcessing applies (see post-processing/ScenePostProcessing.svelte),
   * and what the ocean-way rebuild targets — so the harness reads colors the
   * same way the shipped scene will. Mounts inside the Threlte <Canvas> so
   * useThrelte() resolves the renderer.
   */
  import { useThrelte } from "@threlte/core";
  import { AgXToneMapping } from "three";

  const { renderer } = useThrelte();

  $effect(() => {
    const gl =
      (renderer as { current?: import("three").WebGLRenderer })?.current ??
      (renderer as unknown as import("three").WebGLRenderer);
    if (!gl) return;
    const prevMapping = gl.toneMapping;
    const prevExposure = gl.toneMappingExposure;
    gl.toneMapping = AgXToneMapping;
    gl.toneMappingExposure = 1.0;
    return () => {
      gl.toneMapping = prevMapping;
      gl.toneMappingExposure = prevExposure;
    };
  });
</script>
