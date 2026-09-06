import {
  isFanPropType,
  normalizeFanAppearance,
  resolveFanRenderKey,
  type FanAppearance,
} from "./fan-appearance";
import { PROP_MODEL_SPRITES } from "./prop-model-sprites.generated";

/**
 * How the 2D animation canvas draws a prop.
 *
 * - `model`: a flat capture of the same 3D model the viewer's 3D mode renders,
 *   pre-lit in the blue and red motion colors.
 * - `pictograph`: the flat notation artwork, recolored per hand at runtime.
 *
 * Fan keeps its own richer appearance contract (build, frame, cover); this
 * setting covers every other physical prop with one switch.
 */
export const PROP_LOOKS = ["model", "pictograph"] as const;
export type PropLook = (typeof PROP_LOOKS)[number];

export const DEFAULT_PROP_LOOK: PropLook = "model";

export type PropSpriteSide = "left" | "right";

export function normalizePropLook(value: unknown): PropLook {
  return value === "pictograph" ? "pictograph" : DEFAULT_PROP_LOOK;
}

/** Props with a captured model sprite pair on disk. */
export function hasModelSprite(propType: string | null | undefined): boolean {
  if (!propType) return false;
  return Object.prototype.hasOwnProperty.call(
    PROP_MODEL_SPRITES,
    propType.toLowerCase()
  );
}

export interface PropRenderAppearance {
  fanAppearance?: FanAppearance | null;
  propLook?: PropLook | null;
}

/**
 * Renderer-only identity for the texture cache. Fan builds win for fans; every
 * other prop with a captured sprite gets `<prop>__model` when the model look is
 * active. Keys never enter PropType, choreography, or URLs.
 */
export function resolvePropRenderKey(
  propType: string,
  appearance: PropRenderAppearance
): string {
  const normalized = propType.toLowerCase();
  if (isFanPropType(normalized)) {
    return resolveFanRenderKey(
      normalized,
      normalizeFanAppearance(appearance.fanAppearance)
    );
  }
  if (
    normalizePropLook(appearance.propLook) === "model" &&
    hasModelSprite(normalized)
  ) {
    return `${normalized}__model`;
  }
  return normalized;
}

export interface ModelRenderKey {
  propType: string;
}

export function parseModelRenderKey(value: string): ModelRenderKey | null {
  const match = /^([a-z0-9_-]+)__model$/.exec(value.toLowerCase());
  if (!match) return null;
  return { propType: match[1]! };
}

/** The notation prop behind any render key (fan build, model, or plain). */
export function basePropTypeOfRenderKey(value: string): string {
  const normalized = value.toLowerCase();
  const separator = normalized.indexOf("__");
  return separator === -1 ? normalized : normalized.slice(0, separator);
}

export const MODEL_SPRITE_ROOT = "/images/props/appearances/model";

export function modelSpriteArtwork(
  propType: string,
  side: PropSpriteSide
): string {
  const color = side === "left" ? "blue" : "red";
  const entry = PROP_MODEL_SPRITES[propType.toLowerCase()];
  const revision = entry ? `?v=${encodeURIComponent(entry.capturedAt)}` : "";
  return `${MODEL_SPRITE_ROOT}/${propType.toLowerCase()}-${color}.svg${revision}`;
}

export interface PropLookOption {
  id: PropLook;
  label: string;
  image: string;
}

export function propLookOptions(propType: string): readonly PropLookOption[] {
  const normalized = propType.toLowerCase();
  return [
    {
      id: "model",
      label: "3D model",
      image: modelSpriteArtwork(normalized, "left"),
    },
    {
      id: "pictograph",
      label: "Pictograph",
      image: `/images/props/buttons/${normalized}.svg`,
    },
  ];
}
