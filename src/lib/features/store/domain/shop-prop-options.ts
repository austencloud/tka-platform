/**
 * shop-prop-options
 *
 * The props a buyer can order a physical deck printed with. Deliberately a
 * limited launch set (full picker taxonomy lives in
 * prop-type-display-registry); every entry here must have print-pipeline SVG
 * assets and a baked cover pass. The firebase function keeps a mirrored
 * whitelist (firebase-functions/src/merch/createMerchCheckout.ts) — update
 * both when this list changes.
 */

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { getPropTypeDisplayInfo } from "$lib/shared/pictograph/prop/domain/prop-type-display-registry";
import type { CoverCard } from "./models/product";

export const SHOP_PROP_OPTIONS: readonly PropType[] = [
  PropType.STAFF,
  PropType.CLUB,
  PropType.FAN,
  PropType.TRIAD,
  PropType.BUUGENG,
];

/** Staves are the canonical TKA prop and the pre-selected default. */
export const DEFAULT_SHOP_PROP = PropType.STAFF;

export function shopPropLabel(prop: PropType): string {
  return getPropTypeDisplayInfo(prop).label;
}

export function shopPropImage(prop: PropType): string {
  return getPropTypeDisplayInfo(prop).image;
}

/**
 * Baked cover URL for a card rendered with the given prop, if one exists.
 * Staff keeps reading the legacy single `imageUrl` field (the original bake
 * predates prop choice); every prop also resolves through `propImageUrls`.
 */
export function bakedCoverUrl(card: CoverCard, prop: PropType): string | undefined {
  const perProp = card.propImageUrls?.[prop];
  if (perProp) return perProp;
  return prop === PropType.STAFF ? card.imageUrl : undefined;
}
