import { BackgroundType } from "@austencloud/backgrounds";

import { oceanFloraSceneUrl } from "../environments/scenes/ocean/authored/ocean-flora-url";

/**
 * What each 3D environment downloads before its loading curtain can lift, so
 * those assets can be warmed into the HTTP cache before the user clicks into 3D.
 *
 * Only URLs the scene's own components load at runtime belong here, and only
 * the ones the curtain actually waits on. Four neighbours deliberately do not:
 *
 * - `*-composer-plugin.ts` catalogs, which exist for the Scene Lab and Themes
 *   Lab authoring surfaces and are never mounted by the viewer.
 * - `scenes/winter/graybox/`, a review model reachable only from a test route.
 * - The ocean fish pack (`/models/ocean/pack/*.glb`, named as bare filenames in
 *   `fish-species.ts` and fetched by FishBoids). It reports into no scene
 *   feature, so it streams in after the reveal — warming it would compete for
 *   bandwidth with the models the curtain is waiting on.
 * - `?flora=composed`, a dev-only comparison build of the reef.
 *
 * The ocean's flora scene is the one asset not written literally below. It is
 * the bulk of that scene's boot download and it blocks the curtain, but its URL
 * is environment-dependent, so `sceneAssetUrls` appends it from the owner that
 * the renderer reads too.
 *
 * `tests/unit/scene-boot/scene-asset-manifest-contract.test.ts` reads the scene
 * sources and fails when this list drifts from them in either direction.
 */
export const SCENE_ASSET_MANIFEST: Readonly<
  Record<BackgroundType, readonly string[]>
> = {
  [BackgroundType.AUTUMN]: ["/models/autumn/autumn-environment.glb"],
  [BackgroundType.BLOSSOM]: ["/models/blossom/blossom_environment.glb"],
  [BackgroundType.CELESTIAL]: [
    "/models/celestial/seraphic-vault-integrated-sanctuaries.glb",
    "/models/celestial/olive-cloudbreak-production-slice.glb",
    "/models/celestial/cloudbreak/source/olive-west-ancient.glb",
    "/models/celestial/cloudbreak/source/olive-east-windswept.glb",
    "/models/celestial/cloudbreak/rocks/coast-rocks-05.glb",
    "/models/celestial/cloudbreak/rocks/sand-rocks-small-01.glb",
  ],
  [BackgroundType.COSMIC]: [
    "/models/cosmic/cosmic-reliquary.glb",
    "/models/cosmic/cosmic-stage.glb",
  ],
  [BackgroundType.EMBER]: [
    "/models/ember/ember-production-slice.glb",
    "/models/camping/tree-log.glb",
    "/models/camping/tree-log-small.glb",
    "/models/camping/campfire-pit.glb",
  ],
  [BackgroundType.FOREST]: [
    "/models/forest/forest-environment.glb",
    "/models/forest/forest-near-frame.glb",
    "/models/forest/forest-campsite.glb",
    "/models/forest/forest-stage.glb",
  ],
  [BackgroundType.OCEAN]: ["/models/ocean/ocean-environment.glb"],
  [BackgroundType.PRIDE]: [],
  [BackgroundType.VOID]: [],
  [BackgroundType.WINTER]: ["/models/winter/winter-environment.glb"],
};

/**
 * The compressed-texture and geometry decoders every GLB path shares. They are
 * small, cached once, and needed before the first byte of a model can be
 * decoded, so they are worth warming regardless of which scene is selected.
 */
export const DECODER_RUNTIME_URLS: readonly string[] = [
  "/draco/draco_wasm_wrapper.js",
  "/draco/draco_decoder.wasm",
  "/basis/basis_transcoder.js",
  "/basis/basis_transcoder.wasm",
];

export function sceneAssetUrls(background: BackgroundType): readonly string[] {
  const listed = SCENE_ASSET_MANIFEST[background] ?? [];
  if (background !== BackgroundType.OCEAN) return listed;
  return [...listed, oceanFloraSceneUrl()];
}
