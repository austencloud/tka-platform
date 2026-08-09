<script lang="ts">
  import { useThrelte } from "@threlte/core";
  import { AgXToneMapping } from "three";

  const { renderer } = useThrelte();

  $effect(() => {
    const gl = renderer.current;
    if (!gl) return;
    const previousMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    gl.toneMapping = AgXToneMapping;
    gl.toneMappingExposure = 1;
    return () => {
      gl.toneMapping = previousMapping;
      gl.toneMappingExposure = previousExposure;
    };
  });
</script>
