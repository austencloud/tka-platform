/**
 * Question Router for Tika
 *
 * Classifies user questions to determine:
 * 1. What type of question it is (letter, term, comparison, etc.)
 * 2. What complexity level is needed to answer
 * 3. Whether to use a template or call the LLM API
 */

// All 47 TKA letters for pattern matching
const LETTERS = [
	// Type 1: Dual-Shift (A-V)
	'A',
	'B',
	'C',
	'D',
	'E',
	'F',
	'G',
	'H',
	'I',
	'J',
	'K',
	'L',
	'M',
	'N',
	'O',
	'P',
	'Q',
	'R',
	'S',
	'T',
	'U',
	'V',
	// Type 2: Shift
	'W',
	'X',
	'Y',
	'Z',
	'Σ',
	'Sigma',
	'Δ',
	'Delta',
	'Θ',
	'Theta',
	'Ω',
	'Omega',
	// Type 3: Cross-Shift (with dash suffix)
	'W-',
	'X-',
	'Y-',
	'Z-',
	'Σ-',
	'Sigma-',
	'Δ-',
	'Delta-',
	'Θ-',
	'Theta-',
	'Ω-',
	'Omega-',
	// Type 4: Dash
	'Φ',
	'Phi',
	'Ψ',
	'Psi',
	'Λ',
	'Lambda',
	// Type 5: Dual-Dash
	'Φ-',
	'Phi-',
	'Ψ-',
	'Psi-',
	'Λ-',
	'Lambda-',
	// Type 6: Static
	'α',
	'alpha',
	'β',
	'beta',
	'γ',
	'gamma'
]

// Greek letter mappings for normalization
const GREEK_MAPPINGS: Record<string, string> = {
	sigma: 'Σ',
	delta: 'Δ',
	theta: 'Θ',
	omega: 'Ω',
	phi: 'Φ',
	psi: 'Ψ',
	lambda: 'Λ',
	'sigma-': 'Σ-',
	'delta-': 'Δ-',
	'theta-': 'Θ-',
	'omega-': 'Ω-',
	'phi-': 'Φ-',
	'psi-': 'Ψ-',
	'lambda-': 'Λ-'
}

// Domain terms for pattern matching
const DOMAIN_TERMS = [
	'alpha',
	'beta',
	'gamma',
	'grid',
	'diamond',
	'box',
	'position',
	'motion',
	'static',
	'shift',
	'dash',
	'pro',
	'anti',
	'prospin',
	'antispin',
	'orientation',
	'in',
	'out',
	'turn',
	'pictograph',
	'sequence',
	'LOOP',
	'reversal',
	'skew',
	'variation',
	'type 1',
	'type 2',
	'type 3',
	'type 4',
	'type 5',
	'type 6',
	'dual-shift',
	'cross-shift',
	'dual-dash'
]

export type QuestionType =
	| 'letter'
	| 'term'
	| 'comparison'
	| 'how-to'
	| 'list'
	| 'type-list'
	| 'position'
	| 'motion'
	| 'complex'

export interface QuestionMatch {
	/** Type of question */
	type: QuestionType
	/** The subject of the question (letter name, term, etc.) */
	subject?: string
	/** Second subject for comparisons */
	subject2?: string
	/** Minimum complexity level needed to answer */
	complexity: number
	/** Whether this can be answered with a template */
	useTemplate: boolean
	/** Original question (normalized) */
	normalizedQuestion: string
}

interface PatternDefinition {
	regex: RegExp
	type: QuestionType
	complexity: number
	extractSubject?: (match: RegExpMatchArray) => string | undefined
	extractSubject2?: (match: RegExpMatchArray) => string | undefined
}

// Build letter pattern (case-insensitive, includes Greek names)
const letterPattern = LETTERS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')

const PATTERNS: PatternDefinition[] = [
	// ─────────────────────────────────────────────────────────────────
	// Simple letter questions (templates)
	// ─────────────────────────────────────────────────────────────────
	{
		regex: new RegExp(`^what is (${letterPattern})\\??$`, 'i'),
		type: 'letter',
		complexity: 0,
		extractSubject: (m) => normalizeLetter(m[1])
	},
	{
		regex: new RegExp(`^show me (${letterPattern})$`, 'i'),
		type: 'letter',
		complexity: 0,
		extractSubject: (m) => normalizeLetter(m[1])
	},
	{
		regex: new RegExp(`^explain (${letterPattern})$`, 'i'),
		type: 'letter',
		complexity: 1,
		extractSubject: (m) => normalizeLetter(m[1])
	},
	{
		regex: new RegExp(`^(${letterPattern})\\??$`, 'i'),
		type: 'letter',
		complexity: 0,
		extractSubject: (m) => normalizeLetter(m[1])
	},
	{
		regex: new RegExp(`^what does (${letterPattern}) look like\\??$`, 'i'),
		type: 'letter',
		complexity: 0,
		extractSubject: (m) => normalizeLetter(m[1])
	},
	{
		regex: new RegExp(`^how do (i|you) do (${letterPattern})\\??$`, 'i'),
		type: 'letter',
		complexity: 1,
		extractSubject: (m) => normalizeLetter(m[2])
	},

	// ─────────────────────────────────────────────────────────────────
	// Term definitions (templates)
	// ─────────────────────────────────────────────────────────────────
	{
		regex: /^what (is|does) (alpha|beta|gamma|pro|anti|shift|dash|static|orientation|position|grid|motion|LOOP|reversal|skew|turn|pictograph) mean\??$/i,
		type: 'term',
		complexity: 1,
		extractSubject: (m) => m[2].toLowerCase()
	},
	{
		regex: /^define (alpha|beta|gamma|pro|anti|shift|dash|static|orientation|position|grid|motion|LOOP|reversal|skew|turn|pictograph)$/i,
		type: 'term',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^what is (alpha|beta|gamma|pro|anti|shift|dash|static|orientation|position|grid|motion|LOOP|reversal|skew|turn|pictograph)\??$/i,
		type: 'term',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^explain (alpha|beta|gamma|pro|anti|shift|dash|static|orientation|position|grid|motion|LOOP|reversal|skew|turn|pictograph)$/i,
		type: 'term',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},

	// ─────────────────────────────────────────────────────────────────
	// Type questions (visual-first)
	// ─────────────────────────────────────────────────────────────────
	{
		regex: /^tell me about type ([1-6])(?: letters)?\??$/i,
		type: 'type-list',
		complexity: 1,
		extractSubject: (m) => m[1]
	},
	{
		regex: /^what (?:is|are) type ([1-6])(?: letters)?\??$/i,
		type: 'type-list',
		complexity: 1,
		extractSubject: (m) => m[1]
	},
	{
		regex: /^show me type ([1-6])(?: letters)?\??$/i,
		type: 'type-list',
		complexity: 1,
		extractSubject: (m) => m[1]
	},
	{
		regex: /^(?:tell me about|what (?:is|are)|show me) (dual-shift|cross-shift|dual-dash) letters\??$/i,
		type: 'type-list',
		complexity: 1,
		extractSubject: (m) => {
			// Convert type name to type number
			const typeMap: Record<string, string> = {
				'dual-shift': '1',
				shift: '2',
				'cross-shift': '3',
				dash: '4',
				'dual-dash': '5',
				static: '6'
			}
			return typeMap[m[1].toLowerCase()] || '1'
		}
	},

	// ─────────────────────────────────────────────────────────────────
	// Position questions (visual-first)
	// ─────────────────────────────────────────────────────────────────
	{
		regex: /^what is (alpha|beta|gamma|zeta|eta)(?: position)?\??$/i,
		type: 'position',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^(alpha|beta|gamma|zeta|eta) position\??$/i,
		type: 'position',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^define (alpha|beta|gamma|zeta|eta)\??$/i,
		type: 'position',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^tell me about (alpha|beta|gamma|zeta|eta)\??$/i,
		type: 'position',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^show me (alpha|beta|gamma|zeta|eta)\??$/i,
		type: 'position',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},

	// ─────────────────────────────────────────────────────────────────
	// Motion questions (visual-first)
	// ─────────────────────────────────────────────────────────────────
	{
		regex: /^what is (shift|dash|static)(?: motion)?\??$/i,
		type: 'motion',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^(shift|dash|static) motion\??$/i,
		type: 'motion',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^define (shift|dash|static)\??$/i,
		type: 'motion',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^tell me about (shift|dash|static)\??$/i,
		type: 'motion',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^what is (pro|anti|prospin|antispin)\??$/i,
		type: 'motion',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},

	// ─────────────────────────────────────────────────────────────────
	// Comparisons (may need API for complex ones)
	// ─────────────────────────────────────────────────────────────────
	{
		regex: new RegExp(
			`^(?:what(?:'s| is) the )?difference between (${letterPattern}) and (${letterPattern})\\??$`,
			'i'
		),
		type: 'comparison',
		complexity: 3,
		extractSubject: (m) => normalizeLetter(m[1]),
		extractSubject2: (m) => normalizeLetter(m[2])
	},
	{
		regex: new RegExp(`^compare (${letterPattern}) (?:to|with|and) (${letterPattern})\\??$`, 'i'),
		type: 'comparison',
		complexity: 3,
		extractSubject: (m) => normalizeLetter(m[1]),
		extractSubject2: (m) => normalizeLetter(m[2])
	},
	{
		regex: /^(?:what(?:'s| is) the )?difference between (pro|anti|shift|dash|static) and (pro|anti|shift|dash|static)\??$/i,
		type: 'comparison',
		complexity: 2,
		extractSubject: (m) => m[1].toLowerCase(),
		extractSubject2: (m) => m[2].toLowerCase()
	},

	// ─────────────────────────────────────────────────────────────────
	// List questions (templates)
	// ─────────────────────────────────────────────────────────────────
	{
		regex: /^(?:list |what are )?(?:all )?(?:the )?(type [1-6]) letters\??$/i,
		type: 'list',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^what letters are (type [1-6])\??$/i,
		type: 'list',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},
	{
		regex: /^(?:list |what are )?(?:all )?(?:the )?(dual-shift|shift|cross-shift|dash|dual-dash|static) letters\??$/i,
		type: 'list',
		complexity: 1,
		extractSubject: (m) => m[1].toLowerCase()
	},

	// ─────────────────────────────────────────────────────────────────
	// How-to questions (may need API)
	// ─────────────────────────────────────────────────────────────────
	{
		regex: /^how (do|can) (i|you) read (?:a )?pictograph(?:s)?\??$/i,
		type: 'how-to',
		complexity: 2,
		extractSubject: () => 'read pictograph'
	},
	{
		regex: /^how (do|can) (i|you) tell (pro|anti|shift|dash|static) (?:from|vs|versus) (pro|anti|shift|dash|static)\??$/i,
		type: 'how-to',
		complexity: 2,
		extractSubject: (m) => `${m[3]} vs ${m[4]}`
	}
]

/**
 * Normalize a letter to its canonical form
 */
function normalizeLetter(input: string): string {
	const lower = input.toLowerCase().trim()

	// Check Greek mappings
	if (GREEK_MAPPINGS[lower]) {
		return GREEK_MAPPINGS[lower]
	}

	// Handle "X dash" → "X-"
	const dashMatch = lower.match(/^(\w+)\s*dash$/)
	if (dashMatch) {
		const base = dashMatch[1]
		if (GREEK_MAPPINGS[base + '-']) {
			return GREEK_MAPPINGS[base + '-']
		}
		return base.toUpperCase() + '-'
	}

	// Single letter uppercase
	if (input.length === 1) {
		return input.toUpperCase()
	}

	// Already has dash suffix
	if (input.endsWith('-')) {
		const base = input.slice(0, -1).toLowerCase()
		if (GREEK_MAPPINGS[base + '-']) {
			return GREEK_MAPPINGS[base + '-']
		}
		return input.charAt(0).toUpperCase() + input.slice(1, -1).toLowerCase() + '-'
	}

	return input
}

/**
 * Classify a user question
 */
export function classifyQuestion(question: string): QuestionMatch {
	// Normalize the question
	const normalized = question.trim().replace(/\s+/g, ' ')

	// Try each pattern
	for (const pattern of PATTERNS) {
		const match = normalized.match(pattern.regex)
		if (match) {
			return {
				type: pattern.type,
				subject: pattern.extractSubject?.(match),
				subject2: pattern.extractSubject2?.(match),
				complexity: pattern.complexity,
				useTemplate: pattern.complexity <= 2,
				normalizedQuestion: normalized
			}
		}
	}

	// Check if it mentions any letters or terms (partial match)
	const mentionsLetter = LETTERS.some(
		(l) =>
			normalized.toLowerCase().includes(l.toLowerCase()) ||
			(GREEK_MAPPINGS[l.toLowerCase()] &&
				normalized.toLowerCase().includes(GREEK_MAPPINGS[l.toLowerCase()].toLowerCase()))
	)

	const mentionsTerm = DOMAIN_TERMS.some((t) => normalized.toLowerCase().includes(t.toLowerCase()))

	// Default to complex question (use API)
	return {
		type: 'complex',
		subject: mentionsLetter || mentionsTerm ? extractMainSubject(normalized) : undefined,
		complexity: 5,
		useTemplate: false,
		normalizedQuestion: normalized
	}
}

/**
 * Try to extract the main subject from an unmatched question
 */
function extractMainSubject(question: string): string | undefined {
	const lower = question.toLowerCase()

	// Look for letters
	for (const letter of LETTERS) {
		if (lower.includes(letter.toLowerCase())) {
			return normalizeLetter(letter)
		}
	}

	// Look for terms
	for (const term of DOMAIN_TERMS) {
		if (lower.includes(term.toLowerCase())) {
			return term.toLowerCase()
		}
	}

	return undefined
}

/**
 * Determine if a question should use the template engine or LLM API
 *
 * @param match - The classified question
 * @param userLevel - User's current knowledge level (e.g., 1.3, 2.1)
 * @returns Whether to use template (true) or API (false)
 */
export function shouldUseTemplate(match: QuestionMatch, userLevel: number): boolean {
	// Templates available for complexity 0-2
	if (match.complexity > 2) {
		return false
	}

	// If user is asking about something at their level or below, use template
	// If they're asking about something more advanced, use API to explain prerequisites
	return match.useTemplate
}

/**
 * Get the appropriate explanation level based on question complexity and user level
 *
 * @param questionComplexity - The minimum complexity to answer the question
 * @param userLevel - User's current knowledge level
 * @returns The explanation level to use (capped by user level)
 */
export function getExplanationLevel(questionComplexity: number, userLevel: number): number {
	// User can't understand explanations above their level
	const maxLevel = Math.floor(userLevel)

	// Use the minimum of what's needed and what they can understand
	return Math.min(questionComplexity, maxLevel)
}
