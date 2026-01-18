/**
 * TIKA Ask API Endpoint (AI SDK Streaming)
 *
 * Server-side endpoint for the TIKA AI assistant using Vercel AI SDK.
 * Streams responses word-by-word for modern chat UX.
 */

import type { RequestHandler } from '@sveltejs/kit'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, tool, convertToModelMessages, type UIMessage, jsonSchema } from 'ai'
import { ANTHROPIC_API_KEY } from '$env/static/private'
import fs from 'fs'
import path from 'path'
import { buildSystemPrompt } from '$lib/features/learn/ai/system-prompts'
import { deriveUserOverlay } from '$lib/features/learn/ai/knowledge-graph'
import {
	getTypeComparison,
	getTypeExplanation,
	TYPE_DEFINITIONS,
	getPositionExplanation,
	getPositionComparison,
	getMotionTypeExplanation,
	getMotionTypeComparison,
	getRotationExplanation,
	getGridModeExplanation,
	getVTGMapping,
	getAlphabetOverview,
	getCommonAnswer,
	getTypeNamingOrigin,
	POSITION_DEFINITIONS,
	MOTION_TYPE_DEFINITIONS
} from '$lib/features/learn/ai/canonical-responses'

// ═══════════════════════════════════════════════════════════════════════════
// Types & Data Loading
// ═══════════════════════════════════════════════════════════════════════════

interface MotionData {
	color: string
	startLocation: string
	endLocation: string
	motionType: string
	rotationDirection: string
}

interface PictographData {
	letter: string
	startPosition: string
	endPosition: string
	timing: string
	direction: string
	blueMotion: MotionData
	redMotion: MotionData
}

interface GlossaryEntry {
	definition: string
	examples: string[]
	relatedTerms: string[]
	category: string
}

interface LetterTypeInfo {
	name: string
	description: string
	characteristics: string[]
	letters: string[]
	motionPattern: {
		blueMotion: string
		redMotion: string
		note?: string
	}
}

let allPictographs: PictographData[] = []
let glossary: Record<string, GlossaryEntry> = {}
let letterTypes: Record<string, LetterTypeInfo> = {}

const TKA_LETTER_TYPES: Record<string, { letters: string[]; name: string }> = {
	'1': { name: 'Dual-Shift', letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V'] },
	'2': { name: 'Shift', letters: ['W', 'X', 'Y', 'Z', 'Σ', 'Δ', 'Θ', 'Ω'] },
	'3': { name: 'Cross-Shift', letters: ['W-', 'X-', 'Y-', 'Z-', 'Σ-', 'Δ-', 'Θ-', 'Ω-'] },
	'4': { name: 'Dash', letters: ['Φ', 'Ψ', 'Λ'] },
	'5': { name: 'Dual-Dash', letters: ['Φ-', 'Ψ-', 'Λ-'] },
	'6': { name: 'Static', letters: ['α', 'β', 'γ'] }
}

const LETTER_TO_TYPE: Record<string, { type: string; name: string }> = {}
for (const [typeKey, typeInfo] of Object.entries(TKA_LETTER_TYPES)) {
	for (const letter of typeInfo.letters) {
		LETTER_TO_TYPE[letter] = { type: typeKey, name: typeInfo.name }
	}
}

function loadDataframe(): PictographData[] {
	try {
		const csvPath = path.join(process.cwd(), 'static', 'data', 'pictographs', 'DiamondPictographDataframe.csv')
		const csvContent = fs.readFileSync(csvPath, 'utf-8')
		const lines = csvContent.trim().split('\n')
		if (lines.length < 2) return []

		const headerLine = lines[0]
		if (!headerLine) return []
		const headers = headerLine.split(',').map((h) => h.trim())
		const pictographs: PictographData[] = []

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i]
			if (!line) continue
			const values = line.split(',').map((v) => v.trim())
			const row: Record<string, string> = {}
			headers.forEach((header, index) => {
				row[header] = values[index] ?? ''
			})

			pictographs.push({
				letter: row['letter'] ?? '',
				startPosition: row['startPosition'] ?? '',
				endPosition: row['endPosition'] ?? '',
				timing: row['timing'] ?? '',
				direction: row['direction'] ?? '',
				blueMotion: {
					color: 'blue',
					startLocation: row['blueStartLocation'] ?? '',
					endLocation: row['blueEndLocation'] ?? '',
					motionType: row['blueMotionType'] ?? '',
					rotationDirection: row['blueRotationDirection'] ?? ''
				},
				redMotion: {
					color: 'red',
					startLocation: row['redStartLocation'] ?? '',
					endLocation: row['redEndLocation'] ?? '',
					motionType: row['redMotionType'] ?? '',
					rotationDirection: row['redRotationDirection'] ?? ''
				}
			})
		}

		return pictographs
	} catch (error) {
		console.error('[TIKA API] Failed to load dataframe:', error)
		return []
	}
}

function loadKnowledgeBase() {
	try {
		const glossaryPath = path.join(process.cwd(), 'mcp-server', 'data', 'tka-glossary.json')
		const typesPath = path.join(process.cwd(), 'mcp-server', 'data', 'letter-types.json')

		if (fs.existsSync(glossaryPath)) {
			glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'))
		}
		if (fs.existsSync(typesPath)) {
			letterTypes = JSON.parse(fs.readFileSync(typesPath, 'utf-8'))
		}
	} catch (error) {
		console.error('[TIKA API] Failed to load knowledge base:', error)
	}
}

function ensureDataLoaded() {
	if (allPictographs.length === 0) {
		console.log('[TIKA API] Loading pictograph dataframe...')
		allPictographs = loadDataframe()
		console.log(`[TIKA API] Loaded ${allPictographs.length} pictographs`)
	}
	if (Object.keys(glossary).length === 0) {
		loadKnowledgeBase()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Tool Execute Functions
// ═══════════════════════════════════════════════════════════════════════════

interface LetterExplanationResult {
	explanation: string
	contextData: {
		type: 'letter'
		letter: string
		letterType: number
		typeName: string
		startPosition: string
		endPosition: string
		blueMotion: {
			motionType: string
			startLoc: string
			endLoc: string
			propRotDir: string
		}
		redMotion: {
			motionType: string
			startLoc: string
			endLoc: string
			propRotDir: string
		}
	}
}

function executeGetLetterExplanation(letter: string, variation: number = 0): LetterExplanationResult | string {
	ensureDataLoaded()

	const variations = allPictographs.filter((p) => p.letter === letter)
	if (variations.length === 0) {
		return `Letter "${letter}" not found in the TKA alphabet.`
	}

	const typeInfo = LETTER_TO_TYPE[letter]
	const typeNum = typeInfo?.type || 'unknown'
	const fullTypeInfo = letterTypes[typeNum]
	const varData = variations[Math.min(variation, variations.length - 1)]

	if (!varData) {
		return `Letter "${letter}" variation data not available.`
	}

	const explanation = `# Letter: ${letter}

## Type Information
**Type ${typeNum}: ${fullTypeInfo?.name || typeInfo?.name || 'Unknown'}**

${fullTypeInfo?.description || ''}

${fullTypeInfo?.characteristics ? '**Characteristics:**\n' + fullTypeInfo.characteristics.map(c => `- ${c}`).join('\n') : ''}

## Motion Pattern
- **Blue hand:** ${varData.blueMotion.motionType}${varData.blueMotion.rotationDirection !== 'noRotation' ? ` (${varData.blueMotion.rotationDirection})` : ''}
- **Red hand:** ${varData.redMotion.motionType}${varData.redMotion.rotationDirection !== 'noRotation' ? ` (${varData.redMotion.rotationDirection})` : ''}

## Variation ${variation} Details
- **Start position:** ${varData.startPosition}
- **End position:** ${varData.endPosition}
- **Blue motion:** ${varData.blueMotion.startLocation} → ${varData.blueMotion.endLocation}
- **Red motion:** ${varData.redMotion.startLocation} → ${varData.redMotion.endLocation}

## All Variations (${variations.length} total)
${variations.slice(0, 5).map((v, i) => `[${i}] ${v.startPosition} → ${v.endPosition}`).join('\n')}${variations.length > 5 ? `\n... and ${variations.length - 5} more` : ''}`

	return {
		explanation,
		contextData: {
			type: 'letter',
			letter,
			letterType: parseInt(typeNum) || 1,
			typeName: fullTypeInfo?.name || typeInfo?.name || 'Unknown',
			startPosition: varData.startPosition,
			endPosition: varData.endPosition,
			blueMotion: {
				motionType: varData.blueMotion.motionType,
				startLoc: varData.blueMotion.startLocation,
				endLoc: varData.blueMotion.endLocation,
				propRotDir: varData.blueMotion.rotationDirection
			},
			redMotion: {
				motionType: varData.redMotion.motionType,
				startLoc: varData.redMotion.startLocation,
				endLoc: varData.redMotion.endLocation,
				propRotDir: varData.redMotion.rotationDirection
			}
		}
	}
}

interface TermDefinitionResult {
	explanation: string
	contextData?: {
		type: 'termWithVisuals'
		term: string
		definition: string
		examples: PictographExample[]
	}
}

function executeGetTermDefinition(term: string): TermDefinitionResult | string {
	ensureDataLoaded()

	const normalizedTerm = term.toLowerCase().trim()
	const entry = glossary[normalizedTerm]

	if (!entry) {
		const possibleMatches = Object.keys(glossary)
			.filter(key => key.includes(normalizedTerm) || normalizedTerm.includes(key))
			.slice(0, 5)

		return `Term "${term}" not found.${possibleMatches.length > 0 ? ` Did you mean: ${possibleMatches.join(', ')}?` : ''}`
	}

	const explanation = `# ${term.charAt(0).toUpperCase() + term.slice(1)}

**Definition:** ${entry.definition}

**Examples:**
${entry.examples.map(e => `- ${e}`).join('\n')}

**Related terms:** ${entry.relatedTerms.join(', ')}

**Category:** ${entry.category}`

	// Check if this term has visual examples available
	let visualExamples: PictographExample[] = []

	if (isPositionTerm(normalizedTerm)) {
		visualExamples = getPositionExamples(normalizedTerm, 3)
	} else if (isMotionTerm(normalizedTerm)) {
		visualExamples = getMotionExamples(normalizedTerm)
	}

	// If we have visual examples, return enriched result
	if (visualExamples.length > 0) {
		return {
			explanation,
			contextData: {
				type: 'termWithVisuals',
				term: normalizedTerm,
				definition: entry.definition,
				examples: visualExamples
			}
		}
	}

	// Otherwise return just the text explanation
	return explanation
}

interface ComparisonResult {
	explanation: string
	contextData: {
		type: 'comparison'
		letter1: string
		letter2: string
		letter1Data: {
			letter: string
			type: number
			typeName: string
			blueMotion: string
			redMotion: string
		}
		letter2Data: {
			letter: string
			type: number
			typeName: string
			blueMotion: string
			redMotion: string
		}
	}
}

function executeCompareLetters(letter1: string, letter2: string): ComparisonResult | string {
	ensureDataLoaded()

	const var1 = allPictographs.filter((p) => p.letter === letter1)
	const var2 = allPictographs.filter((p) => p.letter === letter2)

	if (var1.length === 0) return `Letter "${letter1}" not found.`
	if (var2.length === 0) return `Letter "${letter2}" not found.`

	const type1 = LETTER_TO_TYPE[letter1]
	const type2 = LETTER_TO_TYPE[letter2]
	const typeNum1 = parseInt(type1?.type || '0')
	const typeNum2 = parseInt(type2?.type || '0')
	const rep1 = var1[0]
	const rep2 = var2[0]

	if (!rep1 || !rep2) {
		return `Cannot compare - missing variation data for one or both letters.`
	}

	// Use canonical type definitions for accurate descriptions
	const typeDef1 = TYPE_DEFINITIONS[typeNum1]
	const typeDef2 = TYPE_DEFINITIONS[typeNum2]

	let explanation = `# Comparison: ${letter1} vs ${letter2}

## At a Glance
| Property | ${letter1} | ${letter2} |
|----------|------------|------------|
| Type | ${typeNum1} (${typeDef1?.name || '?'}) | ${typeNum2} (${typeDef2?.name || '?'}) |
| Blue motion | ${rep1.blueMotion.motionType} | ${rep2.blueMotion.motionType} |
| Red motion | ${rep1.redMotion.motionType} | ${rep2.redMotion.motionType} |
| Variations | ${var1.length} | ${var2.length} |

## Letter Details
- **${letter1}:** ${typeDef1?.description || 'Type ' + typeNum1}
- **${letter2}:** ${typeDef2?.description || 'Type ' + typeNum2}`

	// If different types, include canonical type comparison (bulletproof accuracy)
	if (typeNum1 !== typeNum2 && typeNum1 > 0 && typeNum2 > 0) {
		explanation += `\n\n${getTypeComparison(typeNum1, typeNum2)}`
	}

	return {
		explanation,
		contextData: {
			type: 'comparison',
			letter1,
			letter2,
			letter1Data: {
				letter: letter1,
				type: typeNum1,
				typeName: typeDef1?.name || 'Unknown',
				blueMotion: rep1.blueMotion.motionType,
				redMotion: rep1.redMotion.motionType
			},
			letter2Data: {
				letter: letter2,
				type: typeNum2,
				typeName: typeDef2?.name || 'Unknown',
				blueMotion: rep2.blueMotion.motionType,
				redMotion: rep2.redMotion.motionType
			}
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Helper Functions for Visual Examples
// ═══════════════════════════════════════════════════════════════════════════

interface PictographExample {
	letter: string
	variation: number
	startPosition: string
	endPosition: string
	blueMotion?: string
	redMotion?: string
}

/**
 * Get pictograph examples demonstrating a specific position.
 * Searches for pictographs where either start or end position matches.
 */
function getPositionExamples(position: string, count: number = 3): PictographExample[] {
	ensureDataLoaded()

	const normalizedPosition = position.toLowerCase().trim()

	// Find pictographs that start or end with this position
	const matches = allPictographs.filter(p =>
		p.startPosition.toLowerCase().includes(normalizedPosition) ||
		p.endPosition.toLowerCase().includes(normalizedPosition)
	)

	// Get diverse examples (different letters)
	const examples: PictographExample[] = []
	const seenLetters = new Set<string>()

	for (const match of matches) {
		if (examples.length >= count) break
		if (seenLetters.has(match.letter)) continue

		examples.push({
			letter: match.letter,
			variation: 0,
			startPosition: match.startPosition,
			endPosition: match.endPosition
		})
		seenLetters.add(match.letter)
	}

	return examples
}

/**
 * Get pictograph examples demonstrating a specific motion type.
 * Can filter by hand color (blue, red, or both).
 */
function getMotionExamples(motionType: string, hand: 'blue' | 'red' | 'both' = 'both'): PictographExample[] {
	ensureDataLoaded()

	const normalizedMotion = motionType.toLowerCase().trim()

	let matches: PictographData[] = []

	if (hand === 'blue' || hand === 'both') {
		matches = allPictographs.filter(p =>
			p.blueMotion.motionType.toLowerCase() === normalizedMotion
		)
	}

	if (hand === 'red' || hand === 'both') {
		const redMatches = allPictographs.filter(p =>
			p.redMotion.motionType.toLowerCase() === normalizedMotion
		)
		matches = hand === 'both' ? [...matches, ...redMatches] : redMatches
	}

	// Get diverse examples (max 4)
	const examples: PictographExample[] = []
	const seenLetters = new Set<string>()

	for (const match of matches) {
		if (examples.length >= 4) break
		if (seenLetters.has(match.letter)) continue

		examples.push({
			letter: match.letter,
			variation: 0,
			startPosition: match.startPosition,
			endPosition: match.endPosition,
			blueMotion: match.blueMotion.motionType,
			redMotion: match.redMotion.motionType
		})
		seenLetters.add(match.letter)
	}

	return examples
}

/**
 * Check if a term is a position name.
 */
function isPositionTerm(term: string): boolean {
	const normalized = term.toLowerCase().trim()
	return Object.keys(POSITION_DEFINITIONS).includes(normalized)
}

/**
 * Check if a term is a motion type.
 */
function isMotionTerm(term: string): boolean {
	const normalized = term.toLowerCase().trim()
	return Object.keys(MOTION_TYPE_DEFINITIONS).includes(normalized)
}

interface TypeListResult {
	explanation: string
	contextData: {
		type: 'typeList'
		typeNumber: number
		typeName: string
		description: string
		exampleLetters: string[]
		allLetters: string[]
		motionPattern: {
			blueMotion: string
			redMotion: string
		}
	}
}

function executeListLettersByType(type: number): TypeListResult | string {
	ensureDataLoaded()

	// Use canonical response for the explanation - no LLM generation
	const canonicalDef = TYPE_DEFINITIONS[type]
	if (!canonicalDef) {
		return `Invalid type ${type}. Valid types are 1-6.`
	}

	const typeKey = type.toString()
	const typeInfo = letterTypes[typeKey]

	// Build explanation from canonical source (human-verified, not LLM-generated)
	const explanation = getTypeExplanation(type)

	// Get letter variations from dataframe for context
	const letters = canonicalDef.letters.split(', ').flatMap(l => l.includes('through') ? TKA_LETTER_TYPES[typeKey]?.letters || [] : [l.trim()])
	const exampleLetters = typeInfo?.letters || letters

	return {
		explanation,
		contextData: {
			type: 'typeList',
			typeNumber: type,
			typeName: canonicalDef.name,
			description: canonicalDef.description,
			exampleLetters,
			allLetters: exampleLetters,
			motionPattern: {
				blueMotion: canonicalDef.motionPattern.blue,
				redMotion: canonicalDef.motionPattern.red
			}
		}
	}
}


// ═══════════════════════════════════════════════════════════════════════════
// AI SDK Tools Definition
// ═══════════════════════════════════════════════════════════════════════════

// Define tools using JSON Schema to avoid Zod 3/4 compatibility issues
const tikaTools = {
	get_letter_explanation: tool({
		description: 'MANDATORY for ANY question about a specific letter (A-Z, Greek letters). Returns pictograph data and detailed explanation. ALWAYS use this for "What is X?", "Tell me about X", "Explain X" where X is a letter.',
		inputSchema: jsonSchema<{ letter: string; variation?: number }>({
			type: 'object',
			properties: {
				letter: { type: 'string', description: 'The letter to explain (A-Z or Greek)' },
				variation: { type: 'number', description: 'Variation index (0-based)', default: 0 }
			},
			required: ['letter']
		}),
		execute: async ({ letter, variation = 0 }) => executeGetLetterExplanation(letter, variation)
	}),

	get_term_definition: tool({
		description: 'Get the definition of a TKA domain term like alpha, pro, shift, static, beta, gamma, etc. Use this when asked what a term means.',
		inputSchema: jsonSchema<{ term: string }>({
			type: 'object',
			properties: {
				term: { type: 'string', description: 'The term to define' }
			},
			required: ['term']
		}),
		execute: async ({ term }) => executeGetTermDefinition(term)
	}),

	compare_letters: tool({
		description: 'Compare two TKA letters side by side, explaining their differences. Use this when asked to compare or contrast letters.',
		inputSchema: jsonSchema<{ letter1: string; letter2: string }>({
			type: 'object',
			properties: {
				letter1: { type: 'string', description: 'First letter to compare' },
				letter2: { type: 'string', description: 'Second letter to compare' }
			},
			required: ['letter1', 'letter2']
		}),
		execute: async ({ letter1, letter2 }) => executeCompareLetters(letter1, letter2)
	}),

	list_letters_by_type: tool({
		description: 'MANDATORY for questions about letter types ("Type X letters", "Tell me about Type X", "What are Type X letters"). Returns visual gallery of example letters. ALWAYS use this instead of describing types in text.',
		inputSchema: jsonSchema<{ type: number }>({
			type: 'object',
			properties: {
				type: { type: 'number', minimum: 1, maximum: 6, description: 'Letter type 1-6: 1=Dual-Shift, 2=Shift, 3=Cross-Shift, 4=Dash, 5=Dual-Dash, 6=Static' }
			},
			required: ['type']
		}),
		execute: async ({ type }) => executeListLettersByType(type)
	}),

	compare_positions: tool({
		description: 'Compare two TKA positions (alpha, beta, gamma, etc). Use when asked about differences between positions.',
		inputSchema: jsonSchema<{ position1: string; position2: string }>({
			type: 'object',
			properties: {
				position1: { type: 'string', description: 'First position name' },
				position2: { type: 'string', description: 'Second position name' }
			},
			required: ['position1', 'position2']
		}),
		execute: async ({ position1, position2 }) => getPositionComparison(position1, position2)
	}),

	compare_types: tool({
		description: 'MANDATORY for comparing letter types ("Type X vs Type Y", "How do Type X and Type Y differ", "Difference between Type X and Type Y"). ALWAYS use this instead of explaining differences in text.',
		inputSchema: jsonSchema<{ type1: number; type2: number }>({
			type: 'object',
			properties: {
				type1: { type: 'number', minimum: 1, maximum: 6, description: 'First type number (1-6)' },
				type2: { type: 'number', minimum: 1, maximum: 6, description: 'Second type number (1-6)' }
			},
			required: ['type1', 'type2']
		}),
		execute: async ({ type1, type2 }) => getTypeComparison(type1, type2)
	}),

	compare_motion_types: tool({
		description: 'Compare two motion types (static, shift, dash). Use when asked about differences between motion types.',
		inputSchema: jsonSchema<{ motion1: string; motion2: string }>({
			type: 'object',
			properties: {
				motion1: { type: 'string', description: 'First motion type' },
				motion2: { type: 'string', description: 'Second motion type' }
			},
			required: ['motion1', 'motion2']
		}),
		execute: async ({ motion1, motion2 }) => getMotionTypeComparison(motion1, motion2)
	}),

	get_rotation_info: tool({
		description: 'Get canonical definition of a rotation direction (pro, anti, prospin, antispin, cw, ccw). ALWAYS use this for rotation questions.',
		inputSchema: jsonSchema<{ rotation: string }>({
			type: 'object',
			properties: {
				rotation: { type: 'string', description: 'Rotation type (pro, anti, prospin, antispin, cw, ccw)' }
			},
			required: ['rotation']
		}),
		execute: async ({ rotation }) => getRotationExplanation(rotation)
	}),

	get_grid_mode: tool({
		description: 'Get canonical definition of a grid mode (diamond, box, skewed). ALWAYS use this for grid mode questions.',
		inputSchema: jsonSchema<{ mode: string }>({
			type: 'object',
			properties: {
				mode: { type: 'string', description: 'Grid mode (diamond, box, skewed)' }
			},
			required: ['mode']
		}),
		execute: async ({ mode }) => getGridModeExplanation(mode)
	}),

	get_vtg_mapping: tool({
		description: 'Get the TKA letters that correspond to a VTG (Vulcan Tech Gospel) term. Use for VTG-to-TKA translation.',
		inputSchema: jsonSchema<{ vtg_term: string }>({
			type: 'object',
			properties: {
				vtg_term: { type: 'string', description: 'VTG term (split-same, tog-same, split-opp, tog-opp, quarter-same, quarter-opp)' }
			},
			required: ['vtg_term']
		}),
		execute: async ({ vtg_term }) => getVTGMapping(vtg_term)
	}),

	get_alphabet_overview: tool({
		description: 'Get a complete overview of the TKA alphabet - all 6 types, letter counts, and organization. ALWAYS use this when asked "what is TKA" or for alphabet overviews.',
		inputSchema: jsonSchema<Record<string, never>>({
			type: 'object',
			properties: {}
		}),
		execute: async () => getAlphabetOverview()
	}),

	answer_common_question: tool({
		description: 'Get canonical answer to common TKA questions. Use for: "what is TKA", "what is a pictograph", "what is a sequence", "what is a loop", "why cross-shift".',
		inputSchema: jsonSchema<{ question: string }>({
			type: 'object',
			properties: {
				question: { type: 'string', description: 'The question topic (tka, pictograph, sequence, loop, why cross-shift)' }
			},
			required: ['question']
		}),
		execute: async ({ question }) => {
			const answer = getCommonAnswer(question)
			return answer || `No canonical answer found for "${question}". Use other tools to construct a response.`
		}
	}),

	get_type_naming_origin: tool({
		description: 'Explain why a letter type has its name (e.g., why "Cross-Shift" not "Dash-Shift"). ALWAYS use this for "why is it called X" questions about type names.',
		inputSchema: jsonSchema<{ type: number }>({
			type: 'object',
			properties: {
				type: { type: 'number', minimum: 1, maximum: 6, description: 'The type number (1-6)' }
			},
			required: ['type']
		}),
		execute: async ({ type }) => getTypeNamingOrigin(type)
	}),

	show_position_examples: tool({
		description: 'MANDATORY for position questions ("What is alpha?", "Tell me about gamma", "Show me beta"). Returns visual pictograph examples. NEVER explain positions in text alone - always show examples.',
		inputSchema: jsonSchema<{ position: string; count?: number }>({
			type: 'object',
			properties: {
				position: { type: 'string', description: 'Position name (alpha, beta, gamma, zeta, eta)' },
				count: { type: 'number', default: 3, description: 'Number of examples to show (default 3)' }
			},
			required: ['position']
		}),
		execute: async ({ position, count = 3 }) => {
			const positionDef = POSITION_DEFINITIONS[position.toLowerCase()]
			if (!positionDef) {
				return `Position "${position}" not recognized. Valid positions: alpha, beta, gamma, zeta, eta`
			}

			const examples = getPositionExamples(position, count)

			return {
				position,
				definition: positionDef.description,
				gridDescription: positionDef.gridDescription,
				examples,
				contextData: {
					type: 'positionExamples',
					position,
					definition: positionDef.description,
					examples
				}
			}
		}
	}),

	show_motion_examples: tool({
		description: 'MANDATORY for motion type questions ("What is shift?", "Tell me about dash", "Show me static motion"). Returns visual pictograph examples. NEVER explain motion types in text alone - always show examples.',
		inputSchema: jsonSchema<{ motionType: string; hand?: 'blue' | 'red' | 'both' }>({
			type: 'object',
			properties: {
				motionType: { type: 'string', description: 'Motion type (shift, dash, static)' },
				hand: { type: 'string', enum: ['blue', 'red', 'both'], default: 'both', description: 'Which hand to filter by' }
			},
			required: ['motionType']
		}),
		execute: async ({ motionType, hand = 'both' }) => {
			const motionDef = MOTION_TYPE_DEFINITIONS[motionType.toLowerCase()]
			if (!motionDef) {
				return `Motion type "${motionType}" not recognized. Valid types: shift, dash, static`
			}

			const examples = getMotionExamples(motionType, hand)

			return {
				motionType,
				definition: motionDef.description,
				gridMovement: motionDef.gridMovement,
				examples,
				contextData: {
					type: 'motionExamples',
					motionType,
					definition: motionDef.description,
					examples
				}
			}
		}
	})
}

// ═══════════════════════════════════════════════════════════════════════════
// Request Handler
// ═══════════════════════════════════════════════════════════════════════════

interface TIKARequest {
	messages?: UIMessage[]
	// Legacy support for non-streaming clients
	question?: string
	userId?: string
	completedConcepts?: string[]
	language?: string
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: TIKARequest = await request.json()

		if (!ANTHROPIC_API_KEY) {
			return new Response(JSON.stringify({ error: 'API key not configured' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Build system prompt based on user progress
		const completedConcepts = body.completedConcepts || []
		const language = body.language || 'en'
		const userOverlay = deriveUserOverlay(completedConcepts)
		const systemPrompt = buildSystemPrompt(userOverlay, language)

		// Create Anthropic client
		const anthropic = createAnthropic({
			apiKey: ANTHROPIC_API_KEY
		})

		// Handle both new streaming format (messages array) and legacy format (question string)
		let messages: UIMessage[]

		if (body.messages && Array.isArray(body.messages)) {
			// New format: AI SDK messages array
			messages = body.messages
		} else if (body.question) {
			// Legacy format: single question string - convert to messages format
			messages = [{
				id: crypto.randomUUID(),
				role: 'user',
				content: body.question,
				parts: [{ type: 'text', text: body.question }],
				createdAt: new Date()
			}]
		} else {
			return new Response(JSON.stringify({ error: 'Missing messages or question' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			})
		}

		// Stream the response
		const result = streamText({
			model: anthropic('claude-sonnet-4-20250514'),
			system: systemPrompt,
			messages: await convertToModelMessages(messages),
			tools: tikaTools,
			maxSteps: 5, // Allow up to 5 tool calls
			experimental_telemetry: {
				isEnabled: false
			}
		})

		// Return streaming response
		return result.toUIMessageStreamResponse()

	} catch (error) {
		console.error('[TIKA API] Error:', error)
		return new Response(JSON.stringify({
			error: error instanceof Error ? error.message : 'Unknown error'
		}), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		})
	}
}
