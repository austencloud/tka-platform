/**
 * card-back-bitmaps-constant.ts
 *
 * Rasterizers + per-key caches for the card-back elements that are CONSTANT
 * across all cards of a given theme / level / icon. Each element is rendered
 * ONCE to an ImageBitmap and reused for every card that shares the key
 * (composited later — possibly in a worker, hence ImageBitmap output).
 *
 * Constant elements covered here:
 *   - brand           (theme-constant): "The Kinetic Alphabet" + ornament + "Choreo Cards"
 *   - url             (theme-constant): ornament + "tkaflowarts.com" + "© <year>"
 *   - difficulty badge (level-constant): levels 1/2/3
 *   - loop icons      (icon-constant): the 6 LOOP component icons + quartered variants
 *
 * RENDER SCALE — single source of truth:
 *   The card back renders at 1644×2244 (822×1122 logical * scale 2).
 *   1cqi = 1644 / 100 = 16.44px. Every box size below is `<n>cqi * CQI`.
 *   Elements are mounted inside a container whose inline-size = CARD_RENDER_WIDTH
 *   (1644) so cqi units resolve identically to the live card. The bitmap crop
 *   is each element's own layout box (from card-back-layout.ts).
 *
 * PARITY: the brand/url/loop markup + styles are reproduced VERBATIM in the
 * standalone extraction components (CardBackBrand / CardBackUrl /
 * CardBackLoopIcon). DifficultyBadge / SwapIcon / CheckerboardCircleIcon are
 * the real shared components, mounted with the same props CardBack.svelte uses.
 */

import CardBackBrand from "../../components/card-back/CardBackBrand.svelte";
import CardBackUrl from "../../components/card-back/CardBackUrl.svelte";
import CardBackLoopIcon from "../../components/card-back/CardBackLoopIcon.svelte";
import DifficultyBadge from "$lib/shared/components/DifficultyBadge.svelte";
import { getCardBackThemeVisuals } from "../../components/card-back/card-back-theme-visuals";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { rasterizeComponent } from "./rasterize-node";

// ── Render scale (matches card-back-layout.ts / CardBack.svelte) ───────────
/** Card back render width in px (822 logical * scale 2). */
export const CARD_RENDER_WIDTH = 1644;
/** 1cqi in px at the card render width. */
const CQI = CARD_RENDER_WIDTH / 100; // 16.44

// ── Element box sizes (lifted from CardBack.svelte CSS via card-back-layout) ─
// .brand-slot height ≈ 11.2cqi (main 4.4cqi + gap 0.8 + ornament ~2 + gap 0.8 + sub 3.2)
const BRAND_H = 11.2 * CQI;
// .url-slot height ≈ 8cqi (ornament 1.6 + gap 0.6 + url 3.0 + gap 0.6 + year 2.2)
const URL_H = 8 * CQI;
// .level-badge DifficultyBadge size="7cqi" (7cqi square)
const BADGE_SIZE = 7 * CQI;
// .loop-icon-cell width:9cqi height:9cqi
const LOOP_CELL_SIZE = 9 * CQI;

// ── LOOP icon map (verbatim from CardBack.svelte) ──────────────────────────
/** fa class + color + label for each surfaced LOOP component. */
export const LOOP_ICONS: Record<string, { fa: string; color: string; label: string }> = {
  [LOOPComponent.ROTATED]:  { fa: "fas fa-rotate",    color: "#36c3ff", label: "Rotated" },
  [LOOPComponent.MIRRORED]: { fa: "fas fa-left-right", color: "#6F2DA8", label: "Mirrored" },
  [LOOPComponent.FLIPPED]:  { fa: "fas fa-up-down",    color: "#e91e63", label: "Flipped" },
  [LOOPComponent.SWAPPED]:  { fa: "fas fa-shuffle",    color: "#26e600", label: "Swapped" },
  [LOOPComponent.INVERTED]: { fa: "fas fa-adjust",     color: "#eb7d00", label: "Inverted" },
  [LOOPComponent.REWOUND]:  { fa: "fas fa-backward",   color: "#00bcd4", label: "Rewound" },
};

// ── Cache infrastructure ───────────────────────────────────────────────────

/**
 * The function the cache wrappers use to actually produce a bitmap. Indirection
 * exists so tests can inject a fake (real rasterization can't run in jsdom).
 */
type RasterizeFn = (
  Comp: unknown,
  props: Record<string, unknown>,
  w: number,
  h: number,
  opts?: { containerWidth?: number },
) => Promise<ImageBitmap>;

let rasterize: RasterizeFn = rasterizeComponent;

/** Test-only: swap the underlying rasterize implementation. */
export function __setRasterizeFnForTest(fn: RasterizeFn | null): void {
  rasterize = fn ?? rasterizeComponent;
}

const brandCache = new Map<string, Promise<ImageBitmap>>();
const urlCache = new Map<string, Promise<ImageBitmap>>();
const badgeCache = new Map<number, Promise<ImageBitmap>>();
const loopIconCache = new Map<string, Promise<ImageBitmap>>();

/**
 * Get-or-create against a Map cache. Stores the in-flight Promise so concurrent
 * callers for the same key share one rasterization (and so a second call with
 * the same key never invokes `produce` again).
 */
function cached<K>(
  cache: Map<K, Promise<ImageBitmap>>,
  key: K,
  produce: () => Promise<ImageBitmap>,
): Promise<ImageBitmap> {
  const existing = cache.get(key);
  if (existing) return existing;
  const created = produce();
  cache.set(key, created);
  return created;
}

// ── Brand (theme-constant) ─────────────────────────────────────────────────

/**
 * Rasterize the brand slot ("The Kinetic Alphabet" + ornament + "Choreo Cards")
 * for `theme`. Cache key: theme name.
 */
export function rasterizeBrand(theme: string): Promise<ImageBitmap> {
  return cached(brandCache, theme, () =>
    rasterize(
      CardBackBrand,
      { theme: getCardBackThemeVisuals(theme) },
      CARD_RENDER_WIDTH,
      Math.round(BRAND_H),
      { containerWidth: CARD_RENDER_WIDTH },
    ),
  );
}

// ── URL (theme-constant) ───────────────────────────────────────────────────

/**
 * Rasterize the url slot (ornament + "tkaflowarts.com" + "© <year>") for
 * `theme`. Cache key: theme name.
 */
export function rasterizeUrl(theme: string): Promise<ImageBitmap> {
  return cached(urlCache, theme, () =>
    rasterize(
      CardBackUrl,
      { theme: getCardBackThemeVisuals(theme) },
      CARD_RENDER_WIDTH,
      Math.round(URL_H),
      { containerWidth: CARD_RENDER_WIDTH },
    ),
  );
}

// ── Difficulty badge (level-constant) ──────────────────────────────────────

/**
 * Rasterize the difficulty badge for `level` (1/2/3). Cache key: level.
 *
 * CardBack.svelte mounts <DifficultyBadge size="7cqi" fontSize="4.2cqi" />.
 * At CARD_RENDER_WIDTH: 7cqi = 115.08px, 4.2cqi = 69.05px. Passed as explicit
 * px so the badge renders correctly inside its own (non-cqi) crop box.
 */
export function rasterizeDifficultyBadge(level: number): Promise<ImageBitmap> {
  const size = `${7 * CQI}px`;
  const fontSize = `${4.2 * CQI}px`;
  return cached(badgeCache, level, () =>
    rasterize(
      DifficultyBadge,
      { level, size, fontSize },
      Math.round(BADGE_SIZE),
      Math.round(BADGE_SIZE),
    ),
  );
}

// ── Loop icons (icon-constant) ─────────────────────────────────────────────

/**
 * Rasterize a single LOOP component icon cell, matching CardBack.svelte's
 * node-selection logic exactly:
 *   - SWAPPED            -> SwapIcon
 *   - quartered INVERTED -> CheckerboardCircleIcon (opts.quarteredInv)
 *   - quartered ROTATED  -> <i class="fas fa-arrows-spin"> (opts.quarteredRot)
 *   - else               -> <i class={LOOP_ICONS[component].fa}>
 *
 * Cache key: `${component}:${color}:${quarteredRot}:${quarteredInv}`.
 *
 * @param component LOOPComponent value (e.g. "rotated").
 * @param color     Icon color (caller passes LOOP_ICONS[component].color).
 * @param opts      quarteredRot / quarteredInv flags.
 */
export function rasterizeLoopIcon(
  component: string,
  color: string,
  opts: { quarteredRot?: boolean; quarteredInv?: boolean } = {},
): Promise<ImageBitmap> {
  const quarteredRot = opts.quarteredRot ?? false;
  const quarteredInv = opts.quarteredInv ?? false;
  const key = `${component}:${color}:${quarteredRot}:${quarteredInv}`;

  return cached(loopIconCache, key, () => {
    let props: Record<string, unknown>;
    if (component === LOOPComponent.SWAPPED) {
      props = { kind: "swap", color };
    } else if (component === LOOPComponent.INVERTED && quarteredInv) {
      props = { kind: "checkerboard", color };
    } else if (component === LOOPComponent.ROTATED && quarteredRot) {
      props = { kind: "fa", fa: "fas fa-arrows-spin", color };
    } else {
      const fa = LOOP_ICONS[component]?.fa ?? "";
      props = { kind: "fa", fa, color };
    }
    return rasterize(
      CardBackLoopIcon,
      props,
      Math.round(LOOP_CELL_SIZE),
      Math.round(LOOP_CELL_SIZE),
      { containerWidth: CARD_RENDER_WIDTH },
    );
  });
}

// ── Cache reset ────────────────────────────────────────────────────────────

/**
 * Clear all constant-element caches, closing any resolved ImageBitmaps to free
 * GPU/decoder memory. In-flight (unresolved) promises are dropped without
 * waiting; their bitmaps will be GC'd once unreferenced.
 */
export function clearCardBackConstantCache(): void {
  const caches: Map<unknown, Promise<ImageBitmap>>[] = [
    brandCache as Map<unknown, Promise<ImageBitmap>>,
    urlCache as Map<unknown, Promise<ImageBitmap>>,
    badgeCache as Map<unknown, Promise<ImageBitmap>>,
    loopIconCache as Map<unknown, Promise<ImageBitmap>>,
  ];
  for (const cache of caches) {
    for (const entry of cache.values()) {
      entry
        .then((bmp) => bmp.close?.())
        .catch(() => {
          /* never rendered / already closed */
        });
    }
    cache.clear();
  }
}
