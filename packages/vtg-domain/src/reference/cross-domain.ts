/**
 * Cross-Domain Mapping
 *
 * Functions for mapping between VTG and TKA concepts.
 * VTG categories map to TKA letter types through the shared
 * timing/direction algebra. This is where the two systems meet.
 *
 * NOTE: Elemental names (Earth, Water, Air, Fire, Sun, Moon) are NOT
 * included here because the elemental model is a separate system from
 * both VTG and TKA. See elemental-model.ts for that mapping.
 */

import type { VTGCategory } from "../data/categories.js";
import { VTG_CATEGORIES } from "../data/categories.js";

export interface CrossDomainMapping {
	/** VTG category */
	vtgCategory: VTGCategory;
	/** TKA letter types that correspond */
	tkaLetterTypes: string[];
	/** Notes on where the mapping is exact vs. approximate */
	notes?: string;
}

export function vtgToTKA(vtgCategoryId: string): CrossDomainMapping | undefined {
	const lower = vtgCategoryId.toLowerCase();
	const category = VTG_CATEGORIES.find((c) => c.id.toLowerCase() === lower);
	if (!category) return undefined;
	return {
		vtgCategory: category,
		tkaLetterTypes: category.tkaLetters ?? [],
	};
}

export function tkaToVTG(tkaLetterType: string): VTGCategory[] {
	const upper = tkaLetterType.toUpperCase();
	return VTG_CATEGORIES.filter((c) =>
		c.tkaLetters?.some((l) => l.toUpperCase() === upper),
	);
}
