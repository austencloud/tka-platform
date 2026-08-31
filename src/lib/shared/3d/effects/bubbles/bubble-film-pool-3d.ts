import {
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
  SRGBColorSpace,
  Vector4,
} from "three";
import type { Camera, Object3D, WebGLRenderer } from "three";
import { QualityTier } from "../types";
import {
  getSceneColorSnapshot3D,
  requestSceneColorSnapshot3D,
} from "../post-processing/scene-color-snapshot-3d";
import { createBubbleFilmMaterial3D } from "./bubble-film-material-3d";

export type BubbleFilmSurface3D = "shell" | "fragment";

export interface BubbleFilmInstance3D {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  right: number;
  green: number;
  left: number;
  alpha: number;
  filmSeed: number;
  filmStrength: number;
  filmLife: number;
  deformationX: number;
  deformationY: number;
  deformationZ: number;
  deformation: number;
  ruptureOriginX: number;
  ruptureOriginY: number;
  ruptureProgress: number;
}

/**
 * One bounded draw for one bubble-film surface family. Bubble film needs
 * attributes the general particle pool does not own, so this stays local to
 * the Bubbles effect instead of widening a shared contract around one look.
 */
export class BubbleFilmPool3D {
  readonly capacity: number;
  readonly mesh: InstancedMesh;

  private readonly centers: Float32Array;
  private readonly scales: Float32Array;
  private readonly colors: Float32Array;
  private readonly alphas: Float32Array;
  private readonly film: Float32Array;
  private readonly dynamics: Float32Array;
  private readonly ruptures: Float32Array;
  private readonly attributes: readonly InstancedBufferAttribute[];
  private readonly material;
  private readonly surface: BubbleFilmSurface3D;
  private readonly order: Uint32Array;
  private readonly centerScratch: Float32Array;
  private readonly scaleScratch: Float32Array;
  private readonly colorScratch: Float32Array;
  private readonly alphaScratch: Float32Array;
  private readonly filmScratch: Float32Array;
  private readonly dynamicsScratch: Float32Array;
  private readonly ruptureScratch: Float32Array;
  private readonly viewDepths: Float32Array;
  private readonly modelViewMatrix = new Matrix4();
  private readonly viewport = new Vector4();
  private visibleCount = 0;
  private parent: Object3D | null = null;

  constructor(capacity: number, surface: BubbleFilmSurface3D = "shell") {
    this.capacity = capacity;
    this.surface = surface;
    this.material = createBubbleFilmMaterial3D(surface);
    this.centers = new Float32Array(capacity * 3);
    this.scales = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.alphas = new Float32Array(capacity);
    this.film = new Float32Array(capacity * 3);
    this.dynamics = new Float32Array(capacity * 4);
    this.ruptures = new Float32Array(capacity * 3);
    this.order = new Uint32Array(capacity);
    this.centerScratch = new Float32Array(capacity * 3);
    this.scaleScratch = new Float32Array(capacity * 3);
    this.colorScratch = new Float32Array(capacity * 3);
    this.alphaScratch = new Float32Array(capacity);
    this.filmScratch = new Float32Array(capacity * 3);
    this.dynamicsScratch = new Float32Array(capacity * 4);
    this.ruptureScratch = new Float32Array(capacity * 3);
    this.viewDepths = new Float32Array(capacity);

    // The shader reconstructs a smooth ellipsoid from this camera-facing quad.
    // Hero bubbles therefore keep a round silhouette without multiplying the
    // vertex cost across a 2,048-instance field.
    const geometry = new PlaneGeometry(2, 2, 1, 1);
    const centerAttribute = new InstancedBufferAttribute(
      this.centers,
      3
    ).setUsage(DynamicDrawUsage);
    const scaleAttribute = new InstancedBufferAttribute(
      this.scales,
      3
    ).setUsage(DynamicDrawUsage);
    const colorAttribute = new InstancedBufferAttribute(
      this.colors,
      3
    ).setUsage(DynamicDrawUsage);
    const alphaAttribute = new InstancedBufferAttribute(
      this.alphas,
      1
    ).setUsage(DynamicDrawUsage);
    const filmAttribute = new InstancedBufferAttribute(this.film, 3).setUsage(
      DynamicDrawUsage
    );
    const dynamicsAttribute = new InstancedBufferAttribute(
      this.dynamics,
      4
    ).setUsage(DynamicDrawUsage);
    const ruptureAttribute = new InstancedBufferAttribute(
      this.ruptures,
      3
    ).setUsage(DynamicDrawUsage);
    this.attributes = [
      centerAttribute,
      scaleAttribute,
      colorAttribute,
      alphaAttribute,
      filmAttribute,
      dynamicsAttribute,
      ruptureAttribute,
    ];
    geometry.setAttribute("aCenter", centerAttribute);
    geometry.setAttribute("aScale", scaleAttribute);
    geometry.setAttribute("aColor", colorAttribute);
    geometry.setAttribute("aAlpha", alphaAttribute);
    geometry.setAttribute("aFilm", filmAttribute);
    geometry.setAttribute("aDynamics", dynamicsAttribute);
    geometry.setAttribute("aRupture", ruptureAttribute);

    this.mesh = new InstancedMesh(geometry, this.material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = surface === "shell" ? 104 : 105;
    this.mesh.onBeforeRender = (renderer, _scene, camera) => {
      this.sortBackToFront(camera);
      if (this.surface === "shell" && renderer)
        this.bindSceneColor(renderer, camera);
    };
  }

  initialize(parent: Object3D): void {
    if (this.parent === parent) return;
    this.parent?.remove(this.mesh);
    this.parent = parent;
    parent.add(this.mesh);
  }

  beginFrame(timeSeconds: number): void {
    this.visibleCount = 0;
    this.material.uniforms.uTime!.value = timeSeconds;
  }

  write(instance: BubbleFilmInstance3D): boolean {
    const index = this.visibleCount;
    if (index >= this.capacity) return false;
    const i3 = index * 3;
    this.centers[i3] = instance.x;
    this.centers[i3 + 1] = instance.y;
    this.centers[i3 + 2] = instance.z;
    this.scales[i3] = instance.scaleX;
    this.scales[i3 + 1] = instance.scaleY;
    this.scales[i3 + 2] = instance.scaleZ;
    this.colors[i3] = instance.right;
    this.colors[i3 + 1] = instance.green;
    this.colors[i3 + 2] = instance.left;
    this.alphas[index] = instance.alpha;
    this.film[i3] = instance.filmSeed;
    this.film[i3 + 1] = instance.filmStrength;
    this.film[i3 + 2] = instance.filmLife;
    const i4 = index * 4;
    this.dynamics[i4] = instance.deformationX;
    this.dynamics[i4 + 1] = instance.deformationY;
    this.dynamics[i4 + 2] = instance.deformationZ;
    this.dynamics[i4 + 3] = instance.deformation;
    this.ruptures[i3] = instance.ruptureOriginX;
    this.ruptures[i3 + 1] = instance.ruptureOriginY;
    this.ruptures[i3 + 2] = instance.ruptureProgress;
    this.visibleCount++;
    return true;
  }

  commit(): void {
    if (this.visibleCount > 0) {
      for (const attribute of this.attributes) {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, this.visibleCount * attribute.itemSize);
        attribute.needsUpdate = true;
      }
    }
    this.mesh.count = this.visibleCount;
  }

  private sortBackToFront(camera: Camera): void {
    if (this.visibleCount < 2) return;
    this.modelViewMatrix.multiplyMatrices(
      camera.matrixWorldInverse,
      this.mesh.matrixWorld
    );
    const elements = this.modelViewMatrix.elements;
    const count = this.visibleCount;
    for (let index = 0; index < count; index++) {
      const i3 = index * 3;
      this.order[index] = index;
      this.viewDepths[index] =
        elements[2]! * this.centers[i3]! +
        elements[6]! * this.centers[i3 + 1]! +
        elements[10]! * this.centers[i3 + 2]! +
        elements[14]!;
    }
    this.order.subarray(0, count).sort((left, right) => {
      // Three's camera looks down negative view-space Z. More-negative film
      // is farther away and must blend first, regardless of lateral distance.
      return this.viewDepths[left]! - this.viewDepths[right]! || left - right;
    });

    this.centerScratch.set(this.centers.subarray(0, count * 3));
    this.scaleScratch.set(this.scales.subarray(0, count * 3));
    this.colorScratch.set(this.colors.subarray(0, count * 3));
    this.alphaScratch.set(this.alphas.subarray(0, count));
    this.filmScratch.set(this.film.subarray(0, count * 3));
    this.dynamicsScratch.set(this.dynamics.subarray(0, count * 4));
    this.ruptureScratch.set(this.ruptures.subarray(0, count * 3));
    for (let target = 0; target < count; target++) {
      const source = this.order[target]!;
      for (let component = 0; component < 3; component++) {
        this.centers[target * 3 + component] =
          this.centerScratch[source * 3 + component]!;
        this.scales[target * 3 + component] =
          this.scaleScratch[source * 3 + component]!;
        this.colors[target * 3 + component] =
          this.colorScratch[source * 3 + component]!;
      }
      this.alphas[target] = this.alphaScratch[source]!;
      this.film[target * 3] = this.filmScratch[source * 3]!;
      this.film[target * 3 + 1] = this.filmScratch[source * 3 + 1]!;
      this.film[target * 3 + 2] = this.filmScratch[source * 3 + 2]!;
      for (let component = 0; component < 4; component++) {
        this.dynamics[target * 4 + component] =
          this.dynamicsScratch[source * 4 + component]!;
      }
      this.ruptures[target * 3] = this.ruptureScratch[source * 3]!;
      this.ruptures[target * 3 + 1] = this.ruptureScratch[source * 3 + 1]!;
      this.ruptures[target * 3 + 2] = this.ruptureScratch[source * 3 + 2]!;
    }
    for (const attribute of this.attributes) attribute.needsUpdate = true;
  }

  clear(): void {
    this.visibleCount = 0;
    this.mesh.count = 0;
  }

  setQualityTier(tier: QualityTier): void {
    this.material.uniforms.uOpticalQuality!.value =
      tier === QualityTier.HIGH ? 1 : tier === QualityTier.MEDIUM ? 0.78 : 0.5;
  }

  private bindSceneColor(renderer: WebGLRenderer, camera: Camera): void {
    requestSceneColorSnapshot3D(renderer);
    renderer.getCurrentViewport(this.viewport);
    this.material.uniforms.uViewport!.value.copy(this.viewport);
    const snapshot = getSceneColorSnapshot3D(renderer);
    this.material.uniforms.uSceneColor!.value = snapshot?.texture ?? null;
    this.material.uniforms.uSceneDepth!.value = snapshot?.depthTexture ?? null;
    this.material.uniforms.uSceneColorReady!.value = snapshot === null ? 0 : 1;
    this.material.uniforms.uSceneDepthReady!.value =
      snapshot?.depthTexture == null ? 0 : 1;
    this.material.uniforms.uSceneColorIsSrgb!.value =
      snapshot?.colorSpace === SRGBColorSpace ? 1 : 0;
    const depthCamera = camera as Camera & { near?: number; far?: number };
    this.material.uniforms.uCameraNear!.value = depthCamera.near ?? 0.1;
    this.material.uniforms.uCameraFar!.value = depthCamera.far ?? 1000;
  }

  dispose(): void {
    this.parent?.remove(this.mesh);
    this.parent = null;
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
