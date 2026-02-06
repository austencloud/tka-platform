/**
 * Beginner Evaluation Scenarios
 *
 * Comprehensive stress test for TIKA's beginner response handling.
 * Tests detection of complete beginners across all foundational concepts,
 * with multiple question phrasings and edge cases.
 *
 * Categories:
 * - Position questions (alpha, beta, gamma)
 * - Motion questions (shift, dash, static)
 * - Rotation questions (pro, anti)
 * - Letter type questions (Type 1-6)
 * - Grid questions
 * - Pictograph questions
 * - Letter-specific questions
 * - Meta/overview questions
 * - Edge cases (typos, minimal input, etc.)
 */

import type { TikaScenario } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// Position Questions (Alpha, Beta, Gamma)
// ═══════════════════════════════════════════════════════════════════════════

const alphaPositionScenarios: TikaScenario[] = [
	// Curious beginner
	{
		id: 'beginner-alpha-1',
		name: { en: "Alpha - Curious: What's alpha?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's alpha?" },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition', 'contextData', 'JSON'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-2',
		name: { en: 'Alpha - Curious: What does alpha mean?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does alpha mean?' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition', 'contextData'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-3',
		name: { en: 'Alpha - Curious: Can you explain alpha?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'Can you explain alpha?' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-4',
		name: { en: 'Alpha - Curious: I keep hearing alpha' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'I keep hearing alpha, what is it?' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-5',
		name: { en: 'Alpha - Short: Alpha position?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'Alpha position?' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	// Academic
	{
		id: 'beginner-alpha-6',
		name: { en: 'Alpha - Academic: Define alpha position' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'Could you define the alpha position in TKA?' },
		criteria: {
			mustInclude: ['opposite', 'hands', 'grid'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-7',
		name: { en: 'Alpha - Academic: Formal definition' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What is the formal definition of alpha?' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	// Confused/frustrated
	{
		id: 'beginner-alpha-9',
		name: { en: "Alpha - Confused: I don't get alpha" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "I don't get alpha" },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-10',
		name: { en: 'Alpha - Confused: What even is alpha' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What even is alpha' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-11',
		name: { en: "Alpha - Confused: Everyone keeps saying alpha and I'm lost" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "Everyone keeps saying alpha and I'm lost" },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-12',
		name: { en: 'Alpha - Confused: Why is it called alpha??' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'Why is it called alpha??' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-13',
		name: { en: 'Alpha - Confused: alpha???' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'alpha???' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	// Casual/typos
	{
		id: 'beginner-alpha-14',
		name: { en: 'Alpha - Casual: so whats alpha' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'so whats alpha' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-15',
		name: { en: 'Alpha - Casual: alpha thing??' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'alpha thing??' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Alpha means hands at opposite points' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-16',
		name: { en: 'Alpha - Typo: aplha' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'aplha' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition', 'typo', 'spelled'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should silently correct typo and explain alpha' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection', 'typo-handling'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-17',
		name: { en: 'Alpha - Typo: wats alpha' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'wats alpha' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should understand informal phrasing' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-alpha-18',
		name: { en: 'Alpha - Typo: alph' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'alph' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should understand truncated term' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	}
]

const betaPositionScenarios: TikaScenario[] = [
	{
		id: 'beginner-beta-1',
		name: { en: "Beta - Curious: What's beta?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's beta?" },
		criteria: {
			mustInclude: ['same', 'point', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Beta means hands at the same point' }]
		},
		testsKnowledgeNodes: ['position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-beta-2',
		name: { en: 'Beta - Curious: What does beta mean?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does beta mean?' },
		criteria: {
			mustInclude: ['same', 'point', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Beta means hands at the same point' }]
		},
		testsKnowledgeNodes: ['position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-beta-3',
		name: { en: 'Beta - Short: beta position?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'beta position?' },
		criteria: {
			mustInclude: ['same', 'point'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Beta means hands at the same point' }]
		},
		testsKnowledgeNodes: ['position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-beta-4',
		name: { en: "Beta - Confused: I don't understand beta" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "I don't understand beta" },
		criteria: {
			mustInclude: ['same', 'point'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Beta means hands at the same point' }]
		},
		testsKnowledgeNodes: ['position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-beta-5',
		name: { en: 'Beta - Casual: whats beta' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'whats beta' },
		criteria: {
			mustInclude: ['same', 'point'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Beta means hands at the same point' }]
		},
		testsKnowledgeNodes: ['position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-beta-6',
		name: { en: 'Beta - Typo: betta' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'betta' },
		criteria: {
			mustInclude: ['same', 'point'],
			mustNotInclude: ['variation', 'startPosition', 'typo', 'spelled'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should silently correct typo and explain beta' }]
		},
		testsKnowledgeNodes: ['position-beta', 'beginner-detection', 'typo-handling'],
		difficulty: 'easy'
	}
]

const gammaPositionScenarios: TikaScenario[] = [
	{
		id: 'beginner-gamma-1',
		name: { en: "Gamma - Curious: What's gamma?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's gamma?" },
		criteria: {
			mustInclude: ['right angle', 'hands'],
			mustNotInclude: ['variation', 'startPosition', 'perpendicular', '90 degrees'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Gamma means hands form a right angle' }]
		},
		testsKnowledgeNodes: ['position-gamma', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-gamma-2',
		name: { en: 'Gamma - Curious: What does gamma mean?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does gamma mean?' },
		criteria: {
			mustInclude: ['right angle', 'hands'],
			mustNotInclude: ['variation', 'startPosition', 'perpendicular'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Gamma means hands form a right angle' }]
		},
		testsKnowledgeNodes: ['position-gamma', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-gamma-3',
		name: { en: 'Gamma - Short: gamma?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'gamma?' },
		criteria: {
			mustInclude: ['right angle'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Gamma means hands form a right angle' }]
		},
		testsKnowledgeNodes: ['position-gamma', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-gamma-4',
		name: { en: 'Gamma - Request: explain gamma' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'explain gamma' },
		criteria: {
			mustInclude: ['right angle'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Gamma means hands form a right angle' }]
		},
		testsKnowledgeNodes: ['position-gamma', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-gamma-5',
		name: { en: 'Gamma - Typo: gama' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'gama' },
		criteria: {
			mustInclude: ['right angle'],
			mustNotInclude: ['variation', 'startPosition', 'typo', 'spelled'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should silently correct typo and explain gamma' }]
		},
		testsKnowledgeNodes: ['position-gamma', 'beginner-detection', 'typo-handling'],
		difficulty: 'easy'
	}
]

const positionComparisonScenarios: TikaScenario[] = [
	{
		id: 'beginner-pos-compare-1',
		name: { en: 'Position: Alpha vs beta' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: "What's the difference between alpha and beta?" },
		criteria: {
			mustInclude: ['opposite', 'same'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['compare_positions', 'get_position_info'],
			keyFacts: [{ en: 'Alpha: opposite points. Beta: same point.' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pos-compare-2',
		name: { en: 'Position: Alpha vs beta short' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'Alpha vs beta?' },
		criteria: {
			mustInclude: ['opposite', 'same'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['compare_positions', 'get_position_info'],
			keyFacts: [{ en: 'Alpha: opposite points. Beta: same point.' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pos-compare-3',
		name: { en: 'Position: alpha or beta which is which' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'alpha or beta which is which' },
		criteria: {
			mustInclude: ['opposite', 'same'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['compare_positions', 'get_position_info'],
			keyFacts: [{ en: 'Alpha: opposite points. Beta: same point.' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pos-compare-4',
		name: { en: 'Position: how is gamma different' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'how is gamma different' },
		criteria: {
			mustInclude: ['right angle'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_position_info', 'compare_positions'],
			keyFacts: [{ en: 'Gamma: hands form a right angle' }]
		},
		testsKnowledgeNodes: ['position-gamma', 'beginner-detection'],
		difficulty: 'easy'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Motion Questions (Shift, Dash, Static)
// ═══════════════════════════════════════════════════════════════════════════

const shiftMotionScenarios: TikaScenario[] = [
	{
		id: 'beginner-shift-1',
		name: { en: "Shift - Curious: What's a shift?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's a shift?" },
		criteria: {
			mustInclude: ['adjacent', 'grid'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Shift: hand moves to adjacent grid point' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-shift-2',
		name: { en: 'Shift - Curious: What does shift mean?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does shift mean?' },
		criteria: {
			mustInclude: ['adjacent', 'grid'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Shift: hand moves to adjacent grid point' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-shift-3',
		name: { en: 'Shift - Short: shift motion?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'shift motion?' },
		criteria: {
			mustInclude: ['adjacent'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Shift: hand moves to adjacent grid point' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-shift-4',
		name: { en: 'Shift - Query: how does shift work' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'how does shift work' },
		criteria: {
			mustInclude: ['adjacent'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Shift: hand moves to adjacent grid point' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-shift-5',
		name: { en: 'Shift - Short: shifting?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'shifting?' },
		criteria: {
			mustInclude: ['adjacent'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Shift: hand moves to adjacent grid point' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-shift-6',
		name: { en: 'Shift - Typo: shfit' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'shfit' },
		criteria: {
			mustInclude: ['adjacent'],
			mustNotInclude: ['variation', 'startPosition', 'typo', 'spelled'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Should silently correct typo and explain shift' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'beginner-detection', 'typo-handling'],
		difficulty: 'easy'
	}
]

const dashMotionScenarios: TikaScenario[] = [
	{
		id: 'beginner-dash-1',
		name: { en: "Dash - Curious: What's a dash?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's a dash?" },
		criteria: {
			mustInclude: ['opposite', 'grid'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Dash: hand moves to opposite grid point' }]
		},
		testsKnowledgeNodes: ['motion-dash', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-dash-2',
		name: { en: 'Dash - Curious: What does dash mean?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does dash mean?' },
		criteria: {
			mustInclude: ['opposite', 'grid'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Dash: hand moves to opposite grid point' }]
		},
		testsKnowledgeNodes: ['motion-dash', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-dash-3',
		name: { en: 'Dash - Short: dash motion?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'dash motion?' },
		criteria: {
			mustInclude: ['opposite'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Dash: hand moves to opposite grid point' }]
		},
		testsKnowledgeNodes: ['motion-dash', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-dash-4',
		name: { en: 'Dash - Query: what is dashing' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what is dashing' },
		criteria: {
			mustInclude: ['opposite'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Dash: hand moves to opposite grid point' }]
		},
		testsKnowledgeNodes: ['motion-dash', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-dash-5',
		name: { en: 'Dash - Comparison: how is dash different from shift' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'how is dash different from shift' },
		criteria: {
			mustInclude: ['opposite', 'adjacent'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Dash: opposite. Shift: adjacent.' }]
		},
		testsKnowledgeNodes: ['motion-dash', 'motion-shift', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-dash-6',
		name: { en: 'Dash - Typo: dassh' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'dassh' },
		criteria: {
			mustInclude: ['opposite'],
			mustNotInclude: ['variation', 'startPosition', 'typo', 'spelled'],
			expectedTools: ['show_motion_examples', 'get_term_definition'],
			keyFacts: [{ en: 'Should silently correct typo and explain dash' }]
		},
		testsKnowledgeNodes: ['motion-dash', 'beginner-detection', 'typo-handling'],
		difficulty: 'easy'
	}
]

const staticMotionScenarios: TikaScenario[] = [
	{
		id: 'beginner-static-1',
		name: { en: "Static - Curious: What's static?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's static?" },
		criteria: {
			mustInclude: ['remain', 'stay'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Static: hand stays at current grid point' }]
		},
		testsKnowledgeNodes: ['motion-static', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-static-2',
		name: { en: 'Static - Short: static motion?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'static motion?' },
		criteria: {
			mustInclude: ['remain', 'stay'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Static: hand stays at current grid point' }]
		},
		testsKnowledgeNodes: ['motion-static', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-static-3',
		name: { en: 'Static - Question: what does static mean in TKA' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what does static mean in TKA' },
		criteria: {
			mustInclude: ['remain', 'stay'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Static: hand stays at current grid point' }]
		},
		testsKnowledgeNodes: ['motion-static', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-static-4',
		name: { en: 'Static - Clarification: so static means not moving?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'so static means not moving?' },
		criteria: {
			mustInclude: ['remain', 'stay', 'grid'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Static: hand stays at current grid point' }]
		},
		testsKnowledgeNodes: ['motion-static', 'beginner-detection'],
		difficulty: 'easy'
	}
]

const motionComparisonScenarios: TikaScenario[] = [
	{
		id: 'beginner-motion-compare-1',
		name: { en: 'Motion: shift vs dash' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: "What's the difference between shift and dash?" },
		criteria: {
			mustInclude: ['adjacent', 'opposite'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Shift: adjacent. Dash: opposite.' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'motion-dash', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-motion-compare-2',
		name: { en: 'Motion: shift vs dash short' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'shift vs dash' },
		criteria: {
			mustInclude: ['adjacent', 'opposite'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Shift: adjacent. Dash: opposite.' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'motion-dash', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-motion-compare-3',
		name: { en: 'Motion: how are the motions different' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'how are the motions different' },
		criteria: {
			mustInclude: ['shift', 'dash', 'static'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Should explain all three motion types' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'motion-dash', 'motion-static', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-motion-compare-4',
		name: { en: 'Motion: what are all the motion types' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what are all the motion types' },
		criteria: {
			mustInclude: ['shift', 'dash', 'static'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Three motion types: shift, dash, static' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'motion-dash', 'motion-static', 'beginner-detection'],
		difficulty: 'easy'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Rotation Questions (Pro, Anti)
// ═══════════════════════════════════════════════════════════════════════════

const rotationScenarios: TikaScenario[] = [
	{
		id: 'beginner-pro-1',
		name: { en: "Pro - Curious: What's pro?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's pro?" },
		criteria: {
			mustInclude: ['rotation', 'same', 'direction'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Pro: prop rotates with hand movement' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pro-2',
		name: { en: 'Pro - Curious: What does pro mean?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does pro mean?' },
		criteria: {
			mustInclude: ['rotation', 'same', 'direction'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Pro: prop rotates with hand movement' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pro-3',
		name: { en: 'Pro - Short: prospin?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'prospin?' },
		criteria: {
			mustInclude: ['rotation', 'same'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Pro: prop rotates with hand movement' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pro-4',
		name: { en: 'Pro - Short: pro rotation?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'pro rotation?' },
		criteria: {
			mustInclude: ['same', 'direction'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Pro: prop rotates with hand movement' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pro-5',
		name: { en: 'Pro - Typo: prosipn' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'prosipn' },
		criteria: {
			mustInclude: ['rotation', 'same'],
			mustNotInclude: ['variation', 'startPosition', 'typo', 'spelled'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Should silently correct typo and explain prospin' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'beginner-detection', 'typo-handling'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-anti-1',
		name: { en: "Anti - Curious: What's anti?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's anti?" },
		criteria: {
			mustInclude: ['rotation', 'against', 'opposite'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Anti: prop rotates against hand movement' }]
		},
		testsKnowledgeNodes: ['rotation-anti', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-anti-2',
		name: { en: 'Anti - Curious: What does anti mean?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What does anti mean?' },
		criteria: {
			mustInclude: ['rotation', 'against', 'opposite'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Anti: prop rotates against hand movement' }]
		},
		testsKnowledgeNodes: ['rotation-anti', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-anti-3',
		name: { en: 'Anti - Short: antispin?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'antispin?' },
		criteria: {
			mustInclude: ['rotation', 'against'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Anti: prop rotates against hand movement' }]
		},
		testsKnowledgeNodes: ['rotation-anti', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-anti-4',
		name: { en: 'Anti - Short: anti rotation?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'anti rotation?' },
		criteria: {
			mustInclude: ['against', 'opposite'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Anti: prop rotates against hand movement' }]
		},
		testsKnowledgeNodes: ['rotation-anti', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-anti-5',
		name: { en: 'Anti - Comparison: how is anti different from pro' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'how is anti different from pro' },
		criteria: {
			mustInclude: ['with', 'against'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Pro: with. Anti: against.' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'rotation-anti', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-rotation-compare-1',
		name: { en: 'Rotation: pro vs anti' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: "What's the difference between pro and anti?" },
		criteria: {
			mustInclude: ['with', 'against'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Pro: with. Anti: against.' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'rotation-anti', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-rotation-compare-2',
		name: { en: 'Rotation: pro vs anti short' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'pro vs anti' },
		criteria: {
			mustInclude: ['with', 'against'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Pro: with. Anti: against.' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'rotation-anti', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-rotation-compare-3',
		name: { en: 'Rotation: prospin vs antispin' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'prospin vs antispin' },
		criteria: {
			mustInclude: ['with', 'against'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Pro: with. Anti: against.' }]
		},
		testsKnowledgeNodes: ['rotation-pro', 'rotation-anti', 'beginner-detection'],
		difficulty: 'easy'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Letter Type Questions
// ═══════════════════════════════════════════════════════════════════════════

const letterTypeScenarios: TikaScenario[] = [
	{
		id: 'beginner-type1-1',
		name: { en: "Type 1 - Curious: What's Type 1?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's Type 1?" },
		criteria: {
			mustInclude: ['Dual-Shift', 'shift', 'both hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 1: both hands shift' }]
		},
		testsKnowledgeNodes: ['type-1', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type1-2',
		name: { en: 'Type 1 - Curious: What are Type 1 letters?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What are Type 1 letters?' },
		criteria: {
			mustInclude: ['Dual-Shift', 'shift'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 1: both hands shift' }]
		},
		testsKnowledgeNodes: ['type-1', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type1-3',
		name: { en: 'Type 1 - Short: type 1?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'type 1?' },
		criteria: {
			mustInclude: ['Dual-Shift', 'shift'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 1: both hands shift' }]
		},
		testsKnowledgeNodes: ['type-1', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type1-4',
		name: { en: 'Type 1 - Request: tell me about type 1' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'tell me about type 1' },
		criteria: {
			mustInclude: ['Dual-Shift', 'shift'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 1: both hands shift' }]
		},
		testsKnowledgeNodes: ['type-1', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type1-5',
		name: { en: 'Type 1 - Query: what makes something type 1' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what makes something type 1' },
		criteria: {
			mustInclude: ['shift', 'both hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 1: both hands shift' }]
		},
		testsKnowledgeNodes: ['type-1', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type2-1',
		name: { en: "Type 2 - Curious: What's Type 2?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's Type 2?" },
		criteria: {
			mustInclude: ['Shift', 'static'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 2: one hand shifts, one stays static' }]
		},
		testsKnowledgeNodes: ['type-2', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type3-1',
		name: { en: "Type 3 - Curious: What's Type 3?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's Type 3?" },
		criteria: {
			mustInclude: ['Cross-Shift', 'shift', 'dash'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 3: one hand shifts, one dashes' }]
		},
		testsKnowledgeNodes: ['type-3', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type4-1',
		name: { en: "Type 4 - Curious: What's Type 4?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's Type 4?" },
		criteria: {
			mustInclude: ['Dash', 'static'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 4: one hand dashes, one stays static' }]
		},
		testsKnowledgeNodes: ['type-4', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type5-1',
		name: { en: "Type 5 - Curious: What's Type 5?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's Type 5?" },
		criteria: {
			mustInclude: ['Dual-Dash', 'dash', 'both hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 5: both hands dash' }]
		},
		testsKnowledgeNodes: ['type-5', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type6-1',
		name: { en: "Type 6 - Curious: What's Type 6?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's Type 6?" },
		criteria: {
			mustInclude: ['Static', 'stationary'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Type 6: both hands stay stationary' }]
		},
		testsKnowledgeNodes: ['type-6', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type-overview-1',
		name: { en: 'Type Overview: How many types are there?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'How many types are there?' },
		criteria: {
			mustInclude: ['6', 'types'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'There are 6 letter types' }]
		},
		testsKnowledgeNodes: ['type-overview', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type-overview-2',
		name: { en: 'Type Overview: What are all the letter types?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What are all the letter types?' },
		criteria: {
			mustInclude: ['Type 1', 'Type 2', 'Type 3', 'Type 4', 'Type 5', 'Type 6'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'Should list all 6 types' }]
		},
		testsKnowledgeNodes: ['type-overview', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type-compare-1',
		name: { en: 'Type Compare: type 1 vs type 2' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: "what's the difference between type 1 and type 2" },
		criteria: {
			mustInclude: ['shift', 'static'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['compare_types'],
			keyFacts: [{ en: 'Type 1: both shift. Type 2: one shifts, one static.' }]
		},
		testsKnowledgeNodes: ['type-1', 'type-2', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-type-typo-1',
		name: { en: 'Type - Typo: typee 1' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'typee 1' },
		criteria: {
			mustInclude: ['Dual-Shift', 'shift'],
			mustNotInclude: ['variation', 'startPosition', 'typo', 'spelled'],
			expectedTools: ['list_letters_by_type'],
			keyFacts: [{ en: 'Should silently correct typo and explain Type 1' }]
		},
		testsKnowledgeNodes: ['type-1', 'beginner-detection', 'typo-handling'],
		difficulty: 'easy'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Misconception Questions (Types are numbered, not lettered)
// ═══════════════════════════════════════════════════════════════════════════

const misconceptionScenarios: TikaScenario[] = [
	{
		id: 'beginner-misconception-typeA',
		name: { en: "Misconception: What's Type A?" },
		category: 'misconception-correction',
		userLevel: 1,
		question: { en: "What's Type A?" },
		criteria: {
			mustInclude: ['numbered', '1-6'],
			mustNotInclude: ['Type A'],
			expectedTools: [],
			keyFacts: [{ en: 'MUST correct: types are numbered 1-6, not lettered' }],
			commonMistakes: [{ en: 'Accepting Type A terminology' }]
		},
		testsKnowledgeNodes: ['type-naming-convention', 'beginner-detection'],
		difficulty: 'medium'
	},
	{
		id: 'beginner-misconception-typeB',
		name: { en: "Misconception: What's Type B?" },
		category: 'misconception-correction',
		userLevel: 1,
		question: { en: "What's Type B?" },
		criteria: {
			mustInclude: ['numbered', '1-6'],
			mustNotInclude: ['Type B'],
			expectedTools: [],
			keyFacts: [{ en: 'MUST correct: types are numbered 1-6, not lettered' }],
			commonMistakes: [{ en: 'Accepting Type B terminology' }]
		},
		testsKnowledgeNodes: ['type-naming-convention', 'beginner-detection'],
		difficulty: 'medium'
	},
	{
		id: 'beginner-misconception-type1-move',
		name: { en: 'Misconception: So Type 1 means both hands move?' },
		category: 'misconception-correction',
		userLevel: 1,
		question: { en: 'So Type 1 means both hands move?' },
		criteria: {
			mustInclude: ['shift', 'Type 3', 'Type 5'],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [
				{ en: 'MUST correct: Type 1 means both hands SHIFT specifically' },
				{ en: 'Types 3 and 5 also have both hands moving' }
			],
			commonMistakes: [{ en: 'Agreeing that Type 1 = both hands move' }]
		},
		testsKnowledgeNodes: ['type-1', 'motion-precision', 'beginner-detection'],
		difficulty: 'hard'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Grid Questions
// ═══════════════════════════════════════════════════════════════════════════

const gridScenarios: TikaScenario[] = [
	{
		id: 'beginner-grid-1',
		name: { en: "Grid - Curious: What's the grid?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's the grid?" },
		criteria: {
			mustInclude: ['points', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'The grid is where hands can be placed' }]
		},
		testsKnowledgeNodes: ['grid', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-grid-2',
		name: { en: 'Grid - Curious: What is the grid system?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What is the grid system?' },
		criteria: {
			mustInclude: ['points', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'The grid is where hands can be placed' }]
		},
		testsKnowledgeNodes: ['grid', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-grid-3',
		name: { en: 'Grid - Query: how does the grid work' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'how does the grid work' },
		criteria: {
			mustInclude: ['points'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'The grid defines hand placement locations' }]
		},
		testsKnowledgeNodes: ['grid', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-grid-4',
		name: { en: 'Grid - Short: grid?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'grid?' },
		criteria: {
			mustInclude: ['points'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'The grid defines hand placement locations' }]
		},
		testsKnowledgeNodes: ['grid', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-grid-5',
		name: { en: 'Grid - Query: what are the grid points' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what are the grid points' },
		criteria: {
			mustInclude: ['cardinal', 'intercardinal'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Grid has cardinal and intercardinal points' }]
		},
		testsKnowledgeNodes: ['grid', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-grid-diamond-1',
		name: { en: "Grid Mode - Diamond: What's diamond mode?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's diamond mode?" },
		criteria: {
			mustInclude: ['cardinal'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Diamond: hands on cardinal points' }]
		},
		testsKnowledgeNodes: ['grid-diamond', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-grid-box-1',
		name: { en: "Grid Mode - Box: What's box mode?" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "What's box mode?" },
		criteria: {
			mustInclude: ['intercardinal'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Box: hands on intercardinal points' }]
		},
		testsKnowledgeNodes: ['grid-box', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-grid-compare-1',
		name: { en: 'Grid Mode - Compare: diamond vs box' },
		category: 'letter-comparison',
		userLevel: 1,
		question: { en: 'diamond vs box' },
		criteria: {
			mustInclude: ['cardinal', 'intercardinal'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Diamond: cardinal. Box: intercardinal.' }]
		},
		testsKnowledgeNodes: ['grid-diamond', 'grid-box', 'beginner-detection'],
		difficulty: 'easy'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Pictograph Questions
// ═══════════════════════════════════════════════════════════════════════════

const pictographScenarios: TikaScenario[] = [
	{
		id: 'beginner-pictograph-1',
		name: { en: 'Pictograph: What is a pictograph?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'What is a pictograph?' },
		criteria: {
			mustInclude: ['visual', 'beat', 'motion'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'A pictograph shows one beat of motion' }]
		},
		testsKnowledgeNodes: ['pictograph', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pictograph-2',
		name: { en: 'Pictograph: How do I read a pictograph?' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'How do I read a pictograph?' },
		criteria: {
			mustInclude: ['arrow', 'prop'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Should explain basic pictograph reading' }]
		},
		testsKnowledgeNodes: ['pictograph', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pictograph-3',
		name: { en: 'Pictograph: what do the symbols mean' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what do the symbols mean' },
		criteria: {
			mustInclude: ['arrow', 'prop'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Should explain pictograph symbols' }]
		},
		testsKnowledgeNodes: ['pictograph', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pictograph-4',
		name: { en: "Pictograph: what's the blue thing" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "what's the blue thing" },
		criteria: {
			mustInclude: ['hand', 'prop'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Blue represents one hand/prop' }]
		},
		testsKnowledgeNodes: ['pictograph-colors', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pictograph-5',
		name: { en: "Pictograph: what's the red thing" },
		category: 'term-definition',
		userLevel: 1,
		question: { en: "what's the red thing" },
		criteria: {
			mustInclude: ['hand', 'prop'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Red represents one hand/prop' }]
		},
		testsKnowledgeNodes: ['pictograph-colors', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-pictograph-6',
		name: { en: 'Pictograph: what do the colors mean' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what do the colors mean' },
		criteria: {
			mustInclude: ['blue', 'red', 'hand'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Blue and red represent the two hands/props' }]
		},
		testsKnowledgeNodes: ['pictograph-colors', 'beginner-detection'],
		difficulty: 'easy'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Letter-Specific Questions
// ═══════════════════════════════════════════════════════════════════════════

const letterSpecificScenarios: TikaScenario[] = [
	{
		id: 'beginner-letter-A-1',
		name: { en: 'Letter A: What is letter A?' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'What is letter A?' },
		criteria: {
			mustInclude: ['Type 1', 'shift'],
			mustNotInclude: ['variation', 'startPosition', 'contextData'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'A is a Type 1 (Dual-Shift) letter' }]
		},
		testsKnowledgeNodes: ['letter-A', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-A-2',
		name: { en: 'Letter A: Tell me about A' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'Tell me about A' },
		criteria: {
			mustInclude: ['Type 1', 'shift'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'A is a Type 1 (Dual-Shift) letter' }]
		},
		testsKnowledgeNodes: ['letter-A', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-A-3',
		name: { en: 'Letter A: A?' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'A?' },
		criteria: {
			mustInclude: ['Type 1', 'shift'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'A is a Type 1 (Dual-Shift) letter' }]
		},
		testsKnowledgeNodes: ['letter-A', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-A-4',
		name: { en: 'Letter A: show me letter A' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'show me letter A' },
		criteria: {
			mustInclude: ['Type 1'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'Should show pictograph of letter A' }]
		},
		testsKnowledgeNodes: ['letter-A', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-B-1',
		name: { en: 'Letter B: what does B look like' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'what does B look like' },
		criteria: {
			mustInclude: ['Type 1'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'B is a Type 1 letter' }]
		},
		testsKnowledgeNodes: ['letter-B', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-C-1',
		name: { en: 'Letter C: explain letter C' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'explain letter C' },
		criteria: {
			mustInclude: ['Type 1'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'C is a Type 1 letter' }]
		},
		testsKnowledgeNodes: ['letter-C', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-sigma-1',
		name: { en: 'Letter Sigma: What is Sigma?' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'What is Sigma?' },
		criteria: {
			mustInclude: ['Type 2', 'Shift', 'static'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'Sigma (Σ) is a Type 2 letter' }]
		},
		testsKnowledgeNodes: ['letter-sigma', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-phi-1',
		name: { en: "Letter Phi: What's Φ?" },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: "What's Φ?" },
		criteria: {
			mustInclude: ['Type 4', 'Dash', 'static'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'Phi (Φ) is a Type 4 letter' }]
		},
		testsKnowledgeNodes: ['letter-phi', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-phi-2',
		name: { en: 'Letter Phi: phi?' },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: 'phi?' },
		criteria: {
			mustInclude: ['Type 4', 'Dash'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'Phi (Φ) is a Type 4 letter' }]
		},
		testsKnowledgeNodes: ['letter-phi', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-letter-greek-1',
		name: { en: 'Greek Letters: what are the Greek letters' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what are the Greek letters' },
		criteria: {
			mustInclude: ['Σ', 'Δ', 'Θ', 'Ω', 'Φ', 'Ψ', 'Λ', 'α', 'β', 'γ'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'Should list Greek letters across types' }]
		},
		testsKnowledgeNodes: ['greek-letters', 'beginner-detection'],
		difficulty: 'easy'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Dash-Suffix Letter Questions (Terminology Trap)
// ═══════════════════════════════════════════════════════════════════════════

const dashSuffixScenarios: TikaScenario[] = [
	{
		id: 'beginner-dash-suffix-1',
		name: { en: "Dash Suffix: What's W-?" },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: "What's W-?" },
		criteria: {
			mustInclude: ['Type 3', 'Cross-Shift'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'W- is a Type 3 (Cross-Shift) letter' }]
		},
		testsKnowledgeNodes: ['letter-W-dash', 'naming-convention', 'beginner-detection'],
		difficulty: 'medium'
	},
	{
		id: 'beginner-dash-suffix-2',
		name: { en: "Dash Suffix: What's Sigma dash?" },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: "What's Sigma dash?" },
		criteria: {
			mustInclude: ['Type 3', 'Cross-Shift', 'Σ-'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'Sigma dash (Σ-) is a Type 3 letter' }]
		},
		testsKnowledgeNodes: ['letter-sigma-dash', 'naming-convention', 'beginner-detection'],
		difficulty: 'medium'
	},
	{
		id: 'beginner-dash-suffix-3',
		name: { en: "Dash Suffix: What's Φ-?" },
		category: 'letter-explanation',
		userLevel: 1,
		question: { en: "What's Φ-?" },
		criteria: {
			mustInclude: ['Type 5', 'Dual-Dash'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_letter_explanation'],
			keyFacts: [{ en: 'Phi dash (Φ-) is a Type 5 letter' }]
		},
		testsKnowledgeNodes: ['letter-phi-dash', 'naming-convention', 'beginner-detection'],
		difficulty: 'medium'
	},
	{
		id: 'beginner-dash-suffix-4',
		name: { en: 'Dash Suffix: what does the dash after the letter mean' },
		category: 'term-definition',
		userLevel: 1,
		question: { en: 'what does the dash after the letter mean' },
		criteria: {
			mustInclude: ['naming', 'convention', 'Type 3', 'Type 5'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'The dash suffix indicates Type 3 or Type 5' }]
		},
		testsKnowledgeNodes: ['naming-convention', 'beginner-detection'],
		difficulty: 'medium'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Meta/Overview Questions
// ═══════════════════════════════════════════════════════════════════════════

const metaScenarios: TikaScenario[] = [
	{
		id: 'beginner-meta-1',
		name: { en: 'Meta: What is TKA?' },
		category: 'concept-question',
		userLevel: 1,
		question: { en: 'What is TKA?' },
		criteria: {
			mustInclude: ['notation', 'flow arts', 'movement'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'TKA is a notation system for flow arts' }]
		},
		testsKnowledgeNodes: ['tka-overview', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-meta-2',
		name: { en: 'Meta: What is The Kinetic Alphabet?' },
		category: 'concept-question',
		userLevel: 1,
		question: { en: 'What is The Kinetic Alphabet?' },
		criteria: {
			mustInclude: ['notation', 'flow arts', 'movement'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'TKA is a notation system for flow arts' }]
		},
		testsKnowledgeNodes: ['tka-overview', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-meta-3',
		name: { en: 'Meta: What is this?' },
		category: 'concept-question',
		userLevel: 1,
		question: { en: 'What is this?' },
		criteria: {
			mustInclude: ['TKA', 'notation'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'Should explain TKA is a notation system' }]
		},
		testsKnowledgeNodes: ['tka-overview', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-meta-4',
		name: { en: 'Meta: Where do I start?' },
		category: 'concept-question',
		userLevel: 1,
		question: { en: 'Where do I start?' },
		criteria: {
			mustInclude: ['grid', 'positions'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'Should give beginner-friendly starting point' }]
		},
		testsKnowledgeNodes: ['tka-overview', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-meta-5',
		name: { en: 'Meta: What should I learn first?' },
		category: 'concept-question',
		userLevel: 1,
		question: { en: 'What should I learn first?' },
		criteria: {
			mustInclude: ['grid', 'positions'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'Should recommend starting with positions/grid' }]
		},
		testsKnowledgeNodes: ['tka-overview', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-meta-6',
		name: { en: "Meta: I'm new, help" },
		category: 'concept-question',
		userLevel: 1,
		question: { en: "I'm new, help" },
		criteria: {
			mustInclude: ['position', 'motion'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'Should provide helpful beginner guidance' }]
		},
		testsKnowledgeNodes: ['tka-overview', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-meta-7',
		name: { en: 'Meta: beginner here' },
		category: 'concept-question',
		userLevel: 1,
		question: { en: 'beginner here' },
		criteria: {
			mustInclude: ['position', 'motion'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'Should provide helpful beginner guidance' }]
		},
		testsKnowledgeNodes: ['tka-overview', 'beginner-detection'],
		difficulty: 'easy'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Edge Cases & Stress Tests
// ═══════════════════════════════════════════════════════════════════════════

const edgeCaseScenarios: TikaScenario[] = [
	// Minimal input
	{
		id: 'beginner-edge-minimal-1',
		name: { en: 'Minimal: alpha' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'alpha' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should interpret as position question' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-edge-minimal-2',
		name: { en: 'Minimal: ?' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: '?' },
		criteria: {
			mustInclude: [],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [{ en: 'Should ask for clarification or offer help' }]
		},
		testsKnowledgeNodes: ['beginner-detection'],
		difficulty: 'edge-case'
	},
	{
		id: 'beginner-edge-minimal-3',
		name: { en: 'Minimal: help' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'help' },
		criteria: {
			mustInclude: [],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [{ en: 'Should offer helpful guidance' }]
		},
		testsKnowledgeNodes: ['beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-edge-minimal-4',
		name: { en: 'Minimal: huh' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'huh' },
		criteria: {
			mustInclude: [],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [{ en: 'Should ask for clarification or offer help' }]
		},
		testsKnowledgeNodes: ['beginner-detection'],
		difficulty: 'edge-case'
	},
	{
		id: 'beginner-edge-minimal-5',
		name: { en: 'Minimal: wat' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'wat' },
		criteria: {
			mustInclude: [],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [{ en: 'Should ask for clarification or offer help' }]
		},
		testsKnowledgeNodes: ['beginner-detection'],
		difficulty: 'edge-case'
	},
	// Mixed case/formatting
	{
		id: 'beginner-edge-case-1',
		name: { en: 'Case: ALPHA' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'ALPHA' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should handle uppercase' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-edge-case-2',
		name: { en: 'Case: Alpha' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'Alpha' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should handle title case' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-edge-case-3',
		name: { en: 'Case: WHAT IS ALPHA' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'WHAT IS ALPHA' },
		criteria: {
			mustInclude: ['opposite', 'hands'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should handle all caps' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-edge-case-4',
		name: { en: 'Case: WhAt Is GaMmA' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'WhAt Is GaMmA' },
		criteria: {
			mustInclude: ['right angle'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['show_position_examples', 'get_position_info'],
			keyFacts: [{ en: 'Should handle mixed case' }]
		},
		testsKnowledgeNodes: ['position-gamma', 'beginner-detection'],
		difficulty: 'easy'
	},
	// Multiple questions
	{
		id: 'beginner-edge-multi-1',
		name: { en: "Multi: What's alpha and beta?" },
		category: 'edge-case',
		userLevel: 1,
		question: { en: "What's alpha and beta?" },
		criteria: {
			mustInclude: ['opposite', 'same'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['compare_positions', 'get_position_info'],
			keyFacts: [{ en: 'Should explain both' }]
		},
		testsKnowledgeNodes: ['position-alpha', 'position-beta', 'beginner-detection'],
		difficulty: 'easy'
	},
	{
		id: 'beginner-edge-multi-2',
		name: { en: 'Multi: Tell me about shift and dash' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'Tell me about shift and dash' },
		criteria: {
			mustInclude: ['adjacent', 'opposite'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: ['get_term_definition'],
			keyFacts: [{ en: 'Should explain both' }]
		},
		testsKnowledgeNodes: ['motion-shift', 'motion-dash', 'beginner-detection'],
		difficulty: 'easy'
	},
	// Boundary/nonsense
	{
		id: 'beginner-edge-boundary-1',
		name: { en: "Boundary: What's zeta?" },
		category: 'edge-case',
		userLevel: 1,
		question: { en: "What's zeta?" },
		criteria: {
			mustInclude: ['level', 'advanced'],
			mustNotInclude: ['variation', 'startPosition'],
			expectedTools: [],
			keyFacts: [{ en: 'Should note this is Level 4 content' }]
		},
		testsKnowledgeNodes: ['level-constraints', 'beginner-detection'],
		difficulty: 'medium'
	},
	{
		id: 'beginner-edge-boundary-2',
		name: { en: "Boundary: What's Type 7?" },
		category: 'edge-case',
		userLevel: 1,
		question: { en: "What's Type 7?" },
		criteria: {
			mustInclude: ['6', 'types'],
			mustNotInclude: ['Type 7'],
			expectedTools: [],
			keyFacts: [{ en: "Should explain there's no Type 7" }]
		},
		testsKnowledgeNodes: ['type-overview', 'beginner-detection'],
		difficulty: 'medium'
	},
	{
		id: 'beginner-edge-boundary-3',
		name: { en: "Boundary: What's the letter 1?" },
		category: 'edge-case',
		userLevel: 1,
		question: { en: "What's the letter 1?" },
		criteria: {
			mustInclude: ['letter', 'A'],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [{ en: 'Should clarify numbers are not letters' }]
		},
		testsKnowledgeNodes: ['beginner-detection'],
		difficulty: 'medium'
	},
	{
		id: 'beginner-edge-nonsense-1',
		name: { en: 'Nonsense: asdfghjkl' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: 'asdfghjkl' },
		criteria: {
			mustInclude: [],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [{ en: 'Should ask for clarification' }]
		},
		testsKnowledgeNodes: ['beginner-detection'],
		difficulty: 'edge-case'
	},
	{
		id: 'beginner-edge-empty-1',
		name: { en: 'Empty: (empty string)' },
		category: 'edge-case',
		userLevel: 1,
		question: { en: '' },
		criteria: {
			mustInclude: [],
			mustNotInclude: [],
			expectedTools: [],
			keyFacts: [{ en: 'Should handle gracefully' }]
		},
		testsKnowledgeNodes: ['beginner-detection'],
		difficulty: 'edge-case'
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Export All Beginner Scenarios
// ═══════════════════════════════════════════════════════════════════════════

export const beginnerScenarios: TikaScenario[] = [
	...alphaPositionScenarios,
	...betaPositionScenarios,
	...gammaPositionScenarios,
	...positionComparisonScenarios,
	...shiftMotionScenarios,
	...dashMotionScenarios,
	...staticMotionScenarios,
	...motionComparisonScenarios,
	...rotationScenarios,
	...letterTypeScenarios,
	...misconceptionScenarios,
	...gridScenarios,
	...pictographScenarios,
	...letterSpecificScenarios,
	...dashSuffixScenarios,
	...metaScenarios,
	...edgeCaseScenarios
]

export const beginnerScenariosByCategory = {
	'position-alpha': alphaPositionScenarios,
	'position-beta': betaPositionScenarios,
	'position-gamma': gammaPositionScenarios,
	'position-comparison': positionComparisonScenarios,
	'motion-shift': shiftMotionScenarios,
	'motion-dash': dashMotionScenarios,
	'motion-static': staticMotionScenarios,
	'motion-comparison': motionComparisonScenarios,
	rotation: rotationScenarios,
	'letter-types': letterTypeScenarios,
	misconceptions: misconceptionScenarios,
	grid: gridScenarios,
	pictograph: pictographScenarios,
	'letter-specific': letterSpecificScenarios,
	'dash-suffix': dashSuffixScenarios,
	meta: metaScenarios,
	'edge-cases': edgeCaseScenarios
}

export const beginnerScenarioCount = beginnerScenarios.length
