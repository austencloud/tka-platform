/**
 * Domain Term Definitions for Tika
 *
 * Pre-written definitions for all TKA domain terms at multiple knowledge levels.
 *
 * Levels:
 * 0 - Pure visual/plain English (anyone can understand)
 * 1 - Can reference grid/position terms
 * 2 - Can reference motion terms
 * 3 - Can reference rotation terms
 * 4 - Can use technical/comparative language
 */

export interface TermDefinition {
	term: string
	category: 'position' | 'motion' | 'rotation' | 'grid' | 'notation' | 'sequence' | 'advanced'
	/** Level at which this term is introduced */
	introducedAt: string
	levels: Record<number, string>
}

// ═══════════════════════════════════════════════════════════════════════════
// GRID TERMS (Level 1.1)
// ═══════════════════════════════════════════════════════════════════════════

export const GRID_TERMS: Record<string, TermDefinition> = {
	grid: {
		term: 'grid',
		category: 'grid',
		introducedAt: '1.1',
		levels: {
			0: 'The grid is the invisible framework with 8 points where your hands can be. Imagine a diamond shape with a point at each compass direction.',
			1: 'The grid has 8 points: 4 cardinal (N, S, E, W) and 4 intercardinal (NE, SE, SW, NW). Hands move between these points.',
			2: 'The grid defines all valid hand positions. Diamond mode uses cardinals, box mode uses intercardinals.',
			3: 'The 8-point grid is the foundation for all position and motion calculations.',
			4: 'Grid modes (diamond/box) determine which 4 points are active. Skewed positions mix modes.'
		}
	},
	diamond: {
		term: 'diamond',
		category: 'grid',
		introducedAt: '1.1',
		levels: {
			0: "Diamond mode means hands use the top, bottom, left, and right points - like a diamond shape turned on its side.",
			1: 'Diamond mode uses the 4 cardinal grid points: north, south, east, west.',
			2: 'Diamond grid mode is the default. Hands move between cardinal points only.',
			3: 'Diamond mode restricts hand positions to cardinal points (n, s, e, w).',
			4: 'Diamond mode uses cardinals. Box mode uses intercardinals. Skewed mixes both.'
		}
	},
	box: {
		term: 'box',
		category: 'grid',
		introducedAt: '1.1',
		levels: {
			0: "Box mode means hands use the corner points - like the corners of a square.",
			1: 'Box mode uses the 4 intercardinal grid points: NE, SE, SW, NW.',
			2: 'Box grid mode is an alternative to diamond. Hands on corners instead of edges.',
			3: 'Box mode restricts positions to intercardinal points (ne, se, sw, nw).',
			4: 'Box mode is the 45° rotation of diamond mode. Same letters apply.'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION TERMS (Level 1.2)
// ═══════════════════════════════════════════════════════════════════════════

export const POSITION_TERMS: Record<string, TermDefinition> = {
	position: {
		term: 'position',
		category: 'position',
		introducedAt: '1.2',
		levels: {
			0: 'Position describes where your two hands are relative to each other on the grid.',
			1: 'Position is the relationship between your two hands: alpha (opposite), beta (same point), or gamma (right angle).',
			2: 'Position determines the starting and ending state of each letter.',
			3: 'There are 3 basic positions in Level 1: alpha, beta, gamma. Level 4+ adds zeta, eta.',
			4: 'Position is defined by the angular relationship between hands, not their absolute grid location.'
		}
	},
	alpha: {
		term: 'alpha',
		category: 'position',
		introducedAt: '1.2',
		levels: {
			0: "Alpha means your hands are on opposite sides of the grid - as far apart as they can be.",
			1: 'Alpha (α) position: hands at opposite grid points, 180° apart.',
			2: 'Alpha is one of three basic positions. Hands face each other across the grid.',
			3: 'Alpha positions: α1 (N/S), α3 (E/W), plus box variants.',
			4: 'Alpha represents maximum hand separation. Many letters maintain or transition through alpha.'
		}
	},
	beta: {
		term: 'beta',
		category: 'position',
		introducedAt: '1.2',
		levels: {
			0: "Beta means both hands are at the same point on the grid - they're together.",
			1: 'Beta (β) position: both hands at the same grid point.',
			2: 'Beta is one of three basic positions. Hands occupy the same location.',
			3: 'Beta positions: β1 (N), β3 (E), β5 (S), β7 (W), plus box variants.',
			4: 'Beta represents minimum separation. Letters like C converge to beta, D diverges from it.'
		}
	},
	gamma: {
		term: 'gamma',
		category: 'position',
		introducedAt: '1.2',
		levels: {
			0: "Gamma means your hands form a right angle - like the corner of a square.",
			1: 'Gamma (γ) position: hands at adjacent grid points, 90° apart.',
			2: 'Gamma is one of three basic positions. Hands at right angles to each other.',
			3: 'Gamma positions: γ1, γ3, γ5, γ7 (each corner of the diamond/box).',
			4: 'Gamma is the most common starting/ending position. Many Type 2 letters use gamma.'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// MOTION TERMS (Level 1.3)
// ═══════════════════════════════════════════════════════════════════════════

export const MOTION_TERMS: Record<string, TermDefinition> = {
	motion: {
		term: 'motion',
		category: 'motion',
		introducedAt: '1.3',
		levels: {
			0: 'Motion is how a hand moves from one grid point to another during a beat.',
			1: 'Each hand performs one of three motions: static (stay), shift (neighbor), or dash (opposite).',
			2: 'Motion type determines which grid point the hand travels to.',
			3: 'Motion types: static (0 points), shift (1 point), dash (2 points).',
			4: 'The 6 letter types are defined by the combination of motion types for each hand.'
		}
	},
	static: {
		term: 'static',
		category: 'motion',
		introducedAt: '1.3',
		levels: {
			0: "Static means the hand doesn't move at all - it stays exactly where it is.",
			1: 'Static motion: hand remains at its current grid point.',
			2: 'Static is one of three motion types. No movement, hand holds position.',
			3: 'Static motion can still have prop rotation (in Level 2+).',
			4: 'Type 2 has one static + one shift. Type 4 has one static + one dash. Type 6 is both static.'
		}
	},
	shift: {
		term: 'shift',
		category: 'motion',
		introducedAt: '1.3',
		levels: {
			0: "Shift means the hand moves to a neighboring point on the grid - just one step over.",
			1: 'Shift motion: hand moves to an adjacent grid point (90° away).',
			2: 'Shift is one of three motion types. Moves one grid point clockwise or counter-clockwise.',
			3: 'Shifts can be pro (prop spins with motion) or anti (prop spins against).',
			4: 'Type 1 is dual-shift, Type 2 is static+shift, Type 3 is dash+shift.'
		}
	},
	dash: {
		term: 'dash',
		category: 'motion',
		introducedAt: '1.3',
		levels: {
			0: "Dash means the hand jumps straight across to the opposite point on the grid.",
			1: 'Dash motion: hand moves to the opposite grid point (180° away).',
			2: 'Dash is one of three motion types. Moves two grid points across.',
			3: 'Dashes cross through center. They have no rotation direction (noRotation).',
			4: 'Type 3 is shift+dash, Type 4 is static+dash, Type 5 is dual-dash.'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// ROTATION TERMS (Level 1.4)
// ═══════════════════════════════════════════════════════════════════════════

export const ROTATION_TERMS: Record<string, TermDefinition> = {
	rotation: {
		term: 'rotation',
		category: 'rotation',
		introducedAt: '1.4',
		levels: {
			0: "Rotation is the direction your prop spins as your hand moves.",
			1: 'Rotation direction: which way the prop spins during a shift motion.',
			2: 'Rotation can be pro (with hand movement) or anti (against it).',
			3: 'Pro = cw when moving cw, ccw when moving ccw. Anti is the opposite.',
			4: 'Rotation direction differentiates letters like A (pro) vs H (anti).'
		}
	},
	pro: {
		term: 'pro',
		category: 'rotation',
		introducedAt: '1.4',
		levels: {
			0: "Pro (prospin) means the prop spins in the same direction your hand is moving - like a wheel rolling forward.",
			1: 'Pro rotation: prop spins with the direction of hand travel.',
			2: 'Pro-shift means the hand shifts while the prop spins in the same direction.',
			3: 'Pro: if hand moves clockwise, prop rotates clockwise.',
			4: 'Pro feels natural, like rolling. Most Type 1 letters (A-G) are pro+pro.'
		}
	},
	anti: {
		term: 'anti',
		category: 'rotation',
		introducedAt: '1.4',
		levels: {
			0: "Anti (antispin) means the prop spins opposite to the direction your hand is moving - like a wheel spinning backward.",
			1: 'Anti rotation: prop spins against the direction of hand travel.',
			2: 'Anti-shift means the hand shifts while the prop spins in the opposite direction.',
			3: 'Anti: if hand moves clockwise, prop rotates counter-clockwise.',
			4: 'Anti creates interesting visual patterns. Letters H-N are anti+anti versions of A-G.'
		}
	},
	prospin: {
		term: 'prospin',
		category: 'rotation',
		introducedAt: '1.4',
		levels: {
			0: "Prospin is another word for pro - the prop spins with your hand's movement.",
			1: 'Prospin = pro rotation. Prop direction matches hand direction.',
			2: 'Prospin is the full term for pro.',
			3: 'Prospin: rotation direction parallel to path vector.',
			4: 'Prospin and antispin are the two fundamental rotation modes in flow arts.'
		}
	},
	antispin: {
		term: 'antispin',
		category: 'rotation',
		introducedAt: '1.4',
		levels: {
			0: "Antispin is another word for anti - the prop spins against your hand's movement.",
			1: 'Antispin = anti rotation. Prop direction opposes hand direction.',
			2: 'Antispin is the full term for anti.',
			3: 'Antispin: rotation direction antiparallel to path vector.',
			4: 'Antispin creates the characteristic "petal" patterns in many flow techniques.'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// NOTATION TERMS (Level 1.7)
// ═══════════════════════════════════════════════════════════════════════════

export const NOTATION_TERMS: Record<string, TermDefinition> = {
	pictograph: {
		term: 'pictograph',
		category: 'notation',
		introducedAt: '1.7',
		levels: {
			0: 'A pictograph is the visual diagram that shows one beat of movement - what both hands do at the same time.',
			1: 'A pictograph shows one beat: two props, their arrows, and position information.',
			2: 'Pictographs encode start position, end position, and both motions.',
			3: 'Pictographs include: props, arrows, TKA glyph, VTG glyph, position glyph.',
			4: 'Pictographs are the atomic unit of TKA notation. Sequences are strings of pictographs.'
		}
	},
	arrow: {
		term: 'arrow',
		category: 'notation',
		introducedAt: '1.7',
		levels: {
			0: 'Arrows show the path each hand takes on the pictograph. The curve tells you the rotation direction.',
			1: 'Arrows indicate motion path and rotation. Curved arrows = pro or anti shift.',
			2: 'Arrow shape encodes motion type and rotation direction.',
			3: 'Pro arrows curve smoothly. Anti arrows have sharper corners. Dash arrows are straight.',
			4: 'Arrow glyphs are systematically generated from motion type + rotation direction.'
		}
	},
	glyph: {
		term: 'glyph',
		category: 'notation',
		introducedAt: '1.7',
		levels: {
			0: 'Glyphs are the symbols on a pictograph - like the letter name, timing info, and position markers.',
			1: 'Glyphs provide metadata: TKA letter, VTG timing, start/end positions.',
			2: 'Multiple glyphs appear on each pictograph to encode different information.',
			3: 'TKA glyph = letter + turns. VTG = vertical timing. Position = start→end.',
			4: 'Glyphs are optional overlays. Pictographs work with or without them.'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// SEQUENCE TERMS (Level 1.8)
// ═══════════════════════════════════════════════════════════════════════════

export const SEQUENCE_TERMS: Record<string, TermDefinition> = {
	sequence: {
		term: 'sequence',
		category: 'sequence',
		introducedAt: '1.8',
		levels: {
			0: 'A sequence is a string of letters performed one after another - like spelling out a word with your movement.',
			1: 'Sequences chain pictographs together. Each beat flows into the next.',
			2: 'Sequences must connect: the end position of one beat must match the start of the next.',
			3: 'Valid sequences maintain position continuity between steps.',
			4: 'Sequence validation ensures smooth transitions. LOOPs are special repeatable sequences.'
		}
	},
	reversal: {
		term: 'reversal',
		category: 'sequence',
		introducedAt: '1.8',
		levels: {
			0: 'A reversal is when you change direction - instead of continuing forward, you go back the way you came.',
			1: 'Reversals change the direction of motion within a sequence.',
			2: 'Reversals allow position-preserving direction changes mid-sequence.',
			3: 'Reversal indicators show where direction swaps occur.',
			4: 'Reversals are key to creating LOOPs that return to their starting state.'
		}
	},
	LOOP: {
		term: 'LOOP',
		category: 'sequence',
		introducedAt: '1.8',
		levels: {
			0: 'A LOOP is a sequence that returns to where it started - you can repeat it forever.',
			1: 'LOOPs are sequences where the end position matches the start position.',
			2: 'LOOPs can be repeated indefinitely because they close the loop.',
			3: 'LOOP detection checks start/end position match and orientation compatibility.',
			4: 'LOOPs are the goal of choreography - seamless, repeatable movement phrases.'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED TERMS (Level 2+)
// ═══════════════════════════════════════════════════════════════════════════

export const ADVANCED_TERMS: Record<string, TermDefinition> = {
	turn: {
		term: 'turn',
		category: 'advanced',
		introducedAt: '2.1',
		levels: {
			0: "A turn is an extra rotation added to a motion - like spinning your prop more than usual.",
			1: 'Turns add 180° rotations to any motion. They change the ending orientation.',
			2: 'Turns are counted in half-rotations (180°). Turn 1 = one extra half rotation.',
			3: 'Turns swap orientation: in→out or out→in for each turn added.',
			4: 'Turns multiply variation count exponentially. Level 2 introduces whole-number turns.'
		}
	},
	orientation: {
		term: 'orientation',
		category: 'advanced',
		introducedAt: '1.6',
		levels: {
			0: "Orientation is which way your prop is facing - pointing inward toward center or outward away from it.",
			1: 'Orientation tracks whether the prop points in (toward center) or out (away).',
			2: 'Orientation changes based on motion type and turn count.',
			3: 'Basic orientations: in, out. Level 3 adds clock, counter (non-radial).',
			4: 'Orientation continuity is required for valid sequences.'
		}
	},
	skew: {
		term: 'skew',
		category: 'advanced',
		introducedAt: '4.1',
		levels: {
			0: "A skew is when you mix the grid types - one hand on the diamond points, one on the box corners.",
			1: 'Skewed positions mix diamond and box grid modes.',
			2: 'Skews occur when hands are on different grid types simultaneously.',
			3: 'Four skew categories: non-skewed→skewed, skewed→skewed, skewed→non-skewed, double skew.',
			4: 'Skews use +/- modifiers to indicate which hand moves one point further or fewer.'
		}
	},
	variation: {
		term: 'variation',
		category: 'advanced',
		introducedAt: '1.7',
		levels: {
			0: "A variation is a different way to perform the same letter - same type of motion, different spot on the grid.",
			1: 'Variations are different executions of the same letter at different grid locations.',
			2: 'Each letter has multiple variations based on starting position and orientation.',
			3: 'Variation count depends on level: Level 1 has base variations, Level 2+ multiplies them.',
			4: 'Variations preserve letter identity while allowing positional flexibility.'
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Combined lookup
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_TERM_DEFINITIONS: Record<string, TermDefinition> = {
	...GRID_TERMS,
	...POSITION_TERMS,
	...MOTION_TERMS,
	...ROTATION_TERMS,
	...NOTATION_TERMS,
	...SEQUENCE_TERMS,
	...ADVANCED_TERMS
}

/**
 * Get definition for a term at a specific level
 */
export function getTermDefinition(term: string, level: number): string | undefined {
	const definition = ALL_TERM_DEFINITIONS[term.toLowerCase()]
	if (!definition) return undefined

	// Clamp level to available range
	const clampedLevel = Math.min(Math.max(0, level), 4)
	return definition.levels[clampedLevel]
}

/**
 * Get all information about a term
 */
export function getTermInfo(term: string): TermDefinition | undefined {
	return ALL_TERM_DEFINITIONS[term.toLowerCase()]
}

/**
 * Get all terms in a category
 */
export function getTermsByCategory(
	category: TermDefinition['category']
): TermDefinition[] {
	return Object.values(ALL_TERM_DEFINITIONS).filter((t) => t.category === category)
}

/**
 * Check if a term is available at a given concept level
 */
export function isTermAvailableAtLevel(term: string, completedConcepts: string[]): boolean {
	const definition = ALL_TERM_DEFINITIONS[term.toLowerCase()]
	if (!definition) return false

	return completedConcepts.includes(definition.introducedAt)
}
