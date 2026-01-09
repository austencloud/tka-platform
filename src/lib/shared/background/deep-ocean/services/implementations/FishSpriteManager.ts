import { injectable } from "inversify";
import type { FishSprite } from "../../domain/models/DeepOceanModels";
import type {
  IFishSpriteManager,
  PreRenderedSprite,
} from "../contracts/IFishSpriteManager";

/** Color variant definition for pre-rendering */
interface ColorVariant {
  baseName: string;
  hueRotate: number;
  variantName: string;
}

@injectable()
export class FishSpriteManager implements IFishSpriteManager {
  // Base sprites from Kenney pack
  private readonly baseSprites: FishSprite[] = [
    { name: "Blue", path: "/assets/background/fish/kenney/fish_blue.png" },
    { name: "Orange", path: "/assets/background/fish/kenney/fish_orange.png" },
    { name: "Green", path: "/assets/background/fish/kenney/fish_green.png" },
    {
      name: "Grey Long",
      path: "/assets/background/fish/kenney/fish_grey_long_a.png",
    },
  ];

  // Color variants (pre-rendered at load time, not runtime)
  private readonly colorVariants: ColorVariant[] = [
    { baseName: "Blue", hueRotate: 30, variantName: "Teal" },
    { baseName: "Blue", hueRotate: 270, variantName: "Purple" },
    { baseName: "Orange", hueRotate: -30, variantName: "Gold" },
    { baseName: "Orange", hueRotate: 330, variantName: "Coral" },
    { baseName: "Green", hueRotate: -60, variantName: "Cyan" },
    { baseName: "Green", hueRotate: 60, variantName: "Lime" },
    { baseName: "Grey Long", hueRotate: 200, variantName: "Deep Blue Long" },
  ];

  /** Pre-rendered sprites (base + variants), ready for immediate drawing */
  private preRenderedSprites: PreRenderedSprite[] = [];

  /** Raw image cache for base sprites */
  private baseImageCache = new Map<string, HTMLImageElement>();

  private ready = false;

  async preloadSprites(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }

    // Step 1: Load all base images
    await this.loadBaseImages();

    // Step 2: Pre-render all variants to offscreen canvases
    this.preRenderAllVariants();

    this.ready = true;
  }

  private async loadBaseImages(): Promise<void> {
    const loadPromises = this.baseSprites.map((sprite) => {
      return new Promise<void>((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
          this.baseImageCache.set(sprite.name, image);
          resolve();
        };

        image.onerror = (error) => {
          console.warn(`Failed to load fish sprite: ${sprite.path}`);
          reject(error);
        };

        image.src = sprite.path;
      });
    });

    await Promise.all(loadPromises);
  }

  private preRenderAllVariants(): void {
    this.preRenderedSprites = [];

    // Add base sprites (no hue rotation)
    for (const sprite of this.baseSprites) {
      const image = this.baseImageCache.get(sprite.name);
      if (!image) continue;

      const canvas = this.createPreRenderedCanvas(image, 0);
      this.preRenderedSprites.push({
        sprite,
        canvas,
        width: image.naturalWidth,
        height: image.naturalHeight,
        hueRotate: 0,
      });
    }

    // Add color variants (pre-rendered with hue rotation)
    for (const variant of this.colorVariants) {
      const image = this.baseImageCache.get(variant.baseName);
      if (!image) continue;

      const canvas = this.createPreRenderedCanvas(image, variant.hueRotate);
      this.preRenderedSprites.push({
        sprite: { name: variant.variantName, path: "" },
        canvas,
        width: image.naturalWidth,
        height: image.naturalHeight,
        hueRotate: variant.hueRotate,
      });
    }
  }

  /**
   * Create a pre-rendered canvas with hue rotation applied once.
   * Uses OffscreenCanvas when available for better performance.
   */
  private createPreRenderedCanvas(
    image: HTMLImageElement,
    hueRotate: number
  ): HTMLCanvasElement | OffscreenCanvas {
    const width = image.naturalWidth;
    const height = image.naturalHeight;

    // Prefer OffscreenCanvas for better memory management
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx:
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;

    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext("2d");
    } else {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext("2d");
    }

    if (!ctx) {
      // Fallback to regular canvas if context fails
      const fallback = document.createElement("canvas");
      fallback.width = width;
      fallback.height = height;
      const fbCtx = fallback.getContext("2d");
      if (fbCtx) {
        fbCtx.drawImage(image, 0, 0);
      }
      return fallback;
    }

    // Apply hue rotation filter and draw
    if (hueRotate !== 0) {
      ctx.filter = `hue-rotate(${hueRotate}deg)`;
    }
    ctx.drawImage(image, 0, 0);
    ctx.filter = "none";

    return canvas;
  }

  getRandomSpriteEntry(): PreRenderedSprite | undefined {
    if (this.preRenderedSprites.length === 0) {
      return undefined;
    }

    const index = Math.floor(Math.random() * this.preRenderedSprites.length);
    return this.preRenderedSprites[index];
  }

  getAnyLoadedSpriteEntry(): PreRenderedSprite | undefined {
    return this.preRenderedSprites[0];
  }

  getMarineLifeColor(type: "fish" | "jellyfish"): string {
    if (type === "fish") {
      const colors = [
        "#3d7a8c",
        "#4a8fa3",
        "#548da0",
        "#4b8599",
        "#5a9cb5",
        "#6ba8c2",
      ];
      return colors[Math.floor(Math.random() * colors.length)] || "#3d7a8c";
    }

    // Jellyfish in soft purples, pinks, and blues
    const colors = [
      "#7d5a7a",
      "#8b6d88",
      "#946f91",
      "#866783",
      "#6b7a9d",
      "#8a7db5",
    ];
    return colors[Math.floor(Math.random() * colors.length)] || "#7d5a7a";
  }

  isReady(): boolean {
    return this.ready && this.preRenderedSprites.length > 0;
  }
}
