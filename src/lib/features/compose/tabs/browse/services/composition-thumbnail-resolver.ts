/**
 * composition-thumbnail-resolver
 *
 * Resolves thumbnail display for composition cards. Returns the stored
 * thumbnailUrl when available, or generates an inline SVG data URL
 * placeholder based on the composition's mode and accent color.
 */

import type { AnimationMode } from "../../../shared/domain/animation-mode";
import type { CompositionBrowseItem } from "../state/composition-browse-state.svelte";

export function resolveThumbnail(composition: CompositionBrowseItem): string | null {
  if (composition.thumbnailUrl) {
    return composition.thumbnailUrl;
  }
  return null;
}

function getShapesForMode(mode: AnimationMode, accent: string): string {
  switch (mode) {
    case "single":
      return `<rect x="20" y="15" width="60" height="70" rx="4" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`;
    case "mirror":
      return [
        `<rect x="8" y="20" width="35" height="60" rx="3" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
        `<rect x="57" y="20" width="35" height="60" rx="3" fill="${accent}" fill-opacity="0.15" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
        `<line x1="50" y1="15" x2="50" y2="85" stroke="${accent}" stroke-width="1.5" stroke-dasharray="4 3" stroke-opacity="0.6"/>`,
      ].join("");
    case "tunnel":
      return [
        `<circle cx="50" cy="50" r="38" fill="none" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
        `<circle cx="50" cy="50" r="26" fill="${accent}" fill-opacity="0.1" stroke="${accent}" stroke-width="2" stroke-opacity="0.8"/>`,
      ].join("");
    case "grid":
      return [
        `<rect x="8" y="8" width="38" height="38" rx="3" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
        `<rect x="54" y="8" width="38" height="38" rx="3" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
        `<rect x="8" y="54" width="38" height="38" rx="3" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
        `<rect x="54" y="54" width="38" height="38" rx="3" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
        `<line x1="50" y1="5" x2="50" y2="95" stroke="${accent}" stroke-width="1" stroke-dasharray="3 3" stroke-opacity="0.4"/>`,
        `<line x1="5" y1="50" x2="95" y2="50" stroke="${accent}" stroke-width="1" stroke-dasharray="3 3" stroke-opacity="0.4"/>`,
      ].join("");
    case "side-by-side":
      return [
        `<rect x="8" y="20" width="35" height="60" rx="3" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
        `<rect x="57" y="20" width="35" height="60" rx="3" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`,
      ].join("");
    default:
      return `<rect x="20" y="15" width="60" height="70" rx="4" fill="${accent}" fill-opacity="0.25" stroke="${accent}" stroke-width="2" stroke-opacity="0.5"/>`;
  }
}

export function generatePlaceholderSvg(mode: AnimationMode, accent: string): string {
  const shapes = getShapesForMode(mode, accent);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${shapes}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
