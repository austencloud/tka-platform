import {
  DynamicDrawUsage,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PlaneGeometry,
} from "three";
import type { Camera, Object3D } from "three";
import { createBubbleFilmMaterial3D } from "./bubble-film-material-3d";

export type BubbleFilmSurface3D = "shell" | "fragment";

export interface BubbleFilmInstance3D {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  red: number;
  green: number;
  blue: number;
  alpha: number;
  filmSeed: number;
  filmStrength: number;
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
  private readonly attributes: readonly InstancedBufferAttribute[];
  private readonly material;
  private readonly order: Uint32Array;
  private readonly centerScratch: Float32Array;
  private readonly scaleScratch: Float32Array;
  private readonly colorScratch: Float32Array;
  private readonly alphaScratch: Float32Array;
  private readonly filmScratch: Float32Array;
  private readonly viewDepths: Float32Array;
  private readonly modelViewMatrix = new Matrix4();
  private visibleCount = 0;
  private parent: Object3D | null = null;

  constructor(capacity: number, surface: BubbleFilmSurface3D = "shell") {
    this.capacity = capacity;
    this.material = createBubbleFilmMaterial3D(surface);
    this.centers = new Float32Array(capacity * 3);
    this.scales = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.alphas = new Float32Array(capacity);
    this.film = new Float32Array(capacity * 2);
    this.order = new Uint32Array(capacity);
    this.centerScratch = new Float32Array(capacity * 3);
    this.scaleScratch = new Float32Array(capacity * 3);
    this.colorScratch = new Float32Array(capacity * 3);
    this.alphaScratch = new Float32Array(capacity);
    this.filmScratch = new Float32Array(capacity * 2);
    this.viewDepths = new Float32Array(capacity);

    const shellDetail = capacity <= 512 ? 0 : 1;
    const geometry =
      surface === "shell"
        ? new IcosahedronGeometry(1, shellDetail)
        : new PlaneGeometry(2, 2, 1, 1);
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
    const filmAttribute = new InstancedBufferAttribute(this.film, 2).setUsage(
      DynamicDrawUsage
    );
    this.attributes = [
      centerAttribute,
      scaleAttribute,
      colorAttribute,
      alphaAttribute,
      filmAttribute,
    ];
    geometry.setAttribute("aCenter", centerAttribute);
    geometry.setAttribute("aScale", scaleAttribute);
    geometry.setAttribute("aColor", colorAttribute);
    geometry.setAttribute("aAlpha", alphaAttribute);
    geometry.setAttribute("aFilm", filmAttribute);

    this.mesh = new InstancedMesh(geometry, this.material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = surface === "shell" ? 104 : 105;
    this.mesh.onBeforeRender = (_renderer, _scene, camera) => {
      this.sortBackToFront(camera);
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
    const i2 = index * 2;
    const i3 = index * 3;
    this.centers[i3] = instance.x;
    this.centers[i3 + 1] = instance.y;
    this.centers[i3 + 2] = instance.z;
    this.scales[i3] = instance.scaleX;
    this.scales[i3 + 1] = instance.scaleY;
    this.scales[i3 + 2] = instance.scaleZ;
    this.colors[i3] = instance.red;
    this.colors[i3 + 1] = instance.green;
    this.colors[i3 + 2] = instance.blue;
    this.alphas[index] = instance.alpha;
    this.film[i2] = instance.filmSeed;
    this.film[i2 + 1] = instance.filmStrength;
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
    this.filmScratch.set(this.film.subarray(0, count * 2));
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
      this.film[target * 2] = this.filmScratch[source * 2]!;
      this.film[target * 2 + 1] = this.filmScratch[source * 2 + 1]!;
    }
    for (const attribute of this.attributes) attribute.needsUpdate = true;
  }

  clear(): void {
    this.visibleCount = 0;
    this.mesh.count = 0;
  }

  dispose(): void {
    this.parent?.remove(this.mesh);
    this.parent = null;
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
