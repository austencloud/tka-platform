/**
 * Category Lookup
 *
 * Functions for retrieving VTG timing/direction categories.
 */

import type { VTGCategory } from "../data/categories.js";
import { VTG_CATEGORIES } from "../data/categories.js";

export function getVTGCategory(id: string): VTGCategory | undefined {
	const lower = id.toLowerCase();
	return VTG_CATEGORIES.find((c) => c.id.toLowerCase() === lower);
}

export function listVTGCategories(): VTGCategory[] {
	return VTG_CATEGORIES;
}
