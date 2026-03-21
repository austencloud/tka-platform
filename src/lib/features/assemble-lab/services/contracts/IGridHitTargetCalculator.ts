/**
 * Grid Hit Target Calculator Contract
 *
 * Maps grid modes to clickable SVG hit target regions with pixel positions.
 * Used by InteractiveGrid to render click targets at correct grid locations.
 */

import type { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export interface GridHitTarget {
	readonly location: GridLocation;
	readonly x: number;
	readonly y: number;
	readonly label: string;
}

export interface IGridHitTargetCalculator {
	getHitTargets(gridMode: GridMode, showCenter?: boolean): GridHitTarget[];
	getHitTargetRadius(): number;
}
