/**
 * Color Extractor Utility
 * Extracts dominant color from images using canvas sampling
 * Falls back to name-based color generation if extraction fails
 */

// Cache extracted colors by URL to avoid re-processing
const colorCache = new Map<string, string>();

/**
 * Extracts the dominant vibrant color from an image URL
 * @param imageUrl - URL of the image to extract color from
 * @param fallbackName - Name to generate fallback color from
 * @returns Promise resolving to hex color string
 */
export async function extractDominantColor(
  imageUrl: string | undefined,
  fallbackName: string
): Promise<string> {
  // If no image URL, use name-based color
  if (!imageUrl) {
    return generateColorFromName(fallbackName);
  }

  // Check cache first
  const cached = colorCache.get(imageUrl);
  if (cached) {
    return cached;
  }

  try {
    const color = await extractColorFromImage(imageUrl);
    colorCache.set(imageUrl, color);
    return color;
  } catch {
    // CORS errors, load failures, etc. - fall back to name-based color
    const fallback = generateColorFromName(fallbackName);
    colorCache.set(imageUrl, fallback);
    return fallback;
  }
}

/**
 * Synchronously get cached color or generate from name
 * Useful for initial render before async extraction completes
 */
export function getCachedOrFallbackColor(
  imageUrl: string | undefined,
  fallbackName: string
): string {
  if (imageUrl && colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl)!;
  }
  return generateColorFromName(fallbackName);
}

/**
 * URLs from these domains will never return CORS headers for canvas operations.
 * Attempting to load them with crossOrigin="anonymous" produces console errors
 * that cannot be caught or suppressed. Skip them entirely.
 */
const CORS_BLOCKED_DOMAINS = [
  "googleusercontent.com",
  "ggpht.com",
];

function isCorsBlocked(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return CORS_BLOCKED_DOMAINS.some((domain) => hostname.endsWith(domain));
  } catch {
    return false;
  }
}

/**
 * Extract color from image using canvas
 */
async function extractColorFromImage(imageUrl: string): Promise<string> {
  // Google CDN and similar hosts don't serve CORS headers for anonymous requests.
  // The browser logs an uncatchable error when the image is requested with
  // crossOrigin="anonymous" and the server omits Access-Control-Allow-Origin.
  // Bail out before creating the Image element to avoid that console noise.
  if (isCorsBlocked(imageUrl)) {
    throw new Error("Skipped CORS-blocked domain");
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    // Timeout after 5 seconds
    const timeout = setTimeout(() => {
      reject(new Error("Image load timeout"));
    }, 5000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const color = sampleImageColors(img);
        resolve(color);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Image load failed"));
    };

    img.src = imageUrl;
  });
}

/**
 * Sample colors from image and find the most vibrant/dominant one
 */
function sampleImageColors(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  // Sample at small size for performance
  const sampleSize = 50;
  canvas.width = sampleSize;
  canvas.height = sampleSize;

  // Draw image scaled down
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize);

  // Get pixel data
  const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
  const pixels = imageData.data;

  // Collect color samples, focusing on vibrant colors
  const colorBuckets: Map<
    string,
    { count: number; r: number; g: number; b: number; saturation: number }
  > = new Map();

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    const a = pixels[i + 3]!;

    // Skip transparent pixels
    if (a < 128) continue;

    // Skip very dark or very light pixels (likely background)
    const brightness = (r + g + b) / 3;
    if (brightness < 30 || brightness > 225) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const saturation = max === 0 ? 0 : (max - min) / max;

    // Skip low saturation (grays)
    if (saturation < 0.2) continue;

    // Bucket colors (reduce precision for grouping)
    const bucketR = Math.round(r / 32) * 32;
    const bucketG = Math.round(g / 32) * 32;
    const bucketB = Math.round(b / 32) * 32;
    const key = `${bucketR},${bucketG},${bucketB}`;

    const existing = colorBuckets.get(key);
    if (existing) {
      existing.count++;
      // Keep running average
      existing.r = (existing.r * (existing.count - 1) + r) / existing.count;
      existing.g = (existing.g * (existing.count - 1) + g) / existing.count;
      existing.b = (existing.b * (existing.count - 1) + b) / existing.count;
      existing.saturation = Math.max(existing.saturation, saturation);
    } else {
      colorBuckets.set(key, { count: 1, r, g, b, saturation });
    }
  }

  // Find the most prominent vibrant color
  // Score by: count * saturation (prefer both common AND vibrant)
  let bestColor = { r: 139, g: 92, b: 246 }; // Default purple fallback
  let bestScore = 0;

  for (const bucket of colorBuckets.values()) {
    const score = bucket.count * (bucket.saturation + 0.5);
    if (score > bestScore) {
      bestScore = score;
      bestColor = { r: bucket.r, g: bucket.g, b: bucket.b };
    }
  }

  // Boost saturation slightly for more vibrant result
  return rgbToVibrantHex(bestColor.r, bestColor.g, bestColor.b);
}

/**
 * Convert RGB to hex, boosting saturation for vibrancy
 */
function rgbToVibrantHex(r: number, g: number, b: number): string {
  // Convert to HSL
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6;
        break;
      case gNorm:
        h = ((bNorm - rNorm) / d + 2) / 6;
        break;
      case bNorm:
        h = ((rNorm - gNorm) / d + 4) / 6;
        break;
    }
  }

  // Boost saturation (min 50%, max 85%)
  const boostedS = Math.min(0.85, Math.max(0.5, s * 1.3));
  // Normalize lightness (40-60%)
  const normalizedL = Math.min(0.6, Math.max(0.4, l));

  return hslToHex(h * 360, boostedS * 100, normalizedL * 100);
}

/**
 * Generate a consistent color from a name string
 * Same algorithm as avatar-generator.ts for consistency
 */
function generateColorFromName(name: string): string {
  const str = name || "Anonymous";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  const h = Math.abs(hash % 360);
  const s = 65 + (Math.abs(hash) % 20); // 65-85%
  const l = 45 + (Math.abs(hash >> 8) % 15); // 45-60%

  return hslToHex(h, s, l);
}

/**
 * Convert HSL to hex
 */
function hslToHex(h: number, s: number, l: number): string {
  const sDecimal = s / 100;
  const lDecimal = l / 100;

  const c = (1 - Math.abs(2 * lDecimal - 1)) * sDecimal;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lDecimal - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else if (h >= 300 && h < 360) {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Clear the color cache (useful for testing or memory management)
 */
export function clearColorCache(): void {
  colorCache.clear();
}
