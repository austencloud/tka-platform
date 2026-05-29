/**
 * CoralAssetLoader
 *
 * Loads all 69 coral silhouette PNGs from the static manifest, tints each
 * one onto an offscreen canvas using globalCompositeOperation = "source-in",
 * and groups them by depth layer for the scene renderer.
 */

import type {
  CoralAssetDefinition,
  CoralCategory,
  CoralDepthLayer,
  CoralTintPalette,
  TintedCoralAsset,
} from "../domain/coral-types";
import { DEFAULT_CORAL_TINT_PALETTE } from "../domain/coral-types";

// --------------------------------------------------------------------------
// Static manifest - runtime can't list directories
// --------------------------------------------------------------------------

const CORAL_FILENAMES: string[] = [
  // fans (28)
  "fan_05", "fan_09", "fan_10", "fan_13", "fan_15", "fan_19", "fan_20",
  "fan_21", "fan_22", "fan_23", "fan_24", "fan_27", "fan_28", "fan_29",
  "fan_30", "fan_31", "fan_33", "fan_34", "fan_36", "fan_39", "fan_41",
  "fan_44", "fan_45", "fan_46", "fan_48", "fan_49", "fan_50", "fan_51",
  // reefs (14)
  "reef_09", "reef_11", "reef_12", "reef_13", "reef_15", "reef_17",
  "reef_18", "reef_21", "reef_22", "reef_28", "reef_29", "reef_31",
  "reef_32", "reef_33", "reef_39",
  // rocks (27)
  "rock_01", "rock_16", "rock_18", "rock_19", "rock_20", "rock_21",
  "rock_23", "rock_24", "rock_25", "rock_26", "rock_27", "rock_28",
  "rock_29", "rock_32", "rock_33", "rock_34", "rock_35", "rock_36",
  "rock_38", "rock_39", "rock_40", "rock_41", "rock_42", "rock_43",
  "rock_44", "rock_45", "rock_46", "rock_48",
];

const BASE_PATH = "/images/coral/curated";

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function categoryFromFilename(filename: string): CoralCategory {
  if (filename.startsWith("fan_")) return "fan";
  if (filename.startsWith("reef_")) return "reef";
  return "rock";
}

/**
 * Map asset categories to depth layers.
 * Rocks anchor the back, reefs fill the mid-ground, fans sit in front.
 * Some overlap to keep things natural.
 */
function assignLayer(category: CoralCategory): CoralDepthLayer {
  switch (category) {
    case "rock":
      return "back";
    case "reef":
      return "mid";
    case "fan":
      return "front";
  }
}

function buildDefinitions(): CoralAssetDefinition[] {
  return CORAL_FILENAMES.map((filename) => ({
    filename,
    category: categoryFromFilename(filename),
    path: `${BASE_PATH}/${filename}.png`,
  }));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load coral: ${src}`));
    img.src = src;
  });
}

function tintImage(
  img: HTMLImageElement,
  color: string
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Draw original silhouette
  ctx.drawImage(img, 0, 0);

  // Tint: fill with color, then composite to keep only the silhouette alpha
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// --------------------------------------------------------------------------
// Implementation
// --------------------------------------------------------------------------

export class CoralAssetLoader {
  private cache: Map<CoralDepthLayer, TintedCoralAsset[]> | null = null;
  private loading = false;

  async loadAndTint(
    palette: CoralTintPalette = DEFAULT_CORAL_TINT_PALETTE
  ): Promise<Map<CoralDepthLayer, TintedCoralAsset[]>> {
    if (this.cache) return this.cache;
    if (this.loading) {
      // Wait for an in-flight load to finish
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.cache) {
            clearInterval(check);
            resolve(this.cache);
          }
        }, 50);
      });
    }

    this.loading = true;

    const definitions = buildDefinitions();

    // Load all images concurrently
    const loadResults = await Promise.allSettled(
      definitions.map(async (def) => {
        const img = await loadImage(def.path);
        return { def, img };
      })
    );

    const result = new Map<CoralDepthLayer, TintedCoralAsset[]>([
      ["back", []],
      ["mid", []],
      ["front", []],
    ]);

    for (const entry of loadResults) {
      if (entry.status !== "fulfilled") continue;

      const { def, img } = entry.value;
      const layer = assignLayer(def.category);
      const colors = palette[layer];
      const tintColor = pickRandom(colors);

      const tintedCanvas = tintImage(img, tintColor);

      const asset: TintedCoralAsset = {
        definition: def,
        canvas: tintedCanvas,
        width: tintedCanvas.width,
        height: tintedCanvas.height,
        tintColor,
      };

      result.get(layer)!.push(asset);
    }

    this.cache = result;
    this.loading = false;
    return result;
  }

  isLoaded(): boolean {
    return this.cache !== null;
  }

  cleanup(): void {
    this.cache = null;
    this.loading = false;
  }
}
