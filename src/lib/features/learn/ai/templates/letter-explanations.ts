/**
 * Letter Explanations for Tika
 *
 * Pre-written explanations for all 47 TKA letters at multiple knowledge levels.
 *
 * Levels:
 * 0 - Pure visual, no jargon (anyone can understand)
 * 1 - Can use position terms (alpha, beta, gamma)
 * 2 - Can use motion terms (static, shift, dash)
 * 3 - Can use rotation terms (pro, anti)
 * 4 - Can compare letter types
 * 5 - Expert shorthand
 */

export interface LetterExplanation {
	letter: string
	type: 1 | 2 | 3 | 4 | 5 | 6
	typeName: string
	startPosition: string
	endPosition: string
	blueMotion: string
	redMotion: string
	levels: Record<number, string>
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE 1: DUAL-SHIFT (A-V) - Both hands shift
// ═══════════════════════════════════════════════════════════════════════════

export const TYPE_1_LETTERS: Record<string, LetterExplanation> = {
	A: {
		letter: 'A',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'alpha',
		endPosition: 'alpha',
		blueMotion: 'pro shift',
		redMotion: 'pro shift',
		levels: {
			0: 'In A, both hands move to neighboring spots on the grid, and both props spin forward (with the direction of travel). The hands start on opposite sides and end on opposite sides.',
			1: 'A starts and ends in alpha (hands opposite). Both hands move to adjacent grid points.',
			2: 'A is a dual-shift letter. Both hands shift while maintaining alpha position.',
			3: 'A: both hands do pro-shifts. α→α transition with same-direction rotation.',
			4: 'A is Type 1 (dual-shift). Both pro-shifts, alpha-to-alpha. Similar to B, C, D (all dual-shift pro variants).',
			5: 'A: Type 1, α→α, pro+pro'
		}
	},
	B: {
		letter: 'B',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'alpha',
		endPosition: 'gamma',
		blueMotion: 'pro shift',
		redMotion: 'pro shift',
		levels: {
			0: "In B, both hands move to neighboring spots with props spinning forward. The hands start on opposite sides and end at a right angle to each other.",
			1: 'B starts in alpha (opposite) and ends in gamma (right angle). Both hands move to adjacent spots.',
			2: 'B is a dual-shift from alpha to gamma. Both hands shift in the same direction.',
			3: 'B: dual pro-shift. α→γ transition.',
			4: 'B is Type 1 (dual-shift). Both pro-shifts, alpha-to-gamma.',
			5: 'B: Type 1, α→γ, pro+pro'
		}
	},
	C: {
		letter: 'C',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'alpha',
		endPosition: 'beta',
		blueMotion: 'pro shift',
		redMotion: 'pro shift',
		levels: {
			0: "In C, both hands move toward each other until they meet at the same point. Both props spin forward.",
			1: 'C starts in alpha (opposite) and ends in beta (same point). Both hands converge.',
			2: 'C is a dual-shift from alpha to beta. Both hands shift inward.',
			3: 'C: dual pro-shift converging. α→β transition.',
			4: 'C is Type 1 (dual-shift). Both pro-shifts, alpha-to-beta (convergent).',
			5: 'C: Type 1, α→β, pro+pro'
		}
	},
	D: {
		letter: 'D',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'beta',
		endPosition: 'alpha',
		blueMotion: 'pro shift',
		redMotion: 'pro shift',
		levels: {
			0: "In D, both hands start at the same point and move apart to opposite sides. Both props spin forward.",
			1: 'D starts in beta (same point) and ends in alpha (opposite). Both hands diverge.',
			2: 'D is a dual-shift from beta to alpha. Both hands shift outward.',
			3: 'D: dual pro-shift diverging. β→α transition.',
			4: 'D is Type 1 (dual-shift). Both pro-shifts, beta-to-alpha (divergent). Reverse of C.',
			5: 'D: Type 1, β→α, pro+pro'
		}
	},
	E: {
		letter: 'E',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'beta',
		endPosition: 'gamma',
		blueMotion: 'pro shift',
		redMotion: 'pro shift',
		levels: {
			0: "In E, both hands start at the same point and separate to form a right angle. Both props spin forward.",
			1: 'E starts in beta (same point) and ends in gamma (right angle).',
			2: 'E is a dual-shift from beta to gamma.',
			3: 'E: dual pro-shift. β→γ transition.',
			4: 'E is Type 1 (dual-shift). Both pro-shifts, beta-to-gamma.',
			5: 'E: Type 1, β→γ, pro+pro'
		}
	},
	F: {
		letter: 'F',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'gamma',
		endPosition: 'beta',
		blueMotion: 'pro shift',
		redMotion: 'pro shift',
		levels: {
			0: "In F, both hands start at a right angle and meet at the same point. Both props spin forward.",
			1: 'F starts in gamma (right angle) and ends in beta (same point).',
			2: 'F is a dual-shift from gamma to beta. Reverse of E.',
			3: 'F: dual pro-shift. γ→β transition.',
			4: 'F is Type 1 (dual-shift). Both pro-shifts, gamma-to-beta.',
			5: 'F: Type 1, γ→β, pro+pro'
		}
	},
	G: {
		letter: 'G',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'gamma',
		endPosition: 'gamma',
		blueMotion: 'pro shift',
		redMotion: 'pro shift',
		levels: {
			0: "In G, both hands move to neighboring spots while maintaining their right-angle relationship. Both props spin forward.",
			1: 'G starts and ends in gamma (right angle). Both hands shift while staying at right angles.',
			2: 'G is a dual-shift that maintains gamma position.',
			3: 'G: dual pro-shift. γ→γ transition.',
			4: 'G is Type 1 (dual-shift). Both pro-shifts, gamma-to-gamma.',
			5: 'G: Type 1, γ→γ, pro+pro'
		}
	},
	H: {
		letter: 'H',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'alpha',
		endPosition: 'alpha',
		blueMotion: 'anti shift',
		redMotion: 'anti shift',
		levels: {
			0: "In H, both hands move to neighboring spots, but both props spin backward (against the direction of travel). Hands stay on opposite sides.",
			1: 'H starts and ends in alpha. Both hands shift with backward prop rotation.',
			2: 'H is a dual-shift maintaining alpha with both hands doing antispin.',
			3: 'H: dual anti-shift. α→α transition.',
			4: 'H is Type 1 (dual-shift). Both anti-shifts, alpha-to-alpha. Antispin version of A.',
			5: 'H: Type 1, α→α, anti+anti'
		}
	},
	I: {
		letter: 'I',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'alpha',
		endPosition: 'gamma',
		blueMotion: 'anti shift',
		redMotion: 'anti shift',
		levels: {
			0: "In I, both hands move with backward-spinning props. Hands go from opposite sides to a right angle.",
			1: 'I starts in alpha, ends in gamma. Both hands do backward rotation.',
			2: 'I is a dual anti-shift from alpha to gamma.',
			3: 'I: dual anti-shift. α→γ transition.',
			4: 'I is Type 1 (dual-shift). Both anti-shifts, alpha-to-gamma. Antispin version of B.',
			5: 'I: Type 1, α→γ, anti+anti'
		}
	},
	J: {
		letter: 'J',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'alpha',
		endPosition: 'beta',
		blueMotion: 'anti shift',
		redMotion: 'anti shift',
		levels: {
			0: "In J, both hands move toward each other with backward-spinning props until they meet.",
			1: 'J starts in alpha, ends in beta. Both hands converge with backward rotation.',
			2: 'J is a dual anti-shift from alpha to beta.',
			3: 'J: dual anti-shift converging. α→β transition.',
			4: 'J is Type 1 (dual-shift). Both anti-shifts, alpha-to-beta. Antispin version of C.',
			5: 'J: Type 1, α→β, anti+anti'
		}
	},
	K: {
		letter: 'K',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'beta',
		endPosition: 'alpha',
		blueMotion: 'anti shift',
		redMotion: 'anti shift',
		levels: {
			0: "In K, both hands start together and separate to opposite sides with backward-spinning props.",
			1: 'K starts in beta, ends in alpha. Both hands diverge with backward rotation.',
			2: 'K is a dual anti-shift from beta to alpha.',
			3: 'K: dual anti-shift diverging. β→α transition.',
			4: 'K is Type 1 (dual-shift). Both anti-shifts, beta-to-alpha. Antispin version of D.',
			5: 'K: Type 1, β→α, anti+anti'
		}
	},
	L: {
		letter: 'L',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'beta',
		endPosition: 'gamma',
		blueMotion: 'anti shift',
		redMotion: 'anti shift',
		levels: {
			0: "In L, both hands start together and form a right angle with backward-spinning props.",
			1: 'L starts in beta, ends in gamma. Both hands separate to right angle.',
			2: 'L is a dual anti-shift from beta to gamma.',
			3: 'L: dual anti-shift. β→γ transition.',
			4: 'L is Type 1 (dual-shift). Both anti-shifts, beta-to-gamma. Antispin version of E.',
			5: 'L: Type 1, β→γ, anti+anti'
		}
	},
	M: {
		letter: 'M',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'gamma',
		endPosition: 'beta',
		blueMotion: 'anti shift',
		redMotion: 'anti shift',
		levels: {
			0: "In M, both hands start at right angles and meet together with backward-spinning props.",
			1: 'M starts in gamma, ends in beta. Both hands converge.',
			2: 'M is a dual anti-shift from gamma to beta.',
			3: 'M: dual anti-shift. γ→β transition.',
			4: 'M is Type 1 (dual-shift). Both anti-shifts, gamma-to-beta. Antispin version of F.',
			5: 'M: Type 1, γ→β, anti+anti'
		}
	},
	N: {
		letter: 'N',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'gamma',
		endPosition: 'gamma',
		blueMotion: 'anti shift',
		redMotion: 'anti shift',
		levels: {
			0: "In N, both hands stay at right angles while moving with backward-spinning props.",
			1: 'N starts and ends in gamma. Both hands shift while staying at right angles.',
			2: 'N is a dual anti-shift maintaining gamma.',
			3: 'N: dual anti-shift. γ→γ transition.',
			4: 'N is Type 1 (dual-shift). Both anti-shifts, gamma-to-gamma. Antispin version of G.',
			5: 'N: Type 1, γ→γ, anti+anti'
		}
	},
	O: {
		letter: 'O',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'gamma',
		endPosition: 'alpha',
		blueMotion: 'pro shift',
		redMotion: 'anti shift',
		levels: {
			0: "In O, both hands shift but one spins forward while the other spins backward. They move from right angle to opposite.",
			1: 'O starts in gamma, ends in alpha. One hand spins forward, one backward.',
			2: 'O is a mixed dual-shift: one pro, one anti.',
			3: 'O: pro+anti shift. γ→α transition.',
			4: 'O is Type 1 (dual-shift) with mixed rotation. One pro-shift, one anti-shift.',
			5: 'O: Type 1, γ→α, pro+anti'
		}
	},
	P: {
		letter: 'P',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'gamma',
		endPosition: 'alpha',
		blueMotion: 'anti shift',
		redMotion: 'pro shift',
		levels: {
			0: "In P, both hands shift with opposite rotations - mirror of O. Right angle to opposite.",
			1: 'P starts in gamma, ends in alpha. Mixed rotations.',
			2: 'P is a mixed dual-shift: one anti, one pro.',
			3: 'P: anti+pro shift. γ→α transition.',
			4: 'P is Type 1 (dual-shift) with mixed rotation. Mirror of O.',
			5: 'P: Type 1, γ→α, anti+pro'
		}
	},
	Q: {
		letter: 'Q',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'alpha',
		endPosition: 'gamma',
		blueMotion: 'pro shift',
		redMotion: 'anti shift',
		levels: {
			0: "In Q, both hands shift with opposite rotations from opposite sides to right angle.",
			1: 'Q starts in alpha, ends in gamma. One forward, one backward spin.',
			2: 'Q is a mixed dual-shift: pro+anti from alpha to gamma.',
			3: 'Q: pro+anti shift. α→γ transition.',
			4: 'Q is Type 1 (dual-shift) with mixed rotation. Reverse of O.',
			5: 'Q: Type 1, α→γ, pro+anti'
		}
	},
	R: {
		letter: 'R',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'alpha',
		endPosition: 'gamma',
		blueMotion: 'anti shift',
		redMotion: 'pro shift',
		levels: {
			0: "In R, both hands shift with opposite rotations from opposite sides to right angle.",
			1: 'R starts in alpha, ends in gamma. Mixed rotations.',
			2: 'R is a mixed dual-shift: anti+pro from alpha to gamma.',
			3: 'R: anti+pro shift. α→γ transition.',
			4: 'R is Type 1 (dual-shift) with mixed rotation. Mirror of Q.',
			5: 'R: Type 1, α→γ, anti+pro'
		}
	},
	S: {
		letter: 'S',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'beta',
		endPosition: 'beta',
		blueMotion: 'pro shift',
		redMotion: 'anti shift',
		levels: {
			0: "In S, both hands shift around the same point - one forward, one backward. They trade places.",
			1: 'S starts and ends in beta. Hands swap positions at the same point.',
			2: 'S is a mixed dual-shift maintaining beta.',
			3: 'S: pro+anti shift. β→β transition.',
			4: 'S is Type 1 (dual-shift). Mixed rotation, beta-to-beta swap.',
			5: 'S: Type 1, β→β, pro+anti'
		}
	},
	T: {
		letter: 'T',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'beta',
		endPosition: 'beta',
		blueMotion: 'anti shift',
		redMotion: 'pro shift',
		levels: {
			0: "In T, both hands shift around the same point with opposite rotations. Mirror of S.",
			1: 'T starts and ends in beta. Hands swap with opposite rotation to S.',
			2: 'T is a mixed dual-shift maintaining beta.',
			3: 'T: anti+pro shift. β→β transition.',
			4: 'T is Type 1 (dual-shift). Mixed rotation, beta-to-beta swap. Mirror of S.',
			5: 'T: Type 1, β→β, anti+pro'
		}
	},
	U: {
		letter: 'U',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'gamma',
		endPosition: 'gamma',
		blueMotion: 'pro shift',
		redMotion: 'anti shift',
		levels: {
			0: "In U, both hands shift while staying at right angles - one forward, one backward rotation.",
			1: 'U maintains gamma. Mixed rotations while staying at right angles.',
			2: 'U is a mixed dual-shift maintaining gamma.',
			3: 'U: pro+anti shift. γ→γ transition.',
			4: 'U is Type 1 (dual-shift). Mixed rotation, gamma-to-gamma.',
			5: 'U: Type 1, γ→γ, pro+anti'
		}
	},
	V: {
		letter: 'V',
		type: 1,
		typeName: 'Dual-Shift',
		startPosition: 'gamma',
		endPosition: 'gamma',
		blueMotion: 'anti shift',
		redMotion: 'pro shift',
		levels: {
			0: "In V, both hands shift while staying at right angles with opposite rotations to U.",
			1: 'V maintains gamma. Mirror of U.',
			2: 'V is a mixed dual-shift maintaining gamma.',
			3: 'V: anti+pro shift. γ→γ transition.',
			4: 'V is Type 1 (dual-shift). Mixed rotation, gamma-to-gamma. Mirror of U.',
			5: 'V: Type 1, γ→γ, anti+pro'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE 2: SHIFT (W, X, Y, Z, Σ, Δ, Θ, Ω) - One shifts, one static
// ═══════════════════════════════════════════════════════════════════════════

export const TYPE_2_LETTERS: Record<string, LetterExplanation> = {
	W: {
		letter: 'W',
		type: 2,
		typeName: 'Shift',
		startPosition: 'gamma',
		endPosition: 'gamma',
		blueMotion: 'static',
		redMotion: 'pro shift',
		levels: {
			0: "In W, one hand stays completely still while the other moves to a neighbor with forward-spinning prop. Hands stay at right angle.",
			1: 'W starts and ends in gamma. One hand is stationary, one moves.',
			2: 'W is a shift letter: one static, one shifting. Maintains gamma.',
			3: 'W: static + pro-shift. γ→γ transition.',
			4: 'W is Type 2 (shift). One static, one pro-shift. Compare to X (anti instead of pro).',
			5: 'W: Type 2, γ→γ, static+pro'
		}
	},
	X: {
		letter: 'X',
		type: 2,
		typeName: 'Shift',
		startPosition: 'gamma',
		endPosition: 'alpha',
		blueMotion: 'static',
		redMotion: 'anti shift',
		levels: {
			0: "In X, one hand stays still while the other moves with backward-spinning prop. Hands go from right angle to opposite.",
			1: 'X goes from gamma to alpha. One hand stationary, one moves with backward rotation.',
			2: 'X is a shift letter: one static, one anti-shifting.',
			3: 'X: static + anti-shift. γ→α transition.',
			4: 'X is Type 2 (shift). One static, one anti-shift. The only γ→α in Type 2.',
			5: 'X: Type 2, γ→α, static+anti'
		}
	},
	Y: {
		letter: 'Y',
		type: 2,
		typeName: 'Shift',
		startPosition: 'alpha',
		endPosition: 'gamma',
		blueMotion: 'static',
		redMotion: 'pro shift',
		levels: {
			0: "In Y, one hand stays still while the other moves with forward-spinning prop. Hands go from opposite to right angle.",
			1: 'Y goes from alpha to gamma. One stationary, one moves forward.',
			2: 'Y is a shift letter: one static, one pro-shifting.',
			3: 'Y: static + pro-shift. α→γ transition.',
			4: 'Y is Type 2 (shift). One static, one pro-shift. Reverse direction of X.',
			5: 'Y: Type 2, α→γ, static+pro'
		}
	},
	Z: {
		letter: 'Z',
		type: 2,
		typeName: 'Shift',
		startPosition: 'alpha',
		endPosition: 'alpha',
		blueMotion: 'static',
		redMotion: 'anti shift',
		levels: {
			0: "In Z, one hand stays still while the other moves around with backward-spinning prop. Hands stay opposite.",
			1: 'Z maintains alpha. One stationary, one moves with backward rotation.',
			2: 'Z is a shift letter: one static, one anti-shifting.',
			3: 'Z: static + anti-shift. α→α transition.',
			4: 'Z is Type 2 (shift). One static, one anti-shift maintaining alpha.',
			5: 'Z: Type 2, α→α, static+anti'
		}
	},
	Σ: {
		letter: 'Σ',
		type: 2,
		typeName: 'Shift',
		startPosition: 'beta',
		endPosition: 'gamma',
		blueMotion: 'static',
		redMotion: 'pro shift',
		levels: {
			0: "In Sigma, one hand stays still while the other moves away from it with forward spin. Same point to right angle.",
			1: 'Sigma goes from beta to gamma. One stationary, one moves.',
			2: 'Sigma is a shift letter: one static, one pro-shifting.',
			3: 'Σ: static + pro-shift. β→γ transition.',
			4: 'Σ (Sigma) is Type 2 (shift). One static, one pro-shift from beta.',
			5: 'Σ: Type 2, β→γ, static+pro'
		}
	},
	Δ: {
		letter: 'Δ',
		type: 2,
		typeName: 'Shift',
		startPosition: 'beta',
		endPosition: 'gamma',
		blueMotion: 'static',
		redMotion: 'anti shift',
		levels: {
			0: "In Delta, one hand stays still while the other moves away with backward-spinning prop. Same point to right angle.",
			1: 'Delta goes from beta to gamma. One stationary, one backward rotation.',
			2: 'Delta is a shift letter: one static, one anti-shifting.',
			3: 'Δ: static + anti-shift. β→γ transition.',
			4: 'Δ (Delta) is Type 2 (shift). One static, one anti-shift from beta. Compare to Σ.',
			5: 'Δ: Type 2, β→γ, static+anti'
		}
	},
	Θ: {
		letter: 'Θ',
		type: 2,
		typeName: 'Shift',
		startPosition: 'gamma',
		endPosition: 'beta',
		blueMotion: 'static',
		redMotion: 'pro shift',
		levels: {
			0: "In Theta, one hand stays still while the other moves toward it with forward spin. Right angle to same point.",
			1: 'Theta goes from gamma to beta. One stationary, one approaches.',
			2: 'Theta is a shift letter: one static, one pro-shifting.',
			3: 'Θ: static + pro-shift. γ→β transition.',
			4: 'Θ (Theta) is Type 2 (shift). Reverse of Σ.',
			5: 'Θ: Type 2, γ→β, static+pro'
		}
	},
	Ω: {
		letter: 'Ω',
		type: 2,
		typeName: 'Shift',
		startPosition: 'gamma',
		endPosition: 'beta',
		blueMotion: 'static',
		redMotion: 'anti shift',
		levels: {
			0: "In Omega, one hand stays still while the other moves toward it with backward spin. Right angle to same point.",
			1: 'Omega goes from gamma to beta. One stationary, one approaches backward.',
			2: 'Omega is a shift letter: one static, one anti-shifting.',
			3: 'Ω: static + anti-shift. γ→β transition.',
			4: 'Ω (Omega) is Type 2 (shift). Reverse of Δ.',
			5: 'Ω: Type 2, γ→β, static+anti'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE 3: CROSS-SHIFT - One shifts, one dashes
// ═══════════════════════════════════════════════════════════════════════════

export const TYPE_3_LETTERS: Record<string, LetterExplanation> = {
	'W-': {
		letter: 'W-',
		type: 3,
		typeName: 'Cross-Shift',
		startPosition: 'gamma',
		endPosition: 'gamma',
		blueMotion: 'dash',
		redMotion: 'pro shift',
		levels: {
			0: "In W-dash, one hand jumps to the opposite side while the other moves to a neighbor with forward spin.",
			1: 'W-dash maintains gamma. One hand dashes across, one shifts.',
			2: 'W-dash is a cross-shift: one dash, one pro-shift.',
			3: 'W-: dash + pro-shift. γ→γ transition.',
			4: 'W- is Type 3 (cross-shift). Dash version of W.',
			5: 'W-: Type 3, γ→γ, dash+pro'
		}
	},
	'X-': {
		letter: 'X-',
		type: 3,
		typeName: 'Cross-Shift',
		startPosition: 'gamma',
		endPosition: 'alpha',
		blueMotion: 'dash',
		redMotion: 'anti shift',
		levels: {
			0: "In X-dash, one hand jumps to the opposite side while the other moves with backward spin.",
			1: 'X-dash goes from gamma to alpha. One dashes, one anti-shifts.',
			2: 'X-dash is a cross-shift: one dash, one anti-shift.',
			3: 'X-: dash + anti-shift. γ→α transition.',
			4: 'X- is Type 3 (cross-shift). Dash version of X.',
			5: 'X-: Type 3, γ→α, dash+anti'
		}
	},
	'Y-': {
		letter: 'Y-',
		type: 3,
		typeName: 'Cross-Shift',
		startPosition: 'alpha',
		endPosition: 'gamma',
		blueMotion: 'dash',
		redMotion: 'pro shift',
		levels: {
			0: "In Y-dash, one hand jumps across while the other shifts with forward spin.",
			1: 'Y-dash goes from alpha to gamma. One dashes, one pro-shifts.',
			2: 'Y-dash is a cross-shift: one dash, one pro-shift.',
			3: 'Y-: dash + pro-shift. α→γ transition.',
			4: 'Y- is Type 3 (cross-shift). Dash version of Y.',
			5: 'Y-: Type 3, α→γ, dash+pro'
		}
	},
	'Z-': {
		letter: 'Z-',
		type: 3,
		typeName: 'Cross-Shift',
		startPosition: 'alpha',
		endPosition: 'alpha',
		blueMotion: 'dash',
		redMotion: 'anti shift',
		levels: {
			0: "In Z-dash, one hand jumps across while the other shifts with backward spin. Hands stay opposite.",
			1: 'Z-dash maintains alpha. One dashes, one anti-shifts.',
			2: 'Z-dash is a cross-shift: one dash, one anti-shift.',
			3: 'Z-: dash + anti-shift. α→α transition.',
			4: 'Z- is Type 3 (cross-shift). Dash version of Z.',
			5: 'Z-: Type 3, α→α, dash+anti'
		}
	},
	'Σ-': {
		letter: 'Σ-',
		type: 3,
		typeName: 'Cross-Shift',
		startPosition: 'beta',
		endPosition: 'gamma',
		blueMotion: 'dash',
		redMotion: 'pro shift',
		levels: {
			0: "In Sigma-dash, one hand jumps away while the other shifts forward. Same point to right angle.",
			1: 'Σ-dash goes from beta to gamma. One dashes, one shifts.',
			2: 'Σ-dash is a cross-shift: one dash, one pro-shift.',
			3: 'Σ-: dash + pro-shift. β→γ transition.',
			4: 'Σ- is Type 3 (cross-shift). Dash version of Σ.',
			5: 'Σ-: Type 3, β→γ, dash+pro'
		}
	},
	'Δ-': {
		letter: 'Δ-',
		type: 3,
		typeName: 'Cross-Shift',
		startPosition: 'beta',
		endPosition: 'gamma',
		blueMotion: 'dash',
		redMotion: 'anti shift',
		levels: {
			0: "In Delta-dash, one hand jumps away while the other shifts backward. Same point to right angle.",
			1: 'Δ-dash goes from beta to gamma. One dashes, one anti-shifts.',
			2: 'Δ-dash is a cross-shift: one dash, one anti-shift.',
			3: 'Δ-: dash + anti-shift. β→γ transition.',
			4: 'Δ- is Type 3 (cross-shift). Dash version of Δ.',
			5: 'Δ-: Type 3, β→γ, dash+anti'
		}
	},
	'Θ-': {
		letter: 'Θ-',
		type: 3,
		typeName: 'Cross-Shift',
		startPosition: 'gamma',
		endPosition: 'beta',
		blueMotion: 'dash',
		redMotion: 'pro shift',
		levels: {
			0: "In Theta-dash, one hand jumps across while the other shifts forward to meet. Right angle to same point.",
			1: 'Θ-dash goes from gamma to beta. One dashes, one shifts toward.',
			2: 'Θ-dash is a cross-shift: one dash, one pro-shift.',
			3: 'Θ-: dash + pro-shift. γ→β transition.',
			4: 'Θ- is Type 3 (cross-shift). Dash version of Θ.',
			5: 'Θ-: Type 3, γ→β, dash+pro'
		}
	},
	'Ω-': {
		letter: 'Ω-',
		type: 3,
		typeName: 'Cross-Shift',
		startPosition: 'gamma',
		endPosition: 'beta',
		blueMotion: 'dash',
		redMotion: 'anti shift',
		levels: {
			0: "In Omega-dash, one hand jumps across while the other shifts backward to meet. Right angle to same point.",
			1: 'Ω-dash goes from gamma to beta. One dashes, one anti-shifts.',
			2: 'Ω-dash is a cross-shift: one dash, one anti-shift.',
			3: 'Ω-: dash + anti-shift. γ→β transition.',
			4: 'Ω- is Type 3 (cross-shift). Dash version of Ω.',
			5: 'Ω-: Type 3, γ→β, dash+anti'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE 4: DASH - One dashes, one static
// ═══════════════════════════════════════════════════════════════════════════

export const TYPE_4_LETTERS: Record<string, LetterExplanation> = {
	Φ: {
		letter: 'Φ',
		type: 4,
		typeName: 'Dash',
		startPosition: 'beta',
		endPosition: 'alpha',
		blueMotion: 'static',
		redMotion: 'dash',
		levels: {
			0: "In Phi, one hand stays still while the other jumps straight across to the opposite side. Same point to opposite.",
			1: 'Phi goes from beta to alpha. One stationary, one dashes across.',
			2: 'Phi is a dash letter: one static, one dashing.',
			3: 'Φ: static + dash. β→α transition.',
			4: 'Φ (Phi) is Type 4 (dash). One static, one dash from beta.',
			5: 'Φ: Type 4, β→α, static+dash'
		}
	},
	Ψ: {
		letter: 'Ψ',
		type: 4,
		typeName: 'Dash',
		startPosition: 'gamma',
		endPosition: 'gamma',
		blueMotion: 'static',
		redMotion: 'dash',
		levels: {
			0: "In Psi, one hand stays still while the other jumps to the opposite side. Right angle maintained.",
			1: 'Psi maintains gamma. One stationary, one dashes.',
			2: 'Psi is a dash letter: one static, one dashing.',
			3: 'Ψ: static + dash. γ→γ transition.',
			4: 'Ψ (Psi) is Type 4 (dash). Maintains gamma position.',
			5: 'Ψ: Type 4, γ→γ, static+dash'
		}
	},
	Λ: {
		letter: 'Λ',
		type: 4,
		typeName: 'Dash',
		startPosition: 'alpha',
		endPosition: 'beta',
		blueMotion: 'static',
		redMotion: 'dash',
		levels: {
			0: "In Lambda, one hand stays still while the other jumps to meet it. Opposite to same point.",
			1: 'Lambda goes from alpha to beta. One stationary, one dashes to meet.',
			2: 'Lambda is a dash letter: one static, one dashing.',
			3: 'Λ: static + dash. α→β transition.',
			4: 'Λ (Lambda) is Type 4 (dash). Reverse of Φ.',
			5: 'Λ: Type 4, α→β, static+dash'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE 5: DUAL-DASH - Both hands dash
// ═══════════════════════════════════════════════════════════════════════════

export const TYPE_5_LETTERS: Record<string, LetterExplanation> = {
	'Φ-': {
		letter: 'Φ-',
		type: 5,
		typeName: 'Dual-Dash',
		startPosition: 'beta',
		endPosition: 'beta',
		blueMotion: 'dash',
		redMotion: 'dash',
		levels: {
			0: "In Phi-dash, both hands jump to opposite sides simultaneously. They trade places but stay at the same point.",
			1: 'Phi-dash maintains beta. Both hands dash and swap.',
			2: 'Phi-dash is a dual-dash: both hands dash.',
			3: 'Φ-: dash + dash. β→β swap.',
			4: 'Φ- is Type 5 (dual-dash). Both dash from beta.',
			5: 'Φ-: Type 5, β→β, dash+dash'
		}
	},
	'Ψ-': {
		letter: 'Ψ-',
		type: 5,
		typeName: 'Dual-Dash',
		startPosition: 'gamma',
		endPosition: 'alpha',
		blueMotion: 'dash',
		redMotion: 'dash',
		levels: {
			0: "In Psi-dash, both hands jump to opposite sides. They go from right angle to opposite.",
			1: 'Psi-dash goes from gamma to alpha. Both hands dash.',
			2: 'Psi-dash is a dual-dash: both hands dash.',
			3: 'Ψ-: dash + dash. γ→α transition.',
			4: 'Ψ- is Type 5 (dual-dash). Both dash from gamma.',
			5: 'Ψ-: Type 5, γ→α, dash+dash'
		}
	},
	'Λ-': {
		letter: 'Λ-',
		type: 5,
		typeName: 'Dual-Dash',
		startPosition: 'alpha',
		endPosition: 'alpha',
		blueMotion: 'dash',
		redMotion: 'dash',
		levels: {
			0: "In Lambda-dash, both hands jump to opposite sides. They trade places but stay opposite.",
			1: 'Lambda-dash maintains alpha. Both hands dash and swap.',
			2: 'Lambda-dash is a dual-dash: both hands dash.',
			3: 'Λ-: dash + dash. α→α swap.',
			4: 'Λ- is Type 5 (dual-dash). Both dash from alpha.',
			5: 'Λ-: Type 5, α→α, dash+dash'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE 6: STATIC - Both hands stationary
// ═══════════════════════════════════════════════════════════════════════════

export const TYPE_6_LETTERS: Record<string, LetterExplanation> = {
	α: {
		letter: 'α',
		type: 6,
		typeName: 'Static',
		startPosition: 'alpha',
		endPosition: 'alpha',
		blueMotion: 'static',
		redMotion: 'static',
		levels: {
			0: "In lowercase alpha, both hands stay completely still. They remain on opposite sides.",
			1: 'Alpha (static) maintains alpha position. Neither hand moves.',
			2: 'α is a static letter: both hands are stationary.',
			3: 'α: static + static. α→α (no motion).',
			4: 'α is Type 6 (static). Both static at alpha.',
			5: 'α: Type 6, α→α, static+static'
		}
	},
	β: {
		letter: 'β',
		type: 6,
		typeName: 'Static',
		startPosition: 'beta',
		endPosition: 'beta',
		blueMotion: 'static',
		redMotion: 'static',
		levels: {
			0: "In lowercase beta, both hands stay completely still at the same point.",
			1: 'Beta (static) maintains beta position. Neither hand moves.',
			2: 'β is a static letter: both hands are stationary.',
			3: 'β: static + static. β→β (no motion).',
			4: 'β is Type 6 (static). Both static at beta.',
			5: 'β: Type 6, β→β, static+static'
		}
	},
	γ: {
		letter: 'γ',
		type: 6,
		typeName: 'Static',
		startPosition: 'gamma',
		endPosition: 'gamma',
		blueMotion: 'static',
		redMotion: 'static',
		levels: {
			0: "In lowercase gamma, both hands stay completely still at a right angle.",
			1: 'Gamma (static) maintains gamma position. Neither hand moves.',
			2: 'γ is a static letter: both hands are stationary.',
			3: 'γ: static + static. γ→γ (no motion).',
			4: 'γ is Type 6 (static). Both static at gamma.',
			5: 'γ: Type 6, γ→γ, static+static'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Combined lookup
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_LETTER_EXPLANATIONS: Record<string, LetterExplanation> = {
	...TYPE_1_LETTERS,
	...TYPE_2_LETTERS,
	...TYPE_3_LETTERS,
	...TYPE_4_LETTERS,
	...TYPE_5_LETTERS,
	...TYPE_6_LETTERS
}

/**
 * Get explanation for a letter at a specific level
 */
export function getLetterExplanation(letter: string, level: number): string | undefined {
	const explanation = ALL_LETTER_EXPLANATIONS[letter]
	if (!explanation) return undefined

	// Clamp level to available range
	const clampedLevel = Math.min(Math.max(0, level), 5)
	return explanation.levels[clampedLevel]
}

/**
 * Get all information about a letter
 */
export function getLetterInfo(letter: string): LetterExplanation | undefined {
	return ALL_LETTER_EXPLANATIONS[letter]
}

/**
 * Get all letters of a specific type
 */
export function getLettersByType(type: 1 | 2 | 3 | 4 | 5 | 6): LetterExplanation[] {
	return Object.values(ALL_LETTER_EXPLANATIONS).filter((l) => l.type === type)
}
