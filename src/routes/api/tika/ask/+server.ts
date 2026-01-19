/**
 * TIKA Ask API Endpoint (AI SDK Streaming)
 *
 * Server-side endpoint for the TIKA AI assistant using Vercel AI SDK.
 * Streams responses word-by-word for modern chat UX.
 */

import type { RequestHandler } from '@sveltejs/kit'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { streamText, tool, convertToModelMessages, type UIMessage, jsonSchema, type LanguageModelV1 } from 'ai'
import { ANTHROPIC_API_KEY, DEEPSEEK_API_KEY } from '$env/static/private'
import fs from 'fs'
import path from 'path'
import { buildSystemPrompt } from '$lib/features/tika/ai/system-prompts'
import { deriveUserOverlay } from '$lib/features/tika/ai/knowledge-graph'
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
} from '$lib/features/tika/ai/canonical-responses'
import {
	toDisplayOutput,
	filterLetterExplanation,
	filterTypeList,
	filterComparison,
	filterSequence,
	filterQuiz
} from '$lib/features/tika/validation/output-filter'
import { validateResponse, formatValidationReport } from '$lib/features/tika/validation/TikaResponseValidator'

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

// Letter position mapping for sequence validation
interface LetterPositionMapping {
	startPosition: string
	endPosition: string
	startGroup: string
	endGroup: string
}
let letterPositionMappings: Record<string, LetterPositionMapping> = {}
let bridgeLettersByTransition: Record<string, string[]> = {}
let positionMappingsLoaded = false

function extractPositionGroup(position: string): string {
	if (position.startsWith('alpha')) return 'alpha'
	if (position.startsWith('beta')) return 'beta'
	if (position.startsWith('gamma')) return 'gamma'
	if (position.startsWith('zeta')) return 'zeta'
	if (position.startsWith('eta')) return 'eta'
	return 'unknown'
}

function loadLetterPositionMappings() {
	if (positionMappingsLoaded) return

	try {
		const mappingsPath = path.join(process.cwd(), 'static', 'data', 'learn', 'letter-mappings.json')
		if (!fs.existsSync(mappingsPath)) {
			console.warn('[TIKA API] letter-mappings.json not found, validation will use fallback')
			positionMappingsLoaded = true
			return
		}

		const data = JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'))

		// Build letter position mappings
		for (const [letter, mapping] of Object.entries(data.letters)) {
			const m = mapping as { startPosition: string; endPosition: string }
			letterPositionMappings[letter] = {
				startPosition: m.startPosition,
				endPosition: m.endPosition,
				startGroup: extractPositionGroup(m.startPosition),
				endGroup: extractPositionGroup(m.endPosition)
			}
		}

		// Build bridge letter index (letters that can bridge between position groups)
		const lettersByTransition: Record<string, string[]> = {}
		for (const [letter, mapping] of Object.entries(letterPositionMappings)) {
			const transition = `${mapping.startGroup}->${mapping.endGroup}`
			if (!lettersByTransition[transition]) {
				lettersByTransition[transition] = []
			}
			lettersByTransition[transition].push(letter)
		}
		bridgeLettersByTransition = lettersByTransition

		positionMappingsLoaded = true
		console.log(`[TIKA API] Loaded position mappings for ${Object.keys(letterPositionMappings).length} letters`)
	} catch (error) {
		console.error('[TIKA API] Failed to load letter-mappings.json:', error)
		positionMappingsLoaded = true
	}
}

interface SequenceValidationResult {
	isValid: boolean
	word: string
	letters: string[]
	transitions: Array<{
		from: string
		to: string
		fromEndGroup: string
		toStartGroup: string
		isValid: boolean
		bridgeOptions?: string[]
	}>
	invalidTransitions: Array<{
		position: number
		from: string
		to: string
		reason: string
		suggestedBridges: string[]
	}>
	interpolatedSequence?: string
	explanation: string
}

function validateSequenceChaining(letters: string[]): SequenceValidationResult {
	loadLetterPositionMappings()

	const transitions: SequenceValidationResult['transitions'] = []
	const invalidTransitions: SequenceValidationResult['invalidTransitions'] = []

	for (let i = 0; i < letters.length - 1; i++) {
		const fromLetter = letters[i]!
		const toLetter = letters[i + 1]!

		const fromMapping = letterPositionMappings[fromLetter]
		const toMapping = letterPositionMappings[toLetter]

		if (!fromMapping || !toMapping) {
			// Unknown letter - can't validate
			transitions.push({
				from: fromLetter,
				to: toLetter,
				fromEndGroup: fromMapping?.endGroup || 'unknown',
				toStartGroup: toMapping?.startGroup || 'unknown',
				isValid: false
			})
			invalidTransitions.push({
				position: i + 1,
				from: fromLetter,
				to: toLetter,
				reason: `Unknown letter: ${!fromMapping ? fromLetter : toLetter}`,
				suggestedBridges: []
			})
			continue
		}

		const fromEndGroup = fromMapping.endGroup
		const toStartGroup = toMapping.startGroup
		const isValid = fromEndGroup === toStartGroup

		// Find bridge options if invalid
		const bridgeTransition = `${fromEndGroup}->${toStartGroup}`
		const bridgeOptions = isValid ? undefined : (bridgeLettersByTransition[bridgeTransition] || [])

		transitions.push({
			from: fromLetter,
			to: toLetter,
			fromEndGroup,
			toStartGroup,
			isValid,
			bridgeOptions
		})

		if (!isValid) {
			invalidTransitions.push({
				position: i + 1,
				from: fromLetter,
				to: toLetter,
				reason: `${fromLetter} ends in ${fromEndGroup}, but ${toLetter} starts in ${toStartGroup}`,
				suggestedBridges: bridgeOptions?.slice(0, 3) || []
			})
		}
	}

	const isValid = invalidTransitions.length === 0
	const word = letters.join('')

	// Build explanation
	let explanation: string
	if (isValid) {
		explanation = `"${word}" is a valid sequence. All ${letters.length} letters chain correctly.`
	} else {
		const breakPoints = invalidTransitions.map(t =>
			`${t.from}→${t.to} (${t.reason})`
		).join('; ')
		explanation = `"${word}" cannot chain directly. Position breaks: ${breakPoints}`

		// Suggest interpolated version
		if (invalidTransitions.every(t => t.suggestedBridges.length > 0)) {
			explanation += `. Can be fixed with bridge letters.`
		}
	}

	// Build interpolated sequence if possible
	let interpolatedSequence: string | undefined
	if (!isValid && invalidTransitions.every(t => t.suggestedBridges.length > 0)) {
		const interpolated: string[] = [letters[0]!]
		for (let i = 0; i < letters.length - 1; i++) {
			const invalidT = invalidTransitions.find(t => t.position === i + 1)
			if (invalidT && invalidT.suggestedBridges.length > 0) {
				interpolated.push(invalidT.suggestedBridges[0]!)
			}
			interpolated.push(letters[i + 1]!)
		}
		interpolatedSequence = interpolated.join('')
	}

	return {
		isValid,
		word,
		letters,
		transitions,
		invalidTransitions,
		interpolatedSequence,
		explanation
	}
}

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

// ═══════════════════════════════════════════════════════════════════════════
// Multi-Provider Model Configuration
// ═══════════════════════════════════════════════════════════════════════════

interface ModelConfig {
	provider: 'anthropic' | 'deepseek'
	modelId: string
}

const MODELS: Record<string, ModelConfig> = {
	'sonnet-4': { provider: 'anthropic', modelId: 'claude-sonnet-4-20250514' },
	'deepseek': { provider: 'deepseek', modelId: 'deepseek-chat' },
}

function getModel(modelKey: string): LanguageModelV1 {
	const config = MODELS[modelKey] || MODELS['sonnet-4']

	if (config.provider === 'anthropic') {
		const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY })
		return anthropic(config.modelId)
	}

	if (config.provider === 'deepseek') {
		const deepseek = createDeepSeek({ apiKey: DEEPSEEK_API_KEY })
		return deepseek(config.modelId)
	}

	// Fallback to Anthropic
	const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY })
	return anthropic(MODELS['sonnet-4'].modelId)
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

interface InlinePictograph {
	type: 'inline-pictograph'
	letter: string
	variation?: number
	label?: string
}

interface InlineGallery {
	type: 'inline-gallery'
	items: Array<{ letter: string; variation?: number; label?: string }>
	layout: 'row' | 'grid'
	caption?: string
}

interface LetterExplanationResult {
	explanation: string
	inlinePictograph: InlinePictograph
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

	// Brief explanation - the pictograph IS the explanation
	const blueRot = varData.blueMotion.rotationDirection !== 'noRotation' ? ` (${varData.blueMotion.rotationDirection})` : ''
	const redRot = varData.redMotion.rotationDirection !== 'noRotation' ? ` (${varData.redMotion.rotationDirection})` : ''

	const explanation = `**${letter}** is a Type ${typeNum} (${fullTypeInfo?.name || typeInfo?.name}) letter. Blue hand ${varData.blueMotion.motionType}${blueRot}, red hand ${varData.redMotion.motionType}${redRot}. Moves from ${varData.startPosition} to ${varData.endPosition}.`

	return {
		explanation,
		// Inline pictograph reference - client will fetch and render
		inlinePictograph: {
			type: 'inline-pictograph',
			letter,
			variation
		},
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
	inlineGallery: InlineGallery
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

	// Brief comparison - pictographs show the difference
	let explanation = `**${letter1}** (Type ${typeNum1} - ${typeDef1?.name || '?'}): blue ${rep1.blueMotion.motionType}, red ${rep1.redMotion.motionType}.
**${letter2}** (Type ${typeNum2} - ${typeDef2?.name || '?'}): blue ${rep2.blueMotion.motionType}, red ${rep2.redMotion.motionType}.`

	// If different types, add one-liner about the key difference
	if (typeNum1 !== typeNum2) {
		explanation += ` Key difference: ${typeDef1?.description || ''} vs ${typeDef2?.description || ''}.`
	}

	return {
		explanation,
		// Inline gallery showing both letters side by side
		inlineGallery: {
			type: 'inline-gallery',
			items: [
				{ letter: letter1, label: `Type ${typeNum1}` },
				{ letter: letter2, label: `Type ${typeNum2}` }
			],
			layout: 'row',
			caption: `${letter1} vs ${letter2}`
		},
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
	inlineGallery: InlineGallery
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

	// Get letter list
	const letters = canonicalDef.letters.split(', ').flatMap(l => l.includes('through') ? TKA_LETTER_TYPES[typeKey]?.letters || [] : [l.trim()])
	const exampleLetters = typeInfo?.letters || letters

	// Brief explanation - gallery shows the letters
	const explanation = `**Type ${type} (${canonicalDef.name})**: ${canonicalDef.description}. Blue hand ${canonicalDef.motionPattern.blue}, red hand ${canonicalDef.motionPattern.red}.`

	// Build gallery items - for Type 1, include rotation labels
	let galleryItems: Array<{ letter: string; variation?: number; label?: string }> = []

	if (type === 1 && canonicalDef.rotationPattern) {
		// Type 1: Show with pro/anti/hybrid labels
		for (const group of canonicalDef.rotationPattern.groups) {
			const groupLetters = group.letters.split('')
			const patterns = group.pattern.split(', ')
			for (let i = 0; i < groupLetters.length; i++) {
				galleryItems.push({
					letter: groupLetters[i] || '',
					label: patterns[i]
				})
			}
		}
	} else {
		// Other types: just show letters
		galleryItems = exampleLetters.map(letter => ({ letter }))
	}

	return {
		explanation,
		// Inline gallery showing all letters of this type
		inlineGallery: {
			type: 'inline-gallery',
			items: galleryItems,
			layout: 'grid',
			caption: type === 1 ? 'Pattern of three: pro, anti, hybrid' : `All Type ${type} letters`
		},
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
			},
			...(canonicalDef.rotationPattern && { rotationPattern: canonicalDef.rotationPattern })
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
		execute: async ({ letter, variation = 0 }) => filterLetterExplanation(executeGetLetterExplanation(letter, variation))
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
		execute: async ({ term }) => toDisplayOutput(executeGetTermDefinition(term))
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
		execute: async ({ letter1, letter2 }) => filterComparison(executeCompareLetters(letter1, letter2))
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
		execute: async ({ type }) => filterTypeList(executeListLettersByType(type))
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

			// Return filtered output - no contextData
			return {
				explanation: `**${positionDef.name}:** ${positionDef.description}`,
				inlineGallery: {
					type: 'inline-gallery' as const,
					items: examples.map(ex => ({ letter: ex.letter, variation: ex.variation })),
					layout: 'row' as const,
					caption: `Examples of ${position} position`
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

			// Return filtered output - no contextData
			return {
				explanation: `**${motionDef.name}:** ${motionDef.description}`,
				inlineGallery: {
					type: 'inline-gallery' as const,
					items: examples.map(ex => ({ letter: ex.letter, variation: ex.variation })),
					layout: 'row' as const,
					caption: `Examples of ${motionType} motion`
				}
			}
		}
	}),

	explain_sequence: tool({
		description: 'MANDATORY for questions about sequences or "words" (multiple letters together). Generates and visualizes a valid TKA sequence. Use for "Show me sequence ABC", "What is the word XYZ", "Animate ABC".',
		inputSchema: jsonSchema<{ word: string }>({
			type: 'object',
			properties: {
				word: { type: 'string', description: 'The sequence word, e.g., "ABC" or "DEFGH"' }
			},
			required: ['word']
		}),
		execute: async ({ word }) => {
			try {
				// Parse and validate word
				const letters = parseWordToLettersLocal(word.toUpperCase())

				if (letters.length === 0) {
					return `Cannot generate sequence: no valid letters in "${word}"`
				}

				// Validate all letters are valid TKA letters
				for (const letter of letters) {
					if (!LETTER_TO_TYPE[letter]) {
						return `Invalid letter "${letter}" in sequence. Use valid TKA letters (A-V, W-Z, Greek letters, or dash variants).`
					}
				}

				const beatCount = letters.length
				const normalizedWord = letters.join('')

				// Brief explanation - full sequence generation happens client-side
				const explanation = `Here's **"${normalizedWord}"** as a ${beatCount}-beat animated sequence.`

				return {
					explanation,
					inlineSequencePlayer: {
						type: 'inline-sequence-player',
						word: normalizedWord,
						showControls: true
					}
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				return `Error processing sequence: ${errorMessage}`
			}
		}
	}),

	validate_sequence: tool({
		description: 'MANDATORY: Call this BEFORE attempting to generate or display any sequence. Algorithmically validates if letters can chain together based on position groups. Returns detailed explanation of any breaks and suggests bridge letters to fix invalid sequences. Never guess about sequence validity - always call this tool.',
		inputSchema: jsonSchema<{ word: string }>({
			type: 'object',
			properties: {
				word: { type: 'string', description: 'The sequence word to validate, e.g., "ABC" or "DEF"' }
			},
			required: ['word']
		}),
		execute: async ({ word }) => {
			try {
				const letters = parseWordToLettersLocal(word.toUpperCase())

				if (letters.length === 0) {
					return { isValid: false, explanation: `No valid letters in "${word}"` }
				}

				// Validate all letters exist
				for (const letter of letters) {
					if (!LETTER_TO_TYPE[letter]) {
						return {
							isValid: false,
							explanation: `Invalid letter "${letter}" in sequence. Use valid TKA letters.`
						}
					}
				}

				if (letters.length === 1) {
					return {
						isValid: true,
						word: letters[0],
						explanation: `Single letter "${letters[0]}" is always valid.`
					}
				}

				// Run algorithmic validation
				const result = validateSequenceChaining(letters)

				return {
					isValid: result.isValid,
					word: result.word,
					explanation: result.explanation,
					invalidTransitions: result.invalidTransitions.length > 0 ? result.invalidTransitions : undefined,
					interpolatedSequence: result.interpolatedSequence,
					canBeInterpolated: !!result.interpolatedSequence
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				return { isValid: false, explanation: `Validation error: ${errorMessage}` }
			}
		}
	}),

	show_sequence_steps: tool({
		description: 'Shows a sequence broken down into individual pictographs with step labels. IMPORTANT: Call validate_sequence first to check if the word is valid. If invalid, explain the validation result to the user instead of calling this tool.',
		inputSchema: jsonSchema<{ word: string; useInterpolation?: boolean }>({
			type: 'object',
			properties: {
				word: { type: 'string', description: 'The sequence word, e.g., "ABC" or "DEFGH"' },
				useInterpolation: { type: 'boolean', description: 'If true and sequence is invalid, use bridge letters to make it valid' }
			},
			required: ['word']
		}),
		execute: async ({ word }) => {
			try {
				// Parse and validate word
				const letters = parseWordToLettersLocal(word.toUpperCase())

				if (letters.length === 0) {
					return `Cannot generate sequence: no valid letters in "${word}"`
				}

				// Validate all letters are valid TKA letters
				for (const letter of letters) {
					if (!LETTER_TO_TYPE[letter]) {
						return `Invalid letter "${letter}" in sequence. Use valid TKA letters (A-V, W-Z, Greek letters, or dash variants).`
					}
				}

				// Generate a valid connected sequence
				const result = await generateSequenceInternal(letters, 100)

				if (!result.isValid || result.steps.length === 0) {
					return `Failed to generate sequence "${word}": ${result.error || 'Unknown error'}`
				}

				// Build step grid items - only include display-ready fields
				const stepGridItems = result.steps.map(step => ({
					stepNumber: step.stepNumber,
					letter: step.letter,
					label: step.stepNumber === 0 ? 'Start' : `Step ${step.stepNumber}`
					// Exclude: variation, startPosition, endPosition (internal data)
				}))

				const normalizedWord = letters.join('')
				const explanation = `Here's **"${normalizedWord}"** broken down into ${stepGridItems.length} beats:`

				return {
					explanation,
					inlineStepGrid: {
						type: 'inline-step-grid',
						word: normalizedWord,
						steps: stepGridItems,
						caption: `${letters.length}-beat sequence`
					}
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				return `Error generating step grid: ${errorMessage}`
			}
		}
	}),

	generate_quiz: tool({
		description: 'Generate an interactive quiz to test knowledge. Use when the user asks to be quizzed, wants to test their understanding, or after explaining a concept to reinforce learning. Can quiz on letters, types, positions, motion types, or comparisons.',
		inputSchema: jsonSchema<{
			topic: string
			quizType?: 'multiple-choice' | 'identify-letter' | 'true-false'
			difficulty?: 'easy' | 'medium' | 'hard'
		}>({
			type: 'object',
			properties: {
				topic: { type: 'string', description: 'Topic to quiz on: letter (e.g., "A"), type (e.g., "type1"), position (e.g., "alpha"), motion (e.g., "shift"), or general TKA concepts' },
				quizType: { type: 'string', enum: ['multiple-choice', 'identify-letter', 'true-false'], description: 'Type of quiz question' },
				difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Difficulty level' }
			},
			required: ['topic']
		}),
		execute: async ({ topic, quizType = 'multiple-choice', difficulty = 'medium' }) => {
			ensureDataLoaded()

			const normalizedTopic = topic.toLowerCase().trim()
			const quizId = `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

			// Generate quiz based on topic type
			let result
			if (normalizedTopic.startsWith('type') || /^[1-6]$/.test(normalizedTopic)) {
				// Quiz about a letter type
				const typeNum = parseInt(normalizedTopic.replace('type', '')) || parseInt(normalizedTopic)
				result = generateTypeQuiz(quizId, typeNum, quizType, difficulty)
			} else if (LETTER_TO_TYPE[topic.toUpperCase()]) {
				// Quiz about a specific letter
				result = generateLetterQuiz(quizId, topic.toUpperCase(), quizType, difficulty)
			} else if (POSITION_DEFINITIONS[normalizedTopic]) {
				// Quiz about a position
				result = generatePositionQuiz(quizId, normalizedTopic, quizType, difficulty)
			} else if (MOTION_TYPE_DEFINITIONS[normalizedTopic]) {
				// Quiz about a motion type
				result = generateMotionQuiz(quizId, normalizedTopic, quizType, difficulty)
			} else {
				// General TKA quiz
				result = generateGeneralQuiz(quizId, quizType, difficulty)
			}

			// Filter quiz output to ensure clean data for LLM
			return filterQuiz(result)
		}
	})
}

// ═══════════════════════════════════════════════════════════════════════════
// Quiz Generation Helpers (Visual-First)
// ═══════════════════════════════════════════════════════════════════════════

type QuizDisplayMode = 'text' | 'pictograph-grid' | 'motion-chips'
type QuizType = 'pick-letter' | 'pick-type' | 'odd-one-out' | 'match-motion' | 'true-false'

interface TextOption {
	id: string
	type: 'text'
	text: string
	correct: boolean
}

interface PictographOption {
	id: string
	type: 'pictograph'
	letter: string
	variation?: number
	correct: boolean
}

interface MotionPatternOption {
	id: string
	type: 'motion-pattern'
	blueMotion: string
	redMotion: string
	correct: boolean
}

type QuizOption = TextOption | PictographOption | MotionPatternOption

interface InlineQuiz {
	type: 'inline-quiz'
	id: string
	quizType: QuizType
	displayMode: QuizDisplayMode
	question: string
	options: QuizOption[]
	pictograph?: { letter: string; variation?: number }
	correctFeedback: string
	incorrectFeedback: string
	explanation?: string
	difficulty: 'easy' | 'medium' | 'hard'
	topic: string
}

interface QuizResult {
	explanation: string
	inlineQuiz: InlineQuiz
}

function shuffleArray<T>(array: T[]): T[] {
	const shuffled = [...array]
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		const temp = shuffled[i]
		shuffled[i] = shuffled[j] as T
		shuffled[j] = temp as T
	}
	return shuffled
}

/**
 * Get random letters from a specific type
 */
function getLettersFromType(typeNum: number, count: number): string[] {
	const typeInfo = TKA_LETTER_TYPES[typeNum.toString()]
	if (!typeInfo) return []
	return shuffleArray(typeInfo.letters).slice(0, count)
}

/**
 * Get random letters NOT from a specific type (for distractors)
 */
function getLettersNotFromType(excludeType: number, count: number): string[] {
	const otherTypes = Object.keys(TKA_LETTER_TYPES)
		.filter(t => t !== excludeType.toString())
		.map(t => parseInt(t))

	const letters: string[] = []
	for (const typeNum of shuffleArray(otherTypes)) {
		const typeLetters = getLettersFromType(typeNum, 2)
		letters.push(...typeLetters)
		if (letters.length >= count) break
	}
	return shuffleArray(letters).slice(0, count)
}

/**
 * VISUAL QUIZ: Show 4 pictographs, pick the Type X letter
 */
function generateTypeQuiz(
	quizId: string,
	typeNum: number,
	_quizType: string,
	difficulty: 'easy' | 'medium' | 'hard'
): QuizResult {
	const typeDef = TYPE_DEFINITIONS[typeNum]
	if (!typeDef) {
		return generateGeneralQuiz(quizId, 'pick-letter', difficulty)
	}

	// Get one correct letter from the target type
	const correctLetters = getLettersFromType(typeNum, 1)
	const correctLetter = correctLetters[0]
	if (!correctLetter) {
		return generateGeneralQuiz(quizId, 'pick-letter', difficulty)
	}

	// Get 3 distractor letters from OTHER types
	const distractorLetters = getLettersNotFromType(typeNum, 3)

	// Build pictograph options
	const options: PictographOption[] = shuffleArray([
		{ id: 'opt-correct', type: 'pictograph', letter: correctLetter, correct: true },
		{ id: 'opt-1', type: 'pictograph', letter: distractorLetters[0] || 'W', correct: false },
		{ id: 'opt-2', type: 'pictograph', letter: distractorLetters[1] || 'Φ', correct: false },
		{ id: 'opt-3', type: 'pictograph', letter: distractorLetters[2] || 'α', correct: false },
	])

	return {
		explanation: `Tap the Type ${typeNum} (${typeDef.name}) letter:`,
		inlineQuiz: {
			type: 'inline-quiz',
			id: quizId,
			quizType: 'pick-letter',
			displayMode: 'pictograph-grid',
			question: `Which letter is Type ${typeNum} (${typeDef.name})?`,
			options,
			correctFeedback: `Yes! ${correctLetter} is a Type ${typeNum} letter. ${typeDef.description}.`,
			incorrectFeedback: `Not quite. The correct answer was ${correctLetter}.`,
			explanation: typeDef.description,
			difficulty,
			topic: `type${typeNum}`
		}
	}
}

/**
 * VISUAL QUIZ: Show 4 pictographs, find the odd one out (different type)
 */
function generateOddOneOutQuiz(
	quizId: string,
	typeNum: number,
	difficulty: 'easy' | 'medium' | 'hard'
): QuizResult {
	const typeDef = TYPE_DEFINITIONS[typeNum]
	if (!typeDef) {
		return generateGeneralQuiz(quizId, 'odd-one-out', difficulty)
	}

	// Get 3 letters from the same type
	const sameTypeLetters = getLettersFromType(typeNum, 3)
	if (sameTypeLetters.length < 3) {
		return generateGeneralQuiz(quizId, 'odd-one-out', difficulty)
	}

	// Get 1 letter from a DIFFERENT type (the odd one)
	const oddLetters = getLettersNotFromType(typeNum, 1)
	const oddLetter = oddLetters[0]
	if (!oddLetter) {
		return generateGeneralQuiz(quizId, 'odd-one-out', difficulty)
	}

	const oddTypeInfo = LETTER_TO_TYPE[oddLetter]
	const oddTypeName = TYPE_DEFINITIONS[parseInt(oddTypeInfo?.type || '1')]?.name || 'unknown'

	// Build pictograph options
	const options: PictographOption[] = shuffleArray([
		{ id: 'opt-odd', type: 'pictograph', letter: oddLetter, correct: true },
		{ id: 'opt-1', type: 'pictograph', letter: sameTypeLetters[0] || 'A', correct: false },
		{ id: 'opt-2', type: 'pictograph', letter: sameTypeLetters[1] || 'B', correct: false },
		{ id: 'opt-3', type: 'pictograph', letter: sameTypeLetters[2] || 'C', correct: false },
	])

	return {
		explanation: `Three of these are Type ${typeNum}. Find the odd one out:`,
		inlineQuiz: {
			type: 'inline-quiz',
			id: quizId,
			quizType: 'odd-one-out',
			displayMode: 'pictograph-grid',
			question: `Which letter is NOT Type ${typeNum} (${typeDef.name})?`,
			options,
			correctFeedback: `Correct! ${oddLetter} is Type ${oddTypeInfo?.type} (${oddTypeName}), not Type ${typeNum}.`,
			incorrectFeedback: `Not quite. ${oddLetter} was the odd one out - it's Type ${oddTypeInfo?.type} (${oddTypeName}).`,
			explanation: `The other three letters are all Type ${typeNum} (${typeDef.name}).`,
			difficulty,
			topic: `type${typeNum}`
		}
	}
}

/**
 * VISUAL QUIZ: Match the motion pattern to the type
 */
function generateMotionMatchQuiz(
	quizId: string,
	typeNum: number,
	difficulty: 'easy' | 'medium' | 'hard'
): QuizResult {
	const typeDef = TYPE_DEFINITIONS[typeNum]
	if (!typeDef) {
		return generateGeneralQuiz(quizId, 'match-motion', difficulty)
	}

	// Build motion pattern options
	const allPatterns: MotionPatternOption[] = []

	// Add the correct pattern
	allPatterns.push({
		id: 'opt-correct',
		type: 'motion-pattern',
		blueMotion: typeDef.motionPattern.blue,
		redMotion: typeDef.motionPattern.red,
		correct: true
	})

	// Add distractor patterns from other types
	for (let t = 1; t <= 6; t++) {
		if (t === typeNum) continue
		const otherDef = TYPE_DEFINITIONS[t]
		if (!otherDef) continue

		// Skip if same pattern as correct
		if (otherDef.motionPattern.blue === typeDef.motionPattern.blue &&
			otherDef.motionPattern.red === typeDef.motionPattern.red) continue

		allPatterns.push({
			id: `opt-${t}`,
			type: 'motion-pattern',
			blueMotion: otherDef.motionPattern.blue,
			redMotion: otherDef.motionPattern.red,
			correct: false
		})

		if (allPatterns.length >= 4) break
	}

	// Ensure we have 4 options
	while (allPatterns.length < 4) {
		allPatterns.push({
			id: `opt-extra-${allPatterns.length}`,
			type: 'motion-pattern',
			blueMotion: 'static',
			redMotion: 'dash',
			correct: false
		})
	}

	const options = shuffleArray(allPatterns.slice(0, 4))

	return {
		explanation: `Which motion combination defines Type ${typeNum}?`,
		inlineQuiz: {
			type: 'inline-quiz',
			id: quizId,
			quizType: 'match-motion',
			displayMode: 'motion-chips',
			question: `What motion pattern do Type ${typeNum} (${typeDef.name}) letters have?`,
			options,
			correctFeedback: `Correct! Type ${typeNum} has ${typeDef.motionPattern.blue} blue + ${typeDef.motionPattern.red} red.`,
			incorrectFeedback: `Not quite. Type ${typeNum} has ${typeDef.motionPattern.blue} blue + ${typeDef.motionPattern.red} red.`,
			explanation: typeDef.description,
			difficulty,
			topic: `type${typeNum}`
		}
	}
}

/**
 * VISUAL QUIZ: Show a letter, identify it from pictograph grid
 */
function generateLetterQuiz(
	quizId: string,
	letter: string,
	_quizType: string,
	difficulty: 'easy' | 'medium' | 'hard'
): QuizResult {
	const typeInfo = LETTER_TO_TYPE[letter]
	const typeNum = parseInt(typeInfo?.type || '1')

	// Get 3 distractor letters (mix of same and different types)
	const sameTypeDistractors = getLettersFromType(typeNum, 2).filter(l => l !== letter)
	const otherTypeDistractors = getLettersNotFromType(typeNum, 2)
	const distractors = shuffleArray([...sameTypeDistractors, ...otherTypeDistractors]).slice(0, 3)

	const options: PictographOption[] = shuffleArray([
		{ id: 'opt-correct', type: 'pictograph', letter: letter, correct: true },
		{ id: 'opt-1', type: 'pictograph', letter: distractors[0] || 'B', correct: false },
		{ id: 'opt-2', type: 'pictograph', letter: distractors[1] || 'C', correct: false },
		{ id: 'opt-3', type: 'pictograph', letter: distractors[2] || 'W', correct: false },
	])

	return {
		explanation: `Can you find letter ${letter}?`,
		inlineQuiz: {
			type: 'inline-quiz',
			id: quizId,
			quizType: 'pick-letter',
			displayMode: 'pictograph-grid',
			question: `Tap the letter ${letter}:`,
			options,
			correctFeedback: `Correct! That's the letter ${letter}.`,
			incorrectFeedback: `Not quite. The correct answer was ${letter}.`,
			explanation: `${letter} is a Type ${typeNum} letter.`,
			difficulty,
			topic: letter
		}
	}
}

/**
 * Text-based true/false quiz
 */
function generateTrueFalseQuiz(
	quizId: string,
	typeNum: number,
	difficulty: 'easy' | 'medium' | 'hard'
): QuizResult {
	const typeDef = TYPE_DEFINITIONS[typeNum]
	if (!typeDef) {
		// Fallback to a generic true/false
		const isTrue = Math.random() > 0.5
		return {
			explanation: `True or false?`,
			inlineQuiz: {
				type: 'inline-quiz',
				id: quizId,
				quizType: 'true-false',
				displayMode: 'text',
				question: isTrue
					? `Type 1 letters have both hands shifting.`
					: `Type 1 letters have both hands stationary.`,
				options: [
					{ id: 'opt-true', type: 'text', text: 'True', correct: isTrue },
					{ id: 'opt-false', type: 'text', text: 'False', correct: !isTrue }
				],
				correctFeedback: `Correct!`,
				incorrectFeedback: `Not quite.`,
				explanation: `Type 1 (Dual-Shift) letters have both hands shifting.`,
				difficulty,
				topic: 'general'
			}
		}
	}

	const isTrue = Math.random() > 0.5
	let statement: string
	let explanation: string

	if (isTrue) {
		statement = `Type ${typeNum} (${typeDef.name}) letters have ${typeDef.motionPattern.blue} blue motion and ${typeDef.motionPattern.red} red motion.`
		explanation = `This is correct. ${typeDef.description}.`
	} else {
		// Make a false statement by swapping motions
		const wrongBlue = typeDef.motionPattern.blue === 'shift' ? 'dash' : 'shift'
		statement = `Type ${typeNum} (${typeDef.name}) letters have ${wrongBlue} blue motion and ${typeDef.motionPattern.red} red motion.`
		explanation = `Type ${typeNum} actually has ${typeDef.motionPattern.blue} blue motion and ${typeDef.motionPattern.red} red motion.`
	}

	return {
		explanation: `True or false?`,
		inlineQuiz: {
			type: 'inline-quiz',
			id: quizId,
			quizType: 'true-false',
			displayMode: 'text',
			question: statement,
			options: [
				{ id: 'opt-true', type: 'text', text: 'True', correct: isTrue },
				{ id: 'opt-false', type: 'text', text: 'False', correct: !isTrue }
			],
			correctFeedback: isTrue ? `Correct!` : `Right! That statement was false.`,
			incorrectFeedback: isTrue ? `Actually, that statement is true.` : `Actually, that statement is false.`,
			explanation,
			difficulty,
			topic: `type${typeNum}`
		}
	}
}

function generatePositionQuiz(
	quizId: string,
	_position: string,
	_quizType: string,
	difficulty: 'easy' | 'medium' | 'hard'
): QuizResult {
	// For positions, use a visual "pick letter" quiz showing letters that demonstrate the position
	return generateGeneralQuiz(quizId, 'pick-letter', difficulty)
}

function generateMotionQuiz(
	quizId: string,
	_motionType: string,
	_quizType: string,
	difficulty: 'easy' | 'medium' | 'hard'
): QuizResult {
	// For motion types, use a motion pattern matching quiz
	const randomType = Math.floor(Math.random() * 6) + 1
	return generateMotionMatchQuiz(quizId, randomType, difficulty)
}

function generateGeneralQuiz(
	quizId: string,
	_quizType: string,
	difficulty: 'easy' | 'medium' | 'hard'
): QuizResult {
	// Random visual quiz type
	const quizTypes = ['pick-letter', 'odd-one-out', 'match-motion']
	const selectedType = quizTypes[Math.floor(Math.random() * quizTypes.length)]
	const randomType = Math.floor(Math.random() * 6) + 1

	if (selectedType === 'odd-one-out') {
		return generateOddOneOutQuiz(quizId, randomType, difficulty)
	}

	if (selectedType === 'match-motion') {
		return generateMotionMatchQuiz(quizId, randomType, difficulty)
	}

	// Default: pick-letter
	return generateTypeQuiz(quizId, randomType, 'pick-letter', difficulty)
}

// ═══════════════════════════════════════════════════════════════════════════
// Sequence Generation Helpers
// ═══════════════════════════════════════════════════════════════════════════

interface SequenceStep {
	letter: string
	variation: number
	startPosition: string
	endPosition: string
	stepNumber: number
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

interface SequenceResult {
	word: string
	steps: SequenceStep[]
	startPosition: string
	endPosition: string
	isValid: boolean
	error?: string
}

const TYPE_6_LETTERS = ['α', 'β', 'γ']

function parseWordToLettersLocal(word: string): string[] {
	const letters: string[] = []
	let i = 0

	while (i < word.length) {
		const char = word[i]
		if (!char) {
			i++
			continue
		}

		// Check if next char is a dash (for Type 3/5 letters)
		const nextChar = word[i + 1]
		if (nextChar === '-') {
			letters.push(char + '-')
			i += 2
		} else {
			letters.push(char)
			i++
		}
	}

	return letters
}

function pickRandom<T>(items: T[]): T | null {
	if (items.length === 0) return null
	const randomIndex = Math.floor(Math.random() * items.length)
	return items[randomIndex] ?? null
}

async function generateSequenceInternal(letters: string[], maxAttempts: number = 100): Promise<SequenceResult> {
	ensureDataLoaded()

	if (letters.length === 0) {
		return {
			word: '',
			steps: [],
			startPosition: '',
			endPosition: '',
			isValid: false,
			error: 'No letters provided'
		}
	}

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const result = attemptSequenceBuild(letters)
		if (result.isValid) {
			return result
		}
	}

	return {
		word: letters.join(''),
		steps: [],
		startPosition: '',
		endPosition: '',
		isValid: false,
		error: `Failed to generate valid sequence after ${maxAttempts} attempts`
	}
}

function attemptSequenceBuild(letters: string[]): SequenceResult {
	const word = letters.join('')
	const steps: SequenceStep[] = []

	const firstLetter = letters[0]
	if (!firstLetter) {
		return {
			word,
			steps: [],
			startPosition: '',
			endPosition: '',
			isValid: false,
			error: 'No first letter'
		}
	}

	const firstLetterVariations = allPictographs.filter(p => p.letter === firstLetter)

	if (firstLetterVariations.length === 0) {
		return {
			word,
			steps: [],
			startPosition: '',
			endPosition: '',
			isValid: false,
			error: `No variations found for letter "${firstLetter}"`
		}
	}

	const firstVariation = pickRandom(firstLetterVariations)
	if (!firstVariation) {
		return {
			word,
			steps: [],
			startPosition: '',
			endPosition: '',
			isValid: false,
			error: 'Failed to pick first variation'
		}
	}

	const firstVariationIndex = firstLetterVariations.indexOf(firstVariation)
	const startPosition = firstVariation.startPosition

	// Find a valid start position (Type 6 static letter)
	const validStartPositions = allPictographs.filter(p => {
		return (
			TYPE_6_LETTERS.includes(p.letter) &&
			p.startPosition === startPosition &&
			p.endPosition === startPosition
		)
	})

	if (validStartPositions.length === 0) {
		return {
			word,
			steps: [],
			startPosition: '',
			endPosition: '',
			isValid: false,
			error: `No Type 6 static letter found at position ${startPosition}`
		}
	}

	const startPictograph = pickRandom(validStartPositions)
	if (!startPictograph) {
		return {
			word,
			steps: [],
			startPosition: '',
			endPosition: '',
			isValid: false,
			error: 'Failed to pick start position'
		}
	}

	// Add start position as step 0
	steps.push({
		letter: startPictograph.letter,
		variation: 0,
		startPosition: startPictograph.startPosition,
		endPosition: startPictograph.endPosition,
		stepNumber: 0,
		blueMotion: {
			motionType: startPictograph.blueMotion.motionType,
			startLocation: startPictograph.blueMotion.startLocation,
			endLocation: startPictograph.blueMotion.endLocation,
			rotationDirection: startPictograph.blueMotion.rotationDirection
		},
		redMotion: {
			motionType: startPictograph.redMotion.motionType,
			startLocation: startPictograph.redMotion.startLocation,
			endLocation: startPictograph.redMotion.endLocation,
			rotationDirection: startPictograph.redMotion.rotationDirection
		}
	})

	// Add first letter as step 1
	steps.push({
		letter: firstVariation.letter,
		variation: firstVariationIndex,
		startPosition: firstVariation.startPosition,
		endPosition: firstVariation.endPosition,
		stepNumber: 1,
		blueMotion: {
			motionType: firstVariation.blueMotion.motionType,
			startLocation: firstVariation.blueMotion.startLocation,
			endLocation: firstVariation.blueMotion.endLocation,
			rotationDirection: firstVariation.blueMotion.rotationDirection
		},
		redMotion: {
			motionType: firstVariation.redMotion.motionType,
			startLocation: firstVariation.redMotion.startLocation,
			endLocation: firstVariation.redMotion.endLocation,
			rotationDirection: firstVariation.redMotion.rotationDirection
		}
	})

	// Walk through remaining letters
	let currentEndPosition = firstVariation.endPosition

	for (let i = 1; i < letters.length; i++) {
		const letter = letters[i]
		if (!letter) continue

		const variations = allPictographs.filter(
			p => p.letter === letter && p.startPosition === currentEndPosition
		)

		if (variations.length === 0) {
			return {
				word,
				steps: [],
				startPosition: '',
				endPosition: '',
				isValid: false,
				error: `No valid continuation for letter "${letter}" from position ${currentEndPosition}`
			}
		}

		const chosenVariation = pickRandom(variations)
		if (!chosenVariation) {
			return {
				word,
				steps: [],
				startPosition: '',
				endPosition: '',
				isValid: false,
				error: `Failed to pick variation for letter "${letter}"`
			}
		}

		const allLetterVariations = allPictographs.filter(p => p.letter === letter)
		const variationIndex = allLetterVariations.indexOf(chosenVariation)

		steps.push({
			letter: chosenVariation.letter,
			variation: variationIndex >= 0 ? variationIndex : 0,
			startPosition: chosenVariation.startPosition,
			endPosition: chosenVariation.endPosition,
			stepNumber: i + 1,
			blueMotion: {
				motionType: chosenVariation.blueMotion.motionType,
				startLocation: chosenVariation.blueMotion.startLocation,
				endLocation: chosenVariation.blueMotion.endLocation,
				rotationDirection: chosenVariation.blueMotion.rotationDirection
			},
			redMotion: {
				motionType: chosenVariation.redMotion.motionType,
				startLocation: chosenVariation.redMotion.startLocation,
				endLocation: chosenVariation.redMotion.endLocation,
				rotationDirection: chosenVariation.redMotion.rotationDirection
			}
		})

		currentEndPosition = chosenVariation.endPosition
	}

	return {
		word,
		steps,
		startPosition: startPosition,
		endPosition: currentEndPosition,
		isValid: true
	}
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
	// Model selection (defaults to 'sonnet-4')
	model?: string
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body: TIKARequest = await request.json()

		// Determine which model to use (default to sonnet-4)
		const selectedModel = body.model || 'sonnet-4'

		// Validate API key based on selected model
		if (selectedModel === 'deepseek') {
			if (!DEEPSEEK_API_KEY) {
				return new Response(JSON.stringify({ error: 'Deepseek API key not configured' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				})
			}
		} else {
			if (!ANTHROPIC_API_KEY) {
				return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), {
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				})
			}
		}

		// Build system prompt based on user progress
		const completedConcepts = body.completedConcepts || []
		const language = body.language || 'en'
		const userOverlay = deriveUserOverlay(completedConcepts)
		const systemPrompt = buildSystemPrompt(userOverlay, language)

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

		// Stream the response using the selected model
		const result = streamText({
			model: getModel(selectedModel),
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
