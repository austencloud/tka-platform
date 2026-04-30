/**
 * IEraRenderer - Shared contract for era-native pictograph renderers.
 *
 * Each era (1995, 2003, etc.) implements this to draw pictographs
 * with era-appropriate visual treatment. All use PictographPreparer
 * for positioning - only the paint style differs.
 */
import type { RetroPictographData } from "../../domain/pictograph-types";

export interface IEraRenderer {
	render(canvas: HTMLCanvasElement, data: RetroPictographData, size?: number): Promise<void>;
	renderPlaceholder(canvas: HTMLCanvasElement, size?: number): void;
}
