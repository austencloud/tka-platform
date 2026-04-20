// Map of page number → path to the original PDF artboard PNG.
// Used by the compare route and the editor's compare view.
//
// Some pages don't have dedicated artboards (e.g. the original had fewer
// logical pages than the Svelte rebuild); those reuse a neighboring
// artboard as a visual proxy.

const ART = '/guide/level-1/artboards';

export const originalArtboards: Record<number, string> = {
	1: `${ART}/Level 1 Front Cover.png`,
	2: `${ART}/Support the Author.png`, // no dedicated artboard; donation page as proxy
	3: `${ART}/Support the Author.png`,
	4: `${ART}/Introduction, pt 1.png`,
	5: `${ART}/Table of Contents.png`,
	6: `${ART}/1.0 - Title Page - Positions and Motions.png`,
	7: `${ART}/1.0 - The Grid.png`,
	8: `${ART}/1.0 - Hand Positions.png`,
	9: `${ART}/1.0 - Hand Motions.png`,
	10: `${ART}/1.0 - Type 1 - alpha, beta copy 2.png`,
	11: `${ART}/1.0 - Type 1 - gamma and Type 2.png`,
	12: `${ART}/1.0 - Type 1 - gamma and Type 2 copy 2.png`,
	13: `${ART}/1.0  Type 3 and 4.png`,
	14: `${ART}/1.0 - Type 5 and 6.png`,
	15: `${ART}/1.0 - Layer 1 Staff Positions.png`,
	16: `${ART}/1.0 - Layer 1 Staff Motions.png`,
	17: `${ART}/1.0 - Prerequisites.png`,
	18: `${ART}/1.1 - Title Page.png`,
	19: `${ART}/1.1 - Base Letters - Double Staff, Type 1-2.png`,
	20: `${ART}/1.1 - Base Letters - Double Staff, Type 3-6.png`,
	21: `${ART}/1.1 - Letters - Type 1.png`,
	22: `${ART}/1.1 - Basic Words, ABC, GHI.png`,
	23: `${ART}/1.1 - Compound Letters.png`,
	24: `${ART}/1.1 - Compound Words - DJ, EK, FL.png`,
	25: `${ART}/1.1 - Gamma Letters.png`,
	26: `${ART}/1.1 - Gamma Words - MP, NQ, OR, STUV.png`,
	27: `${ART}/1.1 - Type 2 - Shifts.png`,
	28: `${ART}/1.1 - Type 3 - Cross-Shifts.png`,
	29: `${ART}/1.1 - Type 4,5,6.png`,
	30: `${ART}/1.2 - Title Page.png`,
	31: `${ART}/1.2 - Words.png`,
	32: `${ART}/1.2 - Permutations.png`,
	33: `${ART}/1.2 - Reversals.png`,
	34: `${ART}/1.2 - Guide pt 1 - AABB.png`,
	35: `${ART}/1.2 - Guide pt. 2 - CCCC.png`,
	36: `${ART}/1.2 - Guide pt. 3 - ACAC, BCBC.png`,
	37: `${ART}/1.2 - Type 1 Permutations - DJII, BBLF, KIEC.png`,
	38: `${ART}/1.2 - Type 1 Gamma Permutations - SOTR, VPUQ, MVNU.png`,
	39: `${ART}/1.2 - Type 2 Permutations - BΣTX, EΔUZ, OYHθ.png`,
	40: `${ART}/1.2 - 16-count sequences - GθOZ, EΔQY.png`,
	41: `${ART}/1.2 - 8-Letter Words - IIΩXKEΣY, CΣNZIθVW.png`,
	42: `${ART}/1.2 - Prop-Reversal Permutations, EsigQY, TWKthe, BdelMX.png`,
	43: `${ART}/1.2 - Full-Reversal Permutations.png`,
	44: `${ART}/Let's collab and Buy me a taco!.png`,
	45: `${ART}/VTG Links and Changelog.png`,
	46: `${ART}/Introduction, pt 2.png`,
	47: `${ART}/Level 1 Back Cover.png`
};

export function getOriginalArtboard(pageNumber: number): string | null {
	return originalArtboards[pageNumber] ?? null;
}
