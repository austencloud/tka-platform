/**
 * Baseline Evaluation Scenarios
 *
 * These scenarios establish a measurable baseline for TIKA's performance.
 * Each scenario tests a specific aspect of TKA knowledge and includes
 * grading criteria.
 *
 * Categories covered:
 * - Letter explanations (all 6 types)
 * - Term definitions (positions, motions, rotations)
 * - Comparisons (similar concepts)
 * - Misconception corrections (known trouble spots)
 * - Level-appropriate responses
 */

import type { TikaScenario } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// Letter Explanation Scenarios
// ═══════════════════════════════════════════════════════════════════════════

const letterExplanationScenarios: TikaScenario[] = [
	{
		id: 'letter-type1-basic',
		name: { en: 'Type 1 Letter Explanation (A)' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'What is the letter A in TKA?' },
		criteria: {
			mustInclude: ['Type 1', 'dual-shift', 'shift', 'both hands'],
			mustNotInclude: ['turn', 'quarter', 'skew'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [
				{ en: 'A is a Type 1 (Dual-Shift) letter' },
				{ en: 'Both hands shift (move to adjacent points)' },
				{ en: 'Should mention start and end positions' }
			]
		},
		testsKnowledgeNodes: ['letter-A', 'type-1', 'shift'],
		difficulty: 'easy'
	},
	{
		id: 'letter-type2-basic',
		name: { en: 'Type 2 Letter Explanation (W)' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'Can you explain what letter W means?' },
		criteria: {
			mustInclude: ['Type 2', 'shift', 'static', 'one hand'],
			mustNotInclude: ['turn', 'quarter', 'skew'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [
				{ en: 'W is a Type 2 (Shift) letter' },
				{ en: 'One hand shifts while the other stays static' }
			]
		},
		testsKnowledgeNodes: ['letter-W', 'type-2', 'shift', 'static'],
		difficulty: 'easy'
	},
	{
		id: 'letter-type3-naming',
		name: { en: 'Type 3 Letter with Dash Suffix (Sigma dash)' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'What is Sigma dash?' },
		criteria: {
			mustInclude: ['Type 3', 'Cross-Shift', 'Σ-', 'shift', 'dash'],
			mustNotInclude: ['turn', 'quarter', 'skew'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [
				{ en: 'Sigma dash (Σ-) is a Type 3 letter' },
				{ en: 'The "-" suffix indicates Type 3 (Cross-Shift)' },
				{ en: 'One hand shifts, one hand dashes' }
			],
			commonMistakes: [
				{ en: 'Confusing "dash" in the name with dash motion type' },
				{ en: 'Thinking Σ- is just Σ with a dash motion' }
			]
		},
		testsKnowledgeNodes: ['letter-sigma-dash', 'type-3', 'naming-convention'],
		difficulty: 'medium'
	},
	{
		id: 'letter-type4-basic',
		name: { en: 'Type 4 Letter Explanation (Phi)' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'Tell me about the letter Phi' },
		criteria: {
			mustInclude: ['Type 4', 'Dash', 'Φ', 'static'],
			mustNotInclude: ['turn', 'quarter', 'skew'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [
				{ en: 'Phi (Φ) is a Type 4 (Dash) letter' },
				{ en: 'One hand dashes (moves to opposite point)' },
				{ en: 'One hand stays static' }
			]
		},
		testsKnowledgeNodes: ['letter-phi', 'type-4', 'dash'],
		difficulty: 'easy'
	},
	{
		id: 'letter-type5-basic',
		name: { en: 'Type 5 Letter Explanation (Phi dash)' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'What is Phi dash?' },
		criteria: {
			mustInclude: ['Type 5', 'Dual-Dash', 'Φ-', 'both hands', 'dash'],
			mustNotInclude: ['turn', 'quarter', 'skew'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [
				{ en: 'Phi dash (Φ-) is a Type 5 (Dual-Dash) letter' },
				{ en: 'Both hands dash simultaneously' }
			]
		},
		testsKnowledgeNodes: ['letter-phi-dash', 'type-5', 'dual-dash'],
		difficulty: 'easy'
	},
	{
		id: 'letter-type6-basic',
		name: { en: 'Type 6 Letter Explanation (alpha lowercase)' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'What does the lowercase alpha letter mean?' },
		criteria: {
			mustInclude: ['Type 6', 'Static', 'α', 'both hands', 'stationary'],
			mustNotInclude: ['turn', 'quarter', 'skew'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [
				{ en: 'Lowercase α is a Type 6 (Static) letter' },
				{ en: 'Both hands remain stationary' },
				{ en: 'Props may still rotate' }
			]
		},
		testsKnowledgeNodes: ['letter-alpha-static', 'type-6', 'static'],
		difficulty: 'easy'
	}
];

// ═══════════════════════════════════════════════════════════════════════════
// Term Definition Scenarios
// ═══════════════════════════════════════════════════════════════════════════

const termDefinitionScenarios: TikaScenario[] = [
	{
		id: 'term-alpha-position',
		name: { en: 'Alpha Position Definition' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does alpha mean?' },
		criteria: {
			mustInclude: ['position', 'opposite', 'grid'],
			mustNotInclude: ['180 degrees', 'perpendicular', 'turn', 'skew'],
			expectedTools: ['get_term_definition', 'get_position_info'],
			keyFacts: [
				{ en: 'Alpha is a position type' },
				{ en: 'Hands are at opposite grid points' }
			],
			commonMistakes: [
				{ en: 'Using "180 degrees" instead of "opposite points"' }
			]
		},
		testsKnowledgeNodes: ['position-alpha'],
		difficulty: 'easy'
	},
	{
		id: 'term-beta-position',
		name: { en: 'Beta Position Definition' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What is beta in TKA?' },
		criteria: {
			mustInclude: ['position', 'same point', 'grid'],
			mustNotInclude: ['0 degrees', 'turn', 'skew'],
			expectedTools: ['get_term_definition', 'get_position_info'],
			keyFacts: [
				{ en: 'Beta is a position type' },
				{ en: 'Both hands are at the same grid point' }
			]
		},
		testsKnowledgeNodes: ['position-beta'],
		difficulty: 'easy'
	},
	{
		id: 'term-gamma-position',
		name: { en: 'Gamma Position Definition' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What is gamma?' },
		criteria: {
			mustInclude: ['position', 'right angle', 'adjacent'],
			mustNotInclude: ['90 degrees', 'perpendicular', 'turn', 'skew'],
			expectedTools: ['get_term_definition', 'get_position_info'],
			keyFacts: [
				{ en: 'Gamma is a position type' },
				{ en: 'Hands form a right angle on the grid' }
			],
			commonMistakes: [
				{ en: 'Using "perpendicular" instead of "right angle"' },
				{ en: 'Using "90 degrees" instead of "adjacent"' }
			]
		},
		testsKnowledgeNodes: ['position-gamma'],
		difficulty: 'easy'
	},
	{
		id: 'term-shift-motion',
		name: { en: 'Shift Motion Definition' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does shift mean?' },
		criteria: {
			mustInclude: ['motion', 'adjacent', 'grid point'],
			mustNotInclude: ['90 degrees', 'turn', 'skew'],
			expectedTools: ['get_term_definition'],
			keyFacts: [
				{ en: 'Shift is a motion type' },
				{ en: 'Hand moves to an adjacent grid point' }
			]
		},
		testsKnowledgeNodes: ['motion-shift'],
		difficulty: 'easy'
	},
	{
		id: 'term-dash-motion',
		name: { en: 'Dash Motion Definition' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What is a dash in TKA?' },
		criteria: {
			mustInclude: ['motion', 'opposite', 'grid point'],
			mustNotInclude: ['180 degrees', 'turn', 'skew'],
			expectedTools: ['get_term_definition'],
			keyFacts: [
				{ en: 'Dash is a motion type' },
				{ en: 'Hand moves to the opposite grid point' }
			]
		},
		testsKnowledgeNodes: ['motion-dash'],
		difficulty: 'easy'
	},
	{
		id: 'term-pro-rotation',
		name: { en: 'Pro Rotation Definition' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's pro rotation?" },
		criteria: {
			mustInclude: ['rotation', 'prop', 'with', 'direction'],
			mustNotInclude: ['turn', 'skew'],
			expectedTools: ['get_term_definition'],
			keyFacts: [
				{ en: 'Pro (prospin) is a rotation direction' },
				{ en: 'Prop rotates with the direction of hand travel' }
			]
		},
		testsKnowledgeNodes: ['rotation-pro'],
		difficulty: 'easy'
	},
	{
		id: 'term-anti-rotation',
		name: { en: 'Anti Rotation Definition' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's antispin?" },
		criteria: {
			mustInclude: ['rotation', 'prop', 'against', 'direction'],
			mustNotInclude: ['turn', 'skew'],
			expectedTools: ['get_term_definition'],
			keyFacts: [
				{ en: 'Anti (antispin) is a rotation direction' },
				{ en: 'Prop rotates against the direction of hand travel' }
			]
		},
		testsKnowledgeNodes: ['rotation-anti'],
		difficulty: 'easy'
	}
];

// ═══════════════════════════════════════════════════════════════════════════
// Comparison Scenarios
// ═══════════════════════════════════════════════════════════════════════════

const comparisonScenarios: TikaScenario[] = [
	{
		id: 'compare-type1-type3',
		name: { en: 'Compare Type 1 and Type 3' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: "What's the difference between Type 1 and Type 3 letters?" },
		criteria: {
			mustInclude: ['Type 1', 'Type 3', 'shift', 'dash', 'both hands'],
			mustNotInclude: ['turn', 'skew'],
			expectedTools: ['list_letters_by_type', 'compare_letters'],
			keyFacts: [
				{ en: 'Type 1: Both hands shift' },
				{ en: 'Type 3: One hand shifts, one dashes' },
				{ en: 'Both types have both hands moving' }
			],
			commonMistakes: [
				{ en: 'Saying "Type 1 has both hands moving" as the distinguishing feature' }
			]
		},
		testsKnowledgeNodes: ['type-1', 'type-3', 'shift', 'dash'],
		difficulty: 'medium'
	},
	{
		id: 'compare-alpha-beta',
		name: { en: 'Compare Alpha and Beta Positions' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'How are alpha and beta different?' },
		criteria: {
			mustInclude: ['position', 'opposite', 'same point'],
			mustNotInclude: ['degrees', 'turn', 'skew'],
			expectedTools: ['get_position_info', 'compare_letters'],
			keyFacts: [
				{ en: 'Alpha: Hands at opposite points' },
				{ en: 'Beta: Hands at the same point' }
			]
		},
		testsKnowledgeNodes: ['position-alpha', 'position-beta'],
		difficulty: 'easy'
	},
	{
		id: 'compare-shift-dash',
		name: { en: 'Compare Shift and Dash Motions' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: "What's the difference between a shift and a dash?" },
		criteria: {
			mustInclude: ['motion', 'adjacent', 'opposite'],
			mustNotInclude: ['degrees', 'turn', 'skew'],
			expectedTools: ['get_term_definition'],
			keyFacts: [
				{ en: 'Shift: Move to adjacent point' },
				{ en: 'Dash: Move to opposite point' }
			]
		},
		testsKnowledgeNodes: ['motion-shift', 'motion-dash'],
		difficulty: 'easy'
	},
	{
		id: 'compare-pro-anti',
		name: { en: 'Compare Pro and Anti Rotations' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: "What's the difference between pro and anti?" },
		criteria: {
			mustInclude: ['rotation', 'prop', 'with', 'against'],
			mustNotInclude: ['turn', 'skew'],
			expectedTools: ['get_term_definition'],
			keyFacts: [
				{ en: 'Pro: Prop rotates with hand movement' },
				{ en: 'Anti: Prop rotates against hand movement' }
			]
		},
		testsKnowledgeNodes: ['rotation-pro', 'rotation-anti'],
		difficulty: 'easy'
	}
];

// ═══════════════════════════════════════════════════════════════════════════
// Misconception Correction Scenarios
// ═══════════════════════════════════════════════════════════════════════════

const misconceptionScenarios: TikaScenario[] = [
	{
		id: 'misconception-type1-both-move',
		name: { en: 'Misconception: Type 1 = Both Hands Move' },
		category: 'misconception-correction',
		userLevel: 1,
		question: { en: 'Type 1 is when both hands move, right?' },
		criteria: {
			mustInclude: ['shift', 'Type 3', 'Type 5'],
			mustNotInclude: ['turn', 'skew'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [
				{ en: 'MUST correct this misconception' },
				{ en: 'Type 1 is when both hands SHIFT' },
				{ en: 'Types 3 and 5 also have both hands moving' }
			],
			commonMistakes: [
				{ en: 'Agreeing that Type 1 = both hands move' },
				{ en: 'Not mentioning Types 3 and 5' }
			]
		},
		testsKnowledgeNodes: ['type-1', 'type-3', 'type-5', 'misconception-both-move'],
		difficulty: 'hard'
	},
	{
		id: 'misconception-type-letters',
		name: { en: 'Misconception: Types are Lettered' },
		category: 'misconception-correction',
		userLevel: 1,
		question: { en: 'Is A a Type A letter?' },
		criteria: {
			mustInclude: ['Type 1', 'numbered', '1-6'],
			mustNotInclude: ['Type A'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [
				{ en: 'MUST correct: Types are numbered 1-6, not lettered' },
				{ en: 'A is a Type 1 letter' }
			],
			commonMistakes: [
				{ en: 'Accepting "Type A" terminology' }
			]
		},
		testsKnowledgeNodes: ['type-naming-convention', 'letter-A'],
		difficulty: 'medium'
	},
	{
		id: 'misconception-dash-name-vs-motion',
		name: { en: 'Misconception: W-dash means W with Dash Motion' },
		category: 'misconception-correction',
		userLevel: 1,
		question: { en: "Is W dash the letter W but with a dash motion?" },
		criteria: {
			mustInclude: ['Type 3', 'naming', 'convention', 'Σ-'],
			mustNotInclude: ['turn', 'skew'],
			expectedTools: ['get_letter_explanation', 'list_letters_by_type'],
			keyFacts: [
				{ en: 'MUST correct this misconception' },
				{ en: 'W- is a separate letter (Type 3)' },
				{ en: 'The "-" suffix is a naming convention, not a modifier' }
			],
			commonMistakes: [
				{ en: 'Agreeing that W- is W with dash motion' },
				{ en: 'Not explaining the naming convention' }
			]
		},
		testsKnowledgeNodes: ['naming-convention', 'type-3', 'letter-W-dash'],
		difficulty: 'hard'
	}
];

// ═══════════════════════════════════════════════════════════════════════════
// Level-Appropriate Scenarios
// ═══════════════════════════════════════════════════════════════════════════

const levelAppropriateScenarios: TikaScenario[] = [
	{
		id: 'level1-no-turns',
		name: { en: 'Level 1: Should Not Mention Turns' },
		category: 'concept-question',
		userLevel: 1,
		question: { en: 'How do I make a sequence loop?' },
		criteria: {
			mustInclude: ['position', 'start', 'end', 'LOOP'],
			mustNotInclude: ['turn', 'quarter', '90', '180', 'skew'],
			expectedTools: [],
			keyFacts: [
				{ en: 'Explain LOOP concept at Level 1' },
				{ en: 'Focus on positions, not turns' }
			]
		},
		testsKnowledgeNodes: ['sequence', 'loop', 'level-constraints'],
		difficulty: 'medium'
	},
	{
		id: 'level2-can-mention-turns',
		name: { en: 'Level 2: Can Mention Turns' },
		category: 'concept-question',
		userLevel: 2,
		question: { en: 'How do turns affect a sequence?' },
		criteria: {
			mustInclude: ['turn', 'orientation', 'swap'],
			mustNotInclude: ['quarter', '90', 'skew', 'clock', 'counter'],
			expectedTools: [],
			keyFacts: [
				{ en: 'Explain turns at Level 2' },
				{ en: 'Mention orientation swapping' },
				{ en: 'Do NOT mention quarter turns (Level 3)' }
			]
		},
		testsKnowledgeNodes: ['turn', 'orientation', 'level-constraints'],
		difficulty: 'medium'
	},
	{
		id: 'level3-quarter-turns',
		name: { en: 'Level 3: Can Mention Quarter Turns' },
		category: 'concept-question',
		userLevel: 3,
		question: { en: 'What are clock and counter orientations?' },
		criteria: {
			mustInclude: ['quarter', 'clock', 'counter', 'non-radial'],
			mustNotInclude: ['skew', 'zeta', 'eta'],
			expectedTools: [],
			keyFacts: [
				{ en: 'Explain clock/counter at Level 3' },
				{ en: 'Relate to 90-degree units' },
				{ en: 'Do NOT mention skews (Level 4)' }
			]
		},
		testsKnowledgeNodes: ['quarter-turn', 'clock', 'counter', 'level-constraints'],
		difficulty: 'medium'
	},
	{
		id: 'level4-skews',
		name: { en: 'Level 4: Can Mention Skews' },
		category: 'concept-question',
		userLevel: 4,
		question: { en: 'What is a skewed position?' },
		criteria: {
			mustInclude: ['skew', 'diamond', 'box', 'cardinal', 'intercardinal'],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [
				{ en: 'Explain skewed positions' },
				{ en: 'Mixing diamond and box grids' }
			]
		},
		testsKnowledgeNodes: ['skew', 'zeta', 'eta', 'level-constraints'],
		difficulty: 'medium'
	}
];

// ═══════════════════════════════════════════════════════════════════════════
// Edge Case Scenarios
// ═══════════════════════════════════════════════════════════════════════════

const edgeCaseScenarios: TikaScenario[] = [
	{
		id: 'edge-greek-letter-confusion',
		name: { en: 'Edge: Greek Letters as Positions vs Letters' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: "What's the difference between alpha the position and alpha the letter?" },
		criteria: {
			mustInclude: ['position', 'letter', 'Type 6', 'lowercase'],
			mustNotInclude: ['turn', 'skew'],
			expectedTools: ['get_position_info', 'get_letter_explanation'],
			keyFacts: [
				{ en: 'Alpha (position): Hands at opposite points' },
				{ en: 'α (letter): Type 6 static letter, lowercase' }
			]
		},
		testsKnowledgeNodes: ['position-alpha', 'letter-alpha-static'],
		difficulty: 'hard'
	},
	{
		id: 'edge-empty-question',
		name: { en: 'Edge: Vague Question' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'Tell me about TKA' },
		criteria: {
			mustInclude: ['notation', 'flow arts', 'letters', 'pictograph'],
			mustNotInclude: ['turn', 'skew'],
			expectedTools: [],
			keyFacts: [
				{ en: 'Should give helpful overview' },
				{ en: 'Mention it is a notation system' },
				{ en: 'Should be beginner-friendly' }
			]
		},
		testsKnowledgeNodes: ['tka-overview'],
		difficulty: 'medium'
	},
	{
		id: 'edge-advanced-at-level1',
		name: { en: 'Edge: Advanced Question from Level 1 User' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'How do skews work?' },
		criteria: {
			mustInclude: ['level', 'advanced', 'prerequisite'],
			mustNotInclude: ['zeta', 'eta', 'detailed skew explanation'],
			expectedTools: [],
			keyFacts: [
				{ en: 'Should acknowledge this is advanced' },
				{ en: 'Should redirect to current level' },
				{ en: 'Should NOT explain skews in detail' }
			]
		},
		testsKnowledgeNodes: ['level-constraints', 'skew'],
		difficulty: 'hard'
	}
];

// ═══════════════════════════════════════════════════════════════════════════
// Export All Scenarios
// ═══════════════════════════════════════════════════════════════════════════

export const baselineScenarios: TikaScenario[] = [
	...letterExplanationScenarios,
	...termDefinitionScenarios,
	...comparisonScenarios,
	...misconceptionScenarios,
	...levelAppropriateScenarios,
	...edgeCaseScenarios
];

export const scenariosByCategory = {
	'letter-explanation': letterExplanationScenarios,
	'term-definition': termDefinitionScenarios,
	'letter-comparison': comparisonScenarios,
	'misconception-correction': misconceptionScenarios,
	'concept-question': levelAppropriateScenarios,
	'edge-case': edgeCaseScenarios
};

export const scenarioCount = baselineScenarios.length;

/**
 * Get scenarios filtered by criteria
 */
export function filterScenarios(options: {
	category?: string;
	level?: 1 | 2 | 3 | 4;
	difficulty?: 'easy' | 'medium' | 'hard' | 'edge-case';
}): TikaScenario[] {
	return baselineScenarios.filter((s) => {
		if (options.category && s.category !== options.category) return false;
		if (options.level && s.userLevel !== options.level) return false;
		if (options.difficulty && s.difficulty !== options.difficulty) return false;
		return true;
	});
}
