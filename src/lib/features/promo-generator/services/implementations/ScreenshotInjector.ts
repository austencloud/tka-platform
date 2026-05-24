/**
 * Screenshot Injector Implementation
 *
 * Handles mapping screenshot images to the device screen mesh texture.
 * Supports dynamic texture updates for multi-screen animations.
 */

import {
  Mesh, Texture, TextureLoader, SRGBColorSpace,
  MeshBasicMaterial, FrontSide,
} from "three";
import type { ScreenshotContent } from "../../domain/promo-models";

export class ScreenshotInjector {
  private screenMesh: Mesh | null = null;
  private currentTexture: Texture | null = null;
  private textureCache: Map<string, Texture> = new Map();
  private screenshotTimeline: ScreenshotContent[] = [];
  private textureLoader: TextureLoader;

  constructor() {
    this.textureLoader = new TextureLoader();
  }

  initialize(screenMesh: Mesh): void {
    this.screenMesh = screenMesh;
  }

  async loadScreenshot(source: string): Promise<void> {
    if (!this.screenMesh) {
      throw new Error(
        "Screen mesh not initialized. Call initialize() first."
      );
    }

    const tex = await this.loadTexture(source);
    this.applyTexture(tex);
    this.currentTexture = tex;

    // Set as the only screenshot in timeline
    this.screenshotTimeline = [{ source, startTime: 0, endTime: 1 }];
  }

  async preloadScreenshots(screenshots: ScreenshotContent[]): Promise<void> {
    this.screenshotTimeline = screenshots.sort(
      (a, b) => (a.startTime || 0) - (b.startTime || 0)
    );

    // Preload all textures in parallel
    await Promise.all(
      screenshots.map(async (screenshot) => {
        if (!this.textureCache.has(screenshot.source)) {
          const texture = await this.loadTexture(screenshot.source);
          this.textureCache.set(screenshot.source, texture);
        }
      })
    );

    // Apply the first screenshot
    if (screenshots.length > 0 && screenshots[0]) {
      const firstTexture = this.textureCache.get(screenshots[0].source);
      if (firstTexture) {
        this.applyTexture(firstTexture);
        this.currentTexture = firstTexture;
      }
    }
  }

  getActiveScreenshot(normalizedTime: number): string | null {
    for (const screenshot of this.screenshotTimeline) {
      const start = screenshot.startTime ?? 0;
      const end = screenshot.endTime ?? 1;

      if (normalizedTime >= start && normalizedTime <= end) {
        return screenshot.source;
      }
    }
    return null;
  }

  updateForTime(normalizedTime: number): void {
    const activeSource = this.getActiveScreenshot(normalizedTime);
    if (!activeSource) return;

    const texture = this.textureCache.get(activeSource);
    if (texture && texture !== this.currentTexture) {
      this.applyTexture(texture);
      this.currentTexture = texture;
    }
  }

  applyTexture(texture: Texture): void {
    if (!this.screenMesh) {
      console.warn("[ScreenshotInjector] No screen mesh to apply texture to");
      return;
    }

    // Configure texture
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = true; // Most screen images need Y flip
    texture.needsUpdate = true;

    // Create or update material
    const material = this.screenMesh.material as MeshBasicMaterial;
    if (material instanceof MeshBasicMaterial) {
      material.map = texture;
      material.needsUpdate = true;
    } else {
      // Replace with basic material for screen display
      const newMaterial = new MeshBasicMaterial({
        map: texture,
        side: FrontSide,
      });
      this.screenMesh.material = newMaterial;
    }
  }

  getCurrentTexture(): Texture | null {
    return this.currentTexture;
  }

  dispose(): void {
    // Dispose all cached textures
    this.textureCache.forEach((texture) => {
      texture.dispose();
    });
    this.textureCache.clear();

    // Dispose current texture if not in cache
    if (this.currentTexture && !this.isTextureInCache(this.currentTexture)) {
      this.currentTexture.dispose();
    }

    this.currentTexture = null;
    this.screenMesh = null;
    this.screenshotTimeline = [];
  }

  private async loadTexture(source: string): Promise<Texture> {
    // Check cache first
    if (this.textureCache.has(source)) {
      return this.textureCache.get(source)!;
    }

    return new Promise((resolve, reject) => {
      // Handle data URLs
      if (source.startsWith("data:")) {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          const texture = new Texture(image);
          texture.needsUpdate = true;
          this.textureCache.set(source, texture);
          resolve(texture);
        };
        image.onerror = () => {
          reject(new Error(`Failed to load image from data URL`));
        };
        image.src = source;
        return;
      }

      // Handle URLs/paths
      this.textureLoader.load(
        source,
        (texture) => {
          this.textureCache.set(source, texture);
          resolve(texture);
        },
        undefined,
        (_error) => {
          reject(new Error(`Failed to load texture: ${source}`));
        }
      );
    });
  }

  private isTextureInCache(texture: Texture): boolean {
    for (const cached of this.textureCache.values()) {
      if (cached === texture) return true;
    }
    return false;
  }
}
