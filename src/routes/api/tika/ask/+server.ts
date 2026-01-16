/**
 * TIKA Ask API Endpoint (Tool-Use Architecture)
 *
 * Server-side endpoint for the TIKA AI assistant.
 * Uses Anthropic's tool-use API so Haiku can call educational tools
 * to retrieve authoritative information before responding.
 */

import { json, type RequestHandler } from '@sveltejs/kit'
import { ANTHROPIC_API_KEY } from '$env/static/private'
import fs from 'fs'
import path from 'path'
import { buildSystemPrompt } from '$lib/features/learn/ai/system-prompts'
import { deriveUserOverlay } from '$lib/features/learn/ai/knowledge-graph'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface AssistantRequest {
	question: string
	userId: string
	completedConcepts: string[]
	language?: string
}

interface ToolCall {
	name: string
	input: Record<string, unknown>
	result: unknown
}

interface ContextData {
	type: 'letter' | 'term' | 'comparison' | 'list' | 'position' | null
	letter?: {
		letter: string
		type: number
		typeName: string
		startPosition: string
		endPosition: string
		blueMotion: {
			motionType: string
			startLocation: string
			endLocation: string
			rotationDirection: string
		}
		redMotion: {
			motionType: string
			startLocation: string
			endLocation: string
			rotationDirection: string
		}
	}
	term?: {
		term: string
		definition: string
		examples: string[]
		relatedTerms: string[]
	}
	comparison?: {
		letter1: string
		letter2: string
		type1: string
		type2: string
	}
	position?: {
		name: string
		angleDegrees: string
		description: string
	}
}

interface AssistantResponse {
	explanation: string
	showPictograph: boolean
	pictographLetter?: string
	pictographVariation?: number
	source: 'tool-use'
	provider: 'haiku'
	latencyMs: number
	toolsCalled: ToolCall[]
	contextData?: ContextData
}

// ═══════════════════════════════════════════════════════════════════════════
// Knowledge Base & Data Loading
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

// Letter to type lookup
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
// Tool Definitions (matches MCP server tools)
// ═══════════════════════════════════════════════════════════════════════════

const TIKA_TOOLS = [
	{
		name: 'get_letter_explanation',
		description: 'Get a comprehensive explanation of a TKA letter including its type, motion characteristics, and variations. Use this when asked about a specific letter.',
		input_schema: {
			type: 'object' as const,
			properties: {
				letter: { type: 'string', description: 'The letter to explain (A-Z or Greek)' },
				variation: { type: 'number', description: 'Variation index (0-based, optional)' }
			},
			required: ['letter']
		}
	},
	{
		name: 'get_term_definition',
		description: 'Get the definition of a TKA domain term like alpha, pro, shift, static, beta, gamma, etc. Use this when asked what a term means.',
		input_schema: {
			type: 'object' as const,
			properties: {
				term: { type: 'string', description: 'The term to define' }
			},
			required: ['term']
		}
	},
	{
		name: 'compare_letters',
		description: 'Compare two TKA letters side by side, explaining their differences. Use this when asked to compare or contrast letters.',
		input_schema: {
			type: 'object' as const,
			properties: {
				letter1: { type: 'string', description: 'First letter to compare' },
				letter2: { type: 'string', description: 'Second letter to compare' }
			},
			required: ['letter1', 'letter2']
		}
	},
	{
		name: 'list_letters_by_type',
		description: 'List all letters of a specific type (1-6). Use this when asked about letter types or which letters are in a type.',
		input_schema: {
			type: 'object' as const,
			properties: {
				type: { type: 'number', description: 'Letter type 1-6: 1=Dual-Shift, 2=Shift, 3=Cross-Shift, 4=Dash, 5=Dual-Dash, 6=Static' }
			},
			required: ['type']
		}
	},
	{
		name: 'get_position_info',
		description: 'Get information about a TKA position (alpha, beta, gamma, zeta, eta). Use this when asked about positions or hand placements.',
		input_schema: {
			type: 'object' as const,
			properties: {
				position: { type: 'string', description: 'Position name (alpha, beta, gamma, zeta, eta)' }
			},
			required: ['position']
		}
	}
]

// ═══════════════════════════════════════════════════════════════════════════
// Tool Execution (replicates MCP server logic)
// ═══════════════════════════════════════════════════════════════════════════

interface ToolResult {
	text: string
	contextData?: ContextData
}

function executeGetLetterExplanation(letter: string, variation: number = 0): ToolResult {
	ensureDataLoaded()

	const variations = allPictographs.filter((p) => p.letter === letter)
	if (variations.length === 0) {
		return { text: `Letter "${letter}" not found in the TKA alphabet.` }
	}

	const typeInfo = LETTER_TO_TYPE[letter]
	const typeNum = typeInfo?.type || 'unknown'
	const fullTypeInfo = letterTypes[typeNum]
	const varData = variations[Math.min(variation, variations.length - 1)]

	const text = `# Letter: ${letter}

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
		text,
		contextData: {
			type: 'letter',
			letter: {
				letter,
				type: parseInt(typeNum) || 0,
				typeName: fullTypeInfo?.name || typeInfo?.name || 'Unknown',
				startPosition: varData.startPosition,
				endPosition: varData.endPosition,
				blueMotion: {
					motionType: varData.blueMotion.motionType,
					startLocation: varData.blueMotion.startLocation,
					endLocation: varData.blueMotion.endLocation,
					rotationDirection: varData.blueMotion.rotationDirection
				},
				redMotion: {
					motionType: varData.redMotion.motionType,
					startLocation: varData.redMotion.startLocation,
					endLocation: varData.redMotion.endLocation,
					rotationDirection: varData.redMotion.rotationDirection
				}
			}
		}
	}
}

function executeGetTermDefinition(term: string): ToolResult {
	ensureDataLoaded()

	const normalizedTerm = term.toLowerCase().trim()
	const entry = glossary[normalizedTerm]

	if (!entry) {
		const possibleMatches = Object.keys(glossary)
			.filter(key => key.includes(normalizedTerm) || normalizedTerm.includes(key))
			.slice(0, 5)

		return {
			text: `Term "${term}" not found.${possibleMatches.length > 0 ? ` Did you mean: ${possibleMatches.join(', ')}?` : ''}`
		}
	}

	const text = `# ${term.charAt(0).toUpperCase() + term.slice(1)}

**Definition:** ${entry.definition}

**Examples:**
${entry.examples.map(e => `- ${e}`).join('\n')}

**Related terms:** ${entry.relatedTerms.join(', ')}

**Category:** ${entry.category}`

	return {
		text,
		contextData: {
			type: 'term',
			term: {
				term,
				definition: entry.definition,
				examples: entry.examples,
				relatedTerms: entry.relatedTerms
			}
		}
	}
}

function executeCompareLetters(letter1: string, letter2: string): ToolResult {
	ensureDataLoaded()

	const var1 = allPictographs.filter((p) => p.letter === letter1)
	const var2 = allPictographs.filter((p) => p.letter === letter2)

	if (var1.length === 0) return { text: `Letter "${letter1}" not found.` }
	if (var2.length === 0) return { text: `Letter "${letter2}" not found.` }

	const type1 = LETTER_TO_TYPE[letter1]
	const type2 = LETTER_TO_TYPE[letter2]
	const typeNum1 = type1?.type || '?'
	const typeNum2 = type2?.type || '?'
	const rep1 = var1[0]
	const rep2 = var2[0]

	const text = `# Comparison: ${letter1} vs ${letter2}

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

	return {
		text,
		contextData: {
			type: 'comparison',
			comparison: {
				letter1,
				letter2,
				type1: letterTypes[typeNum1]?.name || typeNum1,
				type2: letterTypes[typeNum2]?.name || typeNum2
			}
		}
	}
}

function executeListLettersByType(type: number): ToolResult {
	ensureDataLoaded()

	const typeKey = type.toString()
	const typeInfo = letterTypes[typeKey]

	if (!typeInfo) {
		return { text: `Invalid type ${type}. Valid types are 1-6.` }
	}

	const letterCounts = typeInfo.letters.map(letter => {
		const count = allPictographs.filter(p => p.letter === letter).length
		return { letter, count }
	})

	const text = `# Type ${type}: ${typeInfo.name}

**Description:** ${typeInfo.description}

**Motion Pattern:**
- Blue hand: ${typeInfo.motionPattern.blueMotion}
- Red hand: ${typeInfo.motionPattern.redMotion}
${typeInfo.motionPattern.note ? `- Note: ${typeInfo.motionPattern.note}` : ''}

**Characteristics:**
${typeInfo.characteristics.map(c => `- ${c}`).join('\n')}

**Letters (${typeInfo.letters.length} total):**
${letterCounts.map(({ letter, count }) => `- **${letter}** (${count} variations)`).join('\n')}`

	return {
		text,
		contextData: {
			type: 'list'
		}
	}
}

function executeGetPositionInfo(position: string): ToolResult {
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
		return { text: `Position "${position}" not recognized. Available: ${Object.keys(positions).join(', ')}` }
	}

	ensureDataLoaded()
	const startCount = allPictographs.filter(p => p.startPosition.toLowerCase().startsWith(normalizedPos)).length
	const endCount = allPictographs.filter(p => p.endPosition.toLowerCase().startsWith(normalizedPos)).length

	const text = `# ${posInfo.name}

**Angle:** ${posInfo.angleDegrees} between hands

**Description:** ${posInfo.description}

**Grid:** ${posInfo.gridDescription}

**Examples:**
${posInfo.examples.map(e => `- ${e}`).join('\n')}

**Level:** ${posInfo.level}

**Usage:** ${startCount} start positions, ${endCount} end positions`

	return {
		text,
		contextData: {
			type: 'position',
			position: {
				name: posInfo.name,
				angleDegrees: posInfo.angleDegrees,
				description: posInfo.description
			}
		}
	}
}

function executeTool(name: string, input: Record<string, unknown>): ToolResult {
	switch (name) {
		case 'get_letter_explanation':
			return executeGetLetterExplanation(
				input.letter as string,
				(input.variation as number) || 0
			)
		case 'get_term_definition':
			return executeGetTermDefinition(input.term as string)
		case 'compare_letters':
			return executeCompareLetters(
				input.letter1 as string,
				input.letter2 as string
			)
		case 'list_letters_by_type':
			return executeListLettersByType(input.type as number)
		case 'get_position_info':
			return executeGetPositionInfo(input.position as string)
		default:
			return { text: `Unknown tool: ${name}` }
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Anthropic Tool-Use API
// ═══════════════════════════════════════════════════════════════════════════

interface AnthropicMessage {
	role: 'user' | 'assistant'
	content: string | AnthropicContentBlock[]
}

interface AnthropicContentBlock {
	type: 'text' | 'tool_use' | 'tool_result'
	text?: string
	id?: string
	name?: string
	input?: Record<string, unknown>
	tool_use_id?: string
	content?: string
}

interface AnthropicResponse {
	content: AnthropicContentBlock[]
	stop_reason: 'end_turn' | 'tool_use' | 'max_tokens'
	usage?: {
		input_tokens: number
		output_tokens: number
	}
}

async function callAnthropicWithTools(
	messages: AnthropicMessage[],
	systemPrompt: string
): Promise<AnthropicResponse> {
	const response = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': ANTHROPIC_API_KEY,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: 'claude-3-5-haiku-20241022',
			max_tokens: 1024,
			system: systemPrompt,
			tools: TIKA_TOOLS,
			messages
		})
	})

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`Anthropic API error: ${response.status} - ${error}`)
	}

	return response.json()
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Endpoint
// ═══════════════════════════════════════════════════════════════════════════

export const POST: RequestHandler = async ({ request }) => {
	const startTime = performance.now()

	try {
		const { question, userId, completedConcepts, language = 'en' }: AssistantRequest = await request.json()

		if (!question?.trim()) {
			return json({ error: 'Missing question' }, { status: 400 })
		}

		if (!userId) {
			return json({ error: 'Missing userId' }, { status: 400 })
		}

		if (!ANTHROPIC_API_KEY) {
			return json({ error: 'API key not configured' }, { status: 500 })
		}

		// Build dynamic system prompt based on user's progress
		const userOverlay = deriveUserOverlay(completedConcepts || [])
		const systemPrompt = buildSystemPrompt(userOverlay, language)

		// Initialize conversation
		const messages: AnthropicMessage[] = [
			{ role: 'user', content: question }
		]

		const toolsCalled: ToolCall[] = []
		let contextData: ContextData | undefined
		let finalText = ''

		// Tool-use loop - allow Haiku to call tools multiple times
		let iterations = 0
		const MAX_ITERATIONS = 5

		while (iterations < MAX_ITERATIONS) {
			iterations++

			const response = await callAnthropicWithTools(messages, systemPrompt)

			// Check if we're done
			if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
				// Extract final text
				for (const block of response.content) {
					if (block.type === 'text' && block.text) {
						finalText += block.text
					}
				}
				break
			}

			// Handle tool use
			if (response.stop_reason === 'tool_use') {
				// Collect all tool use blocks
				const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
				const toolResults: AnthropicContentBlock[] = []

				for (const toolUse of toolUseBlocks) {
					if (toolUse.name && toolUse.input && toolUse.id) {
						// Execute the tool
						const result = executeTool(toolUse.name, toolUse.input as Record<string, unknown>)

						// Track the tool call
						toolsCalled.push({
							name: toolUse.name,
							input: toolUse.input as Record<string, unknown>,
							result: result.text
						})

						// Capture context data from the first relevant tool
						if (result.contextData && !contextData) {
							contextData = result.contextData
						}

						// Add tool result
						toolResults.push({
							type: 'tool_result',
							tool_use_id: toolUse.id,
							content: result.text
						})
					}
				}

				// Add assistant's response (including tool_use blocks) to messages
				messages.push({
					role: 'assistant',
					content: response.content
				})

				// Add tool results
				messages.push({
					role: 'user',
					content: toolResults
				})
			}
		}

		// Extract pictograph letter if context has one
		let pictographLetter: string | undefined
		if (contextData?.type === 'letter' && contextData.letter) {
			pictographLetter = contextData.letter.letter
		} else if (contextData?.type === 'comparison' && contextData.comparison) {
			pictographLetter = contextData.comparison.letter1
		}

		const response: AssistantResponse = {
			explanation: finalText || "I couldn't generate a response. Please try again.",
			showPictograph: !!pictographLetter,
			pictographLetter,
			source: 'tool-use',
			provider: 'haiku',
			latencyMs: Math.round(performance.now() - startTime),
			toolsCalled,
			contextData
		}

		return json(response)
	} catch (error) {
		console.error('[TIKA API] Error:', error)
		return json(
			{
				explanation: "I'm having trouble answering that right now. Please try again.",
				showPictograph: false,
				source: 'tool-use',
				provider: 'haiku',
				latencyMs: Math.round(performance.now() - startTime),
				toolsCalled: [],
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 200 } // Return 200 with error in body for graceful handling
		)
	}
}
