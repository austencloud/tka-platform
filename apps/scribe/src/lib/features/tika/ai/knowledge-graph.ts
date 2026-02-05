/**
 * TKA Knowledge Graph
 *
 * Defines the granular learning concepts for the TKA curriculum.
 * Each concept has prerequisites and unlocks specific domain terms.
 *
 * Levels:
 * - Level 1: Base Letters (turn-zero foundation)
 * - Level 2: Turns (180° whole-number rotations)
 * - Level 3: Quarter Turns (90° units, clock/counter)
 * - Level 4: Skews (mixing grid modes)
 */

export interface KnowledgeConcept {
	/** Unique identifier, e.g., "1.1", "2.3" */
	id: string
	/** Major TKA curriculum level (1-4) */
	level: 1 | 2 | 3 | 4
	/** Sub-concept within the level */
	subLevel: number
	/** Human-readable name */
	name: string
	/** Concept IDs that must be completed first */
	prerequisites: string[]
	/** Domain terms this concept unlocks for explanations */
	terms: string[]
	/** Brief description of what this concept covers */
	description: string
}

export const KNOWLEDGE_GRAPH: KnowledgeConcept[] = [
	// ═══════════════════════════════════════════════════════════════════
	// LEVEL 1: Base Letters
	// All 47 letters at turn-zero. Positions, motions, orientations, props.
	// ═══════════════════════════════════════════════════════════════════

	{
		id: '1.1',
		level: 1,
		subLevel: 1,
		name: 'The Grid',
		prerequisites: [],
		terms: [
			'grid',
			'diamond',
			'box',
			'cardinal',
			'intercardinal',
			'north',
			'south',
			'east',
			'west',
			'n',
			's',
			'e',
			'w',
			'ne',
			'se',
			'sw',
			'nw'
		],
		description: 'The 8-point grid where hands can be placed'
	},

	{
		id: '1.2',
		level: 1,
		subLevel: 2,
		name: 'Positions',
		prerequisites: ['1.1'],
		terms: [
			'alpha',
			'beta',
			'gamma',
			'position',
			'opposite',
			'same point',
			'right angle',
			'α',
			'β',
			'γ'
		],
		description: 'How the two hands relate to each other on the grid'
	},

	{
		id: '1.3',
		level: 1,
		subLevel: 3,
		name: 'Motion Types',
		prerequisites: ['1.2'],
		terms: ['static', 'shift', 'dash', 'motion', 'adjacent', 'opposite', 'movement'],
		description: 'The three ways a hand can move (or not move)'
	},

	{
		id: '1.4',
		level: 1,
		subLevel: 4,
		name: 'Rotation Direction',
		prerequisites: ['1.3'],
		terms: ['pro', 'anti', 'prospin', 'antispin', 'with', 'against', 'rotation'],
		description: 'How the prop spins relative to hand movement'
	},

	{
		id: '1.5',
		level: 1,
		subLevel: 5,
		name: 'Letter Types',
		prerequisites: ['1.4'],
		terms: [
			'Type 1',
			'Type 2',
			'Type 3',
			'Type 4',
			'Type 5',
			'Type 6',
			'dual-shift',
			'shift',
			'cross-shift',
			'dash',
			'dual-dash',
			'static',
			'letter type'
		],
		description: 'The 6 categories that organize all 47 letters'
	},

	{
		id: '1.6',
		level: 1,
		subLevel: 6,
		name: 'Orientations',
		prerequisites: ['1.4'],
		terms: ['in', 'out', 'orientation', 'radial', 'facing'],
		description: 'The starting and ending orientation of each prop'
	},

	{
		id: '1.7',
		level: 1,
		subLevel: 7,
		name: 'Reading Pictographs',
		prerequisites: ['1.5', '1.6'],
		terms: ['pictograph', 'arrow', 'prop', 'glyph', 'beat', 'blue', 'red', 'hand'],
		description: 'How to read the visual notation'
	},

	{
		id: '1.8',
		level: 1,
		subLevel: 8,
		name: 'Sequences & Reversals',
		prerequisites: ['1.7'],
		terms: ['sequence', 'word', 'reversal', 'LOOP', 'combination', 'string'],
		description: 'Combining letters into sequences'
	},

	// ═══════════════════════════════════════════════════════════════════
	// LEVEL 2: Turns (180°)
	// Whole-number turns on any motion on any beat. Swaps orientations.
	// ═══════════════════════════════════════════════════════════════════

	{
		id: '2.1',
		level: 2,
		subLevel: 1,
		name: 'Introducing Turns',
		prerequisites: ['1.8'],
		terms: ['turn', 'turn number', '180°', 'half turn', 'rotation count'],
		description: 'Adding whole-number turns to any motion'
	},

	{
		id: '2.2',
		level: 2,
		subLevel: 2,
		name: 'Orientation Swapping',
		prerequisites: ['2.1'],
		terms: ['swap', 'orientation change', 'in→out', 'out→in', 'flip'],
		description: 'How turns change prop orientations'
	},

	{
		id: '2.3',
		level: 2,
		subLevel: 3,
		name: 'Turn Variations',
		prerequisites: ['2.2'],
		terms: ['variation', 'turn count', 'turn variation'],
		description: 'The exponential variety turns create'
	},

	// ═══════════════════════════════════════════════════════════════════
	// LEVEL 3: Quarter Turns (90°)
	// 90° rotation units. Non-radial orientations. Clock/counter tracking.
	// ═══════════════════════════════════════════════════════════════════

	{
		id: '3.1',
		level: 3,
		subLevel: 1,
		name: 'Quarter Turn Units',
		prerequisites: ['2.3'],
		terms: ['quarter turn', '90°', 'non-radial', 'quarter rotation'],
		description: 'Breaking rotations into 90° units instead of 180°'
	},

	{
		id: '3.2',
		level: 3,
		subLevel: 2,
		name: 'Clock/Counter Orientations',
		prerequisites: ['3.1'],
		terms: ['clock', 'counter', 'cw', 'ccw', 'clockwise', 'counter-clockwise', 'counterclockwise'],
		description: 'New orientation states beyond in/out'
	},

	{
		id: '3.3',
		level: 3,
		subLevel: 3,
		name: 'Expanded Position Variations',
		prerequisites: ['3.2'],
		terms: ['position variation', 'non-radial position', 'expanded variation'],
		description: 'How 90° turns expand position possibilities'
	},

	// ═══════════════════════════════════════════════════════════════════
	// LEVEL 4: Skews
	// Mixing grid modes (diamond ↔ box). Four skew categories.
	// ═══════════════════════════════════════════════════════════════════

	{
		id: '4.1',
		level: 4,
		subLevel: 1,
		name: 'Grid Mode Mixing',
		prerequisites: ['3.3'],
		terms: ['skew', 'skewed', 'mixed grid', 'diamond-box', 'grid mode'],
		description: 'Combining diamond and box grid modes'
	},

	{
		id: '4.2',
		level: 4,
		subLevel: 2,
		name: 'Skew Type 1: Non-Skewed → Skewed',
		prerequisites: ['4.1'],
		terms: ['+', '-', 'skew modifier', 'one point further', 'one point fewer', 'plus', 'minus'],
		description: 'Going from normal position into skewed position'
	},

	{
		id: '4.3',
		level: 4,
		subLevel: 3,
		name: 'Skew Type 2: Skewed → Skewed (Normal)',
		prerequisites: ['4.2'],
		terms: ['maintain skew', 'stay skewed'],
		description: 'Normal motions while already in skewed position'
	},

	{
		id: '4.4',
		level: 4,
		subLevel: 4,
		name: 'Skew Type 3: Skewed → Non-Skewed',
		prerequisites: ['4.3'],
		terms: ['resolve skew', 'exit skew', 'return to normal'],
		description: 'One hand skews, other does regular motion, returns to normal'
	},

	{
		id: '4.5',
		level: 4,
		subLevel: 5,
		name: 'Skew Type 4: Double Skew',
		prerequisites: ['4.4'],
		terms: ['double skew', 'both hands skew', 'dual skew'],
		description: 'Both hands skewing simultaneously'
	}
]

// ═══════════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════════

/**
 * Get a concept by its ID
 */
export function getConceptById(id: string): KnowledgeConcept | undefined {
	return KNOWLEDGE_GRAPH.find((c) => c.id === id)
}

/**
 * Get all concepts for a given major level
 */
export function getConceptsByLevel(level: 1 | 2 | 3 | 4): KnowledgeConcept[] {
	return KNOWLEDGE_GRAPH.filter((c) => c.level === level)
}

/**
 * Check if a concept is unlocked given completed concept IDs
 */
export function isConceptUnlocked(conceptId: string, completedIds: Set<string>): boolean {
	const concept = getConceptById(conceptId)
	if (!concept) return false

	// Check all prerequisites are completed
	return concept.prerequisites.every((prereq) => completedIds.has(prereq))
}

/**
 * Get all terms available at a given set of completed concepts
 */
export function getAvailableTerms(completedIds: Set<string>): Set<string> {
	const terms = new Set<string>()

	for (const conceptId of completedIds) {
		const concept = getConceptById(conceptId)
		if (concept) {
			concept.terms.forEach((term) => terms.add(term.toLowerCase()))
		}
	}

	return terms
}

/**
 * Derive the numeric level from a concept ID (e.g., "1.3" → 1.3)
 */
export function getNumericLevel(conceptId: string): number {
	const concept = getConceptById(conceptId)
	if (!concept) return 0
	return concept.level + concept.subLevel / 10
}

/**
 * User's knowledge overlay - what they currently know
 */
export interface UserKnowledgeOverlay {
	/** All domain terms the user has learned */
	knownTerms: Set<string>
	/** Concept IDs the user has completed */
	completedConcepts: Set<string>
	/** Highest concept level completed (e.g., 1.7, 2.3) */
	currentLevel: number
	/** Major TKA level (1, 2, 3, or 4) */
	majorLevel: 1 | 2 | 3 | 4
}

/**
 * Derive the user's knowledge overlay from their completed concepts
 */
export function deriveUserOverlay(completedConceptIds: string[]): UserKnowledgeOverlay {
	const knownTerms = new Set<string>()
	let highestLevel = 0
	let majorLevel: 1 | 2 | 3 | 4 = 1

	for (const conceptId of completedConceptIds) {
		const concept = getConceptById(conceptId)
		if (concept) {
			// Add all terms from this concept
			concept.terms.forEach((term) => knownTerms.add(term.toLowerCase()))

			// Track highest level
			const numericLevel = concept.level + concept.subLevel / 10
			if (numericLevel > highestLevel) {
				highestLevel = numericLevel
				majorLevel = concept.level
			}
		}
	}

	return {
		knownTerms,
		completedConcepts: new Set(completedConceptIds),
		currentLevel: highestLevel,
		majorLevel
	}
}

/**
 * Check if a term is known at the user's current level
 */
export function isTermKnown(term: string, overlay: UserKnowledgeOverlay): boolean {
	return overlay.knownTerms.has(term.toLowerCase())
}

/**
 * Get the next concept to learn (first unlocked but incomplete)
 */
export function getNextConcept(completedIds: Set<string>): KnowledgeConcept | undefined {
	for (const concept of KNOWLEDGE_GRAPH) {
		if (!completedIds.has(concept.id) && isConceptUnlocked(concept.id, completedIds)) {
			return concept
		}
	}
	return undefined
}
