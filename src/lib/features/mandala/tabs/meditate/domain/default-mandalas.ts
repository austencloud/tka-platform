import type { StepLike } from "$lib/shared/mandala/services/types";

export interface DefaultMandala {
	id: string;
	name: string;
	steps: StepLike[];
	variant: "blue" | "red" | "both";
	bluePropType: string;
	redPropType: string;
}

export const DEFAULT_MANDALAS: DefaultMandala[] = [];
