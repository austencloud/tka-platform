import {
  Camera,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  type WebGLRenderer,
} from "three";

/** The ordinary scene layer rendered by the primary camera pass. */
export const BASE_SCENE_LAYER = 0;

/**
 * Performer-only layer redrawn after the environment transition veil.
 * Layer 7 is intentionally local to the viewer transition pipeline.
 */
export const PROTECTED_PERFORMER_LAYER = 7;

/**
 * Keep both the base and protected layer enabled on a performer subtree.
 * This also catches effect meshes that are added imperatively after Svelte's
 * layer plugin has initialized the declarative component tree.
 */
export function protectPerformerTree(root: Object3D): void {
  root.traverse((object) => {
    object.layers.enable(BASE_SCENE_LAYER);
    object.layers.enable(PROTECTED_PERFORMER_LAYER);
  });
}

/**
 * Draws the set veil and then redraws the protected performer layer on top.
 * The main scene, camera, and renderer are restored before returning.
 */
export class EnvironmentTransitionCompositor {
  private readonly veilScene = new Scene();
  private readonly veilCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly veilGeometry = new PlaneGeometry(2, 2);
  private readonly veilMaterial = new MeshBasicMaterial({
    color: 0x080c12,
    depthTest: false,
    depthWrite: false,
    opacity: 0,
    toneMapped: false,
    transparent: true,
  });

  constructor() {
    const veil = new Mesh(this.veilGeometry, this.veilMaterial);
    veil.frustumCulled = false;
    this.veilScene.add(veil);
  }

  render(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: Camera,
    opacity: number
  ): void {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    if (clampedOpacity <= 0) return;

    const previousAutoClear = renderer.autoClear;
    const previousCameraMask = camera.layers.mask;
    const previousBackground = scene.background;
    const previousFog = scene.fog;

    try {
      renderer.autoClear = false;
      this.veilMaterial.opacity = clampedOpacity;
      renderer.render(this.veilScene, this.veilCamera);

      // The protected pass must depth-test against itself, never against the
      // environment that was rendered before the veil.
      renderer.clearDepth();
      camera.layers.set(PROTECTED_PERFORMER_LAYER);
      scene.background = null;
      scene.fog = null;
      renderer.render(scene, camera);
    } finally {
      scene.background = previousBackground;
      scene.fog = previousFog;
      camera.layers.mask = previousCameraMask;
      renderer.autoClear = previousAutoClear;
    }
  }

  dispose(): void {
    this.veilGeometry.dispose();
    this.veilMaterial.dispose();
  }
}
