/**
 * ICompositionThumbnailResolver - Resolves thumbnails for composition cards
 *
 * Returns the stored thumbnail URL if available, otherwise generates
 * an inline SVG data URL placeholder based on the composition's mode.
 */

import type { AnimationMode } from "../../../../shared/domain/AnimationMode";
import type { CompositionBrowseItem } from "../../state/composition-browse-state.svelte";

export interface ICompositionThumbnailResolver {
	resolveThumbnail(composition: CompositionBrowseItem): string | null;
	generatePlaceholderSvg(mode: AnimationMode, accent: string): string;
}
