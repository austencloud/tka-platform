<script lang="ts">
  /**
   * Loads and compiles the prop assets an already-visible control can equip.
   *
   * The Fire effect changes a Double Staff performer to the authored Fire
   * Staff model. Warming that model in the same Threlte cache and renderer as
   * the live scene keeps the control path to a state update instead of a
   * fetch/parse/shader-compile pipeline.
   */
  import { T, useThrelte } from "@threlte/core";
  import { useGltf } from "@threlte/extras";
  import { onMount } from "svelte";
  import { Group } from "three";
  import { PROP_MODEL_REGISTRY, PropType } from "@austencloud/scene-3d";

  import { resolveThrelteHandles } from "../scene-boot/threlte-handles";
  import { FireRenderer3D } from "../effects/fire/fire-renderer-3d";
  import { QualityTier } from "../effects/types";

  interface Props {
    onReadyChange?: (ready: boolean) => void;
  }

  let { onReadyChange }: Props = $props();

  const fireStaffEntry = PROP_MODEL_REGISTRY[PropType.FIRE_DOUBLE_STAFF];
  if (!fireStaffEntry) {
    throw new Error("Fire Double Staff is missing from PROP_MODEL_REGISTRY");
  }

  // useGltf shares the Canvas-level loader cache with every GltfProp3D. The
  // later performer mounts therefore receive the parsed source immediately.
  const fireStaff = useGltf(fireStaffEntry.modelUrl);
  const fireStaffScene = $derived($fireStaff?.scene.clone(true) ?? null);
  const threlte = useThrelte();

  onMount(() => {
    let cancelled = false;
    onReadyChange?.(false);

    void (async () => {
      try {
        const gltf = await fireStaff;
        if (cancelled) return;
        const handles = resolveThrelteHandles(threlte);
        if (!handles) throw new Error("Threlte renderer was not ready");

        // compileAsync only sees objects that exist when it traverses. The
        // scene-level Fire manager is loaded asynchronously, so compile a tiny
        // renderer with the identical material here as an unconditional shader
        // cache key. Its zero-sized instance cannot appear in the frame.
        const fireWarmupRoot = new Group();
        const fireWarmup = new FireRenderer3D(QualityTier.HIGH, {
          poolSize: 1,
          maxDynamicLights: 0,
        });
        fireWarmup.initialize(fireWarmupRoot);
        fireWarmup.primeGpuUpload();

        try {
          if (typeof handles.renderer.compileAsync === "function") {
            await Promise.all([
              handles.renderer.compileAsync(
                gltf.scene,
                handles.camera,
                handles.scene
              ),
              handles.renderer.compileAsync(
                fireWarmupRoot,
                handles.camera,
                handles.scene
              ),
            ]);
          } else {
            handles.renderer.compile(gltf.scene, handles.camera, handles.scene);
            handles.renderer.compile(
              fireWarmupRoot,
              handles.camera,
              handles.scene
            );
          }
        } finally {
          fireWarmup.dispose();
        }
      } catch (error) {
        // Asset failure must not deadlock the scene curtain. The normal
        // GltfProp3D load path remains the retry/failure owner on selection.
        console.warn("[scene-boot] interactive prop warmup failed:", error);
      } finally {
        if (!cancelled) onReadyChange?.(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  });
</script>

<!-- Keep a zero-scale clone in the live scene until teardown. Besides making
     the loader subscription explicit, this lets the ordinary whole-scene
     warmup see the exact GLTF material path used by GltfProp3D. -->
{#if fireStaffScene}
  <T.Group scale={[0, 0, 0]}>
    <T is={fireStaffScene} dispose={false} />
  </T.Group>
{/if}
