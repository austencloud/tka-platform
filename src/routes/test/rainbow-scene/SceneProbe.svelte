<script lang="ts">
  import { useTask, useThrelte } from "@threlte/core";
  let { onSample } = $props<{ onSample: (value: string) => void }>();
  const { scene, renderer, camera } = useThrelte();
  let elapsed = 0;
  useTask((delta) => {
    elapsed += delta;
    if (elapsed < 1) return;
    elapsed = 0;
    onSample(
      JSON.stringify({
        children: scene.children.map((object) => object.name || object.type),
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        camera: camera.current.position.toArray(),
        venue: !!scene.getObjectByName("rainbow-environment-world"),
      })
    );
  });
</script>
