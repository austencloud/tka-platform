/**
 * TIKA Ask API Endpoint (AI SDK Streaming)
 *
 * Server-side endpoint for the TIKA AI assistant using Vercel AI SDK.
 * Streams responses word-by-word for modern chat UX.
 */

import type { RequestHandler } from '@sveltejs/kit'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, tool, convertToCoreMessages, type UIMessage, jsonSchema } from 'ai'
import { ANTHROPIC_API_KEY } from '$env/static/private'
import fs from 'fs'
import path from 'path'
import { buildSystemPrompt } from '$lib/features/learn/ai/system-prompts'
import { deriveUserOverlay } from '$lib/features/learn/ai/knowledge-graph'

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

function executeGetTermDefinition(term: string): string {
	ensureDataLoaded()

	const normalizedTerm = term.toLowerCase().trim()
	const entry = glossary[normalizedTerm]

	if (!entry) {
		const possibleMatches = Object.keys(glossary)
			.filter(key => key.includes(normalizedTerm) || normalizedTerm.includes(key))
			.slice(0, 5)

		return `Term "${term}" not found.${possibleMatches.length > 0 ? ` Did you mean: ${possibleMatches.join(', ')}?` : ''}`
	}

	return `# ${term.charAt(0).toUpperCase() + term.slice(1)}

**Definition:** ${entry.definition}

**Examples:**
${entry.examples.map(e => `- ${e}`).join('\n')}

**Related terms:** ${entry.relatedTerms.join(', ')}

**Category:** ${entry.category}`
}

function executeCompareLetters(letter1: string, letter2: string): string {
	ensureDataLoaded()

	const var1 = allPictographs.filter((p) => p.letter === letter1)
	const var2 = allPictographs.filter((p) => p.letter === letter2)

	if (var1.length === 0) return `Letter "${letter1}" not found.`
	if (var2.length === 0) return `Letter "${letter2}" not found.`

	const type1 = LETTER_TO_TYPE[letter1]
	const type2 = LETTER_TO_TYPE[letter2]
	const typeNum1 = type1?.type || '?'
	const typeNum2 = type2?.type || '?'
	const rep1 = var1[0]
	const rep2 = var2[0]

	if (!rep1 || !rep2) {
		return `Cannot compare - missing variation data for one or both letters.`
	}

	return `# Comparison: ${letter1} vs ${letter2}

## At a Glance
| Property | ${letter1} | ${letter2} |
|----------|------------|------------|
| Type | ${typeNum1} (${letterTypes[typeNum1]?.name || '?'}) | ${typeNum2} (${letterTypes[typeNum2]?.name || '?'}) |
| Blue motion | ${rep1.blueMotion.motionType} | ${rep2.blueMotion.motionType} |
| Red motion | ${rep1.redMotion.motionType} | ${rep2.redMotion.motionType} |
| Variations | ${var1.length} | ${var2.length} |

## Type Descriptions
- **${letter1}:** ${letterTypes[typeNum1]?.description || 'Type ' + typeNum1}
- **${letter2}:** ${letterTypes[typeNum2]?.description || 'Type ' + typeNum2}`
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

	const typeKey = type.toString()
	const typeInfo = letterTypes[typeKey]

	if (!typeInfo) {
		return `Invalid type ${type}. Valid types are 1-6.`
	}

	const letterCounts = typeInfo.letters.map(letter => {
		const count = allPictographs.filter(p => p.letter === letter).length
		return { letter, count }
	})

	// Pick up to 4 example letters to show as pictographs
	const exampleLetters = typeInfo.letters.slice(0, 4)

	const explanation = `# Type ${type}: ${typeInfo.name}

**Description:** ${typeInfo.description}

**Motion Pattern:**
- Blue hand: ${typeInfo.motionPattern.blueMotion}
- Red hand: ${typeInfo.motionPattern.redMotion}
${typeInfo.motionPattern.note ? `- Note: ${typeInfo.motionPattern.note}` : ''}

**Characteristics:**
${typeInfo.characteristics.map(c => `- ${c}`).join('\n')}

**Letters (${typeInfo.letters.length} total):**
${letterCounts.map(({ letter, count }) => `- **${letter}** (${count} variations)`).join('\n')}

**Visual Examples:** ${exampleLetters.join(', ')} (shown in context panel)`

	return {
		explanation,
		contextData: {
			type: 'typeList',
			typeNumber: type,
			typeName: typeInfo.name,
			description: typeInfo.description,
			exampleLetters,
			allLetters: typeInfo.letters,
			motionPattern: {
				blueMotion: typeInfo.motionPattern.blueMotion,
				redMotion: typeInfo.motionPattern.redMotion
			}
		}
	}
}

function executeGetPositionInfo(position: string): string {
	const normalizedPos = position.toLowerCase().trim()

	const positions: Record<string, {
		name: string
		angleDegrees: string
		description: string
		gridDescription: string
		examples: string[]
		level: number
	}> = {
		alpha: {
			name: 'Alpha (α)',
			angleDegrees: '180°',
			description: 'Hands are at opposite grid points, forming a straight line through the center.',
			gridDescription: 'Examples: N/S, E/W, NE/SW, NW/SE.',
			examples: ['alpha1: N and S', 'alpha3: E and W', 'alpha5: NE and SW'],
			level: 1
		},
		beta: {
			name: 'Beta (β)',
			angleDegrees: '0°',
			description: 'Both hands are at the same grid point.',
			gridDescription: 'Both props share a single location.',
			examples: ['beta1: Both at N', 'beta5: Both at NE'],
			level: 1
		},
		gamma: {
			name: 'Gamma (γ)',
			angleDegrees: '90°',
			description: 'Hands form a right angle, on adjacent grid points.',
			gridDescription: 'One hand is 90° away from the other.',
			examples: ['gamma1: N and E', 'gamma5: N and NW'],
			level: 1
		},
		zeta: {
			name: 'Zeta (ζ)',
			angleDegrees: '~135°',
			description: 'Hands form an obtuse angle. Level 4 (skewed grid).',
			gridDescription: 'One cardinal, one intercardinal point.',
			examples: ['N and SE', 'E and NW'],
			level: 4
		},
		eta: {
			name: 'Eta (η)',
			angleDegrees: '~45°',
			description: 'Hands form an acute angle. Level 4 (skewed grid).',
			gridDescription: 'One cardinal, one intercardinal point.',
			examples: ['N and NE', 'E and SE'],
			level: 4
		}
	}

	const posInfo = positions[normalizedPos]
	if (!posInfo) {
		return `Position "${position}" not recognized. Available: ${Object.keys(positions).join(', ')}`
	}

	ensureDataLoaded()
	const startCount = allPictographs.filter(p => p.startPosition.toLowerCase().startsWith(normalizedPos)).length
	const endCount = allPictographs.filter(p => p.endPosition.toLowerCase().startsWith(normalizedPos)).length

	return `# ${posInfo.name}

**Angle:** ${posInfo.angleDegrees} between hands

**Description:** ${posInfo.description}

**Grid:** ${posInfo.gridDescription}

**Examples:**
${posInfo.examples.map(e => `- ${e}`).join('\n')}

**Level:** ${posInfo.level}

**Usage:** ${startCount} start positions, ${endCount} end positions`
}

// ═══════════════════════════════════════════════════════════════════════════
// AI SDK Tools Definition
// ═══════════════════════════════════════════════════════════════════════════

// Define tools using JSON Schema to avoid Zod 3/4 compatibility issues
const tikaTools = {
	get_letter_explanation: tool({
		description: 'Get a comprehensive explanation of a TKA letter including its type, motion characteristics, and variations. Use this when asked about a specific letter.',
		parameters: jsonSchema<{ letter: string; variation?: number }>({
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
		parameters: jsonSchema<{ term: string }>({
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
		parameters: jsonSchema<{ letter1: string; letter2: string }>({
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
		description: 'List all letters of a specific type (1-6). Use this when asked about letter types or which letters are in a type.',
		parameters: jsonSchema<{ type: number }>({
			type: 'object',
			properties: {
				type: { type: 'number', minimum: 1, maximum: 6, description: 'Letter type 1-6: 1=Dual-Shift, 2=Shift, 3=Cross-Shift, 4=Dash, 5=Dual-Dash, 6=Static' }
			},
			required: ['type']
		}),
		execute: async ({ type }) => executeListLettersByType(type)
	}),

	get_position_info: tool({
		description: 'Get information about a TKA position (alpha, beta, gamma, zeta, eta). Use this when asked about positions or hand placements.',
		parameters: jsonSchema<{ position: string }>({
			type: 'object',
			properties: {
				position: { type: 'string', description: 'Position name (alpha, beta, gamma, zeta, eta)' }
			},
			required: ['position']
		}),
		execute: async ({ position }) => executeGetPositionInfo(position)
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
			messages: convertToCoreMessages(messages),
			tools: tikaTools,
			maxSteps: 5, // Allow up to 5 tool calls
			experimental_telemetry: {
				isEnabled: false
			}
		})

		// Return streaming response
		return result.toDataStreamResponse()

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
