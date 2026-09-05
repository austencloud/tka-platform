<script module lang="ts">
  import type { Object3D as CachedObject3D } from "three";
  import type { GLTFLoader as CachedGLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

  const sharedFloraScenes = new Map<string, Promise<CachedObject3D>>();

  function loadSharedFloraScene(
    url: string,
    loader: CachedGLTFLoader,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<CachedObject3D> {
    const existing = sharedFloraScenes.get(url);
    if (existing) return existing;

    const pending = new Promise<CachedObject3D>((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), onProgress, reject);
    }).catch((error) => {
      if (sharedFloraScenes.get(url) === pending) sharedFloraScenes.delete(url);
      throw error;
    });
    sharedFloraScenes.set(url, pending);
    return pending;
  }
</script>

<script lang="ts">
  import { T, useTask, useThrelte } from "@threlte/core";
  import { useDraco, useKtx2, useMeshopt } from "@threlte/extras";
  import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
  import type { Object3D } from "three";
  import { userProportionsState } from "@austencloud/scene-3d";
  import { page } from "$app/state";
  import type { OceanQualityConfig } from "../quality/ocean-quality";
  import { oceanDebugToggles } from "../quality/ocean-debug-toggles.svelte";
  import {
    createOceanAuthoredFloraController,
    type OceanAuthoredFloraController,
  } from "../../../worlds/ocean/ocean-authored-flora";
  import { isOceanFloraVariant, oceanFloraSceneUrl } from "./ocean-flora-url";

  interface Props {
    quality: OceanQualityConfig;
    worldYOffset?: number;
    onProgress?: (fraction: number) => void;
    onReady?: () => void;
  }

  let { quality: _quality, worldYOffset = 0, onProgress, onReady }: Props =
    $props();

  const floraVariant = $derived(page.url.searchParams.get("flora"));
  const floraGlbUrl = $derived(
    oceanFloraSceneUrl(
      isOceanFloraVariant(floraVariant) ? floraVariant : "authored"
    )
  );
  const groundY = $derived(userProportionsState.groundY + worldYOffset);
  const { camera } = useThrelte();

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(useDraco("/draco/"));
  gltfLoader.setMeshoptDecoder(useMeshopt());
  gltfLoader.setKTX2Loader(useKtx2("/basis/"));

  let floraScene = $state<Object3D | null>(null);
  let floraController: OceanAuthoredFloraController | null = null;

  $effect(() => {
    const url = floraGlbUrl;
    let cancelled = false;

    void loadSharedFloraScene(url, gltfLoader, (progress) => {
      if (cancelled || !progress.total) return;
      onProgress?.(progress.loaded / progress.total);
    })
      .then((scene) => {
        if (cancelled) return;
        floraController = createOceanAuthoredFloraController(scene, {
          groundY,
          swayEnabled: oceanDebugToggles.sway,
        });
        floraScene = scene;
        onProgress?.(1);
        onReady?.();
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[FloraInstances] Failed to load ocean flora scene:", error);
        onReady?.();
      });

    return () => {
      cancelled = true;
      floraController?.dispose();
      floraController = null;
      floraScene = null;
    };
  });

  $effect(() => floraController?.setGroundY(groundY));
  $effect(() => floraController?.setSwayEnabled(oceanDebugToggles.sway));

  useTask((delta) => {
    if (!floraController || !camera.current) return;
    floraController.update(delta, camera.current);
  });
</script>

<!-- The authored flora shares Blender's exact world transform with the seabed. -->
{#if floraScene}
  <T is={floraScene} dispose={false} />
{/if}
