import { BackgroundType } from "@austencloud/backgrounds";

/**
 * The scene component chunk each 3D environment mounts.
 *
 * `scene-asset-manifest.ts` covers the models a scene downloads; this covers
 * the JavaScript that downloads them. Environment3D reaches its scenes through
 * `import()`, so switching to a scene the session has never shown starts with a
 * cold module fetch, and only once that lands does the GLB request begin. That
 * serial chain is the front of the switch the user waits through, and it is
 * entirely removable: the specifiers below resolve to the same modules, so Vite
 * emits one chunk per scene and warming it here means Environment3D's own
 * `import()` resolves from the module cache.
 *
 * Import specifiers must stay identical to Environment3D's, or the two resolve
 * to different chunks and the warm-up buys nothing.
 * `tests/unit/scene-boot/scene-module-prefetch-contract.test.ts` reads that
 * component and fails when they drift.
 */
const SCENE_MODULE_LOADERS: Readonly<
  Record<BackgroundType, (() => Promise<unknown>) | null>
> = {
  [BackgroundType.AUTUMN]: () =>
    import("../environments/scenes/AutumnScene.svelte"),
  [BackgroundType.BLOSSOM]: () =>
    import("../environments/scenes/BlossomScene.svelte"),
  [BackgroundType.CELESTIAL]: () =>
    import("../environments/scenes/CelestialScene.svelte"),
  [BackgroundType.COSMIC]: () =>
    import("../environments/scenes/CosmicScene.svelte"),
  [BackgroundType.EMBER]: () =>
    import("../environments/scenes/EmberScene.svelte"),
  [BackgroundType.FOREST]: () =>
    import("../environments/scenes/ForestScene.svelte"),
  [BackgroundType.OCEAN]: () =>
    import("../environments/scenes/ocean/OceanScene.svelte"),
  [BackgroundType.PRIDE]: () =>
    import("../environments/scenes/RainbowScene.svelte"),
  [BackgroundType.VOID]: () =>
    import("../environments/scenes/VoidScene.svelte"),
  [BackgroundType.WINTER]: () =>
    import("../environments/scenes/WinterScene.svelte"),
};

const requested = new Set<BackgroundType>();

/**
 * Start the scene's chunk downloading. Repeat calls are free — hovering a tile
 * a dozen times must not queue a dozen fetches — and a failure is left to the
 * normal mount path to surface, because nothing visible depends on this.
 */
export function warmSceneModule(background: BackgroundType): void {
  if (requested.has(background)) return;
  const load = SCENE_MODULE_LOADERS[background];
  if (!load) return;
  requested.add(background);
  void load().catch(() => {
    requested.delete(background);
  });
}

export function _resetForTests(): void {
  requested.clear();
}
