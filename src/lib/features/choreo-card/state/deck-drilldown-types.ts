export type DrillPath = 'LOOPs' | 'VTG';

export type DrillStepId =
	| 'collection'
	| 'shape'
	| 'category'
	| 'stepcount'
	| 'turn'
	| 'uniform'
	| 'reversal';

export interface BreadcrumbSegment {
	readonly label: string;
	readonly stepId: DrillStepId;
}

export interface ShapeSelections {
	readonly loopTypes: readonly string[];
	readonly sliceType: 'halved' | 'quartered';
	readonly gridMode: string;
}

export interface CategorySelections {
	readonly vtgFamily: string;
	readonly gridMode: string;
}

export interface DrillSelections {
	readonly path: DrillPath | null;
	readonly shape: ShapeSelections | null;
	readonly category: CategorySelections | null;
	readonly stepCount: number | null;
	readonly turnPattern: string | null;
	readonly reversalPattern: string | null;
}
