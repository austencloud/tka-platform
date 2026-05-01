/**
 * QFT Formula Lookup
 *
 * Functions for parsing and describing QFT notation formulas.
 */

import type { QFTFormula } from "../data/qft-notation.js";
import { QFT_FORMULAS } from "../data/qft-notation.js";

/**
 * Format: a,b(h(+/-x+/-y+/-z)h'){Class}a',b'
 */
export function parseQFTFormula(formulaString: string): QFTFormula | undefined {
	// TODO: Implement parser once QFT notation rules are fully documented
	void formulaString;
	return undefined;
}

export function describeQFTFormula(formulaId: string): string | undefined {
	// TODO: Implement description generation once formula data is populated
	const formula = QFT_FORMULAS.find((f) => f.id === formulaId);
	return formula?.description;
}
