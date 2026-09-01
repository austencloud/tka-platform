import type { StepLike } from "$lib/shared/mandala/services/types";
import type { MandalaHandVisibility } from "$lib/shared/mandala/domain/mandala-types";

export interface DefaultMandala {
	id: string;
	name: string;
	steps: StepLike[];
	variant: MandalaHandVisibility;
	leftPropType: string;
	rightPropType: string;
}

export const DEFAULT_MANDALAS: DefaultMandala[] = [];
