/**
 * Tika Assistant Service
 *
 * Main orchestration layer that:
 * 1. Classifies questions
 * 2. Routes to templates or LLM
 * 3. Handles pictograph generation requests
 * 4. Tracks interactions for A/B analysis
 */

import { classifyQuestion, shouldUseTemplate, getExplanationLevel } from './question-router'
import { getLetterExplanation, getLetterInfo } from './templates/letter-explanations'
import { getTermDefinition, getTermInfo } from './templates/term-definitions'
import { deriveUserOverlay, type UserKnowledgeOverlay } from './knowledge-graph'
import { buildSystemPrompt, buildLetterPrompt, buildComparisonPrompt, buildTermPrompt } from './system-prompts'
import { sendToLLM, getProvider, createInteractionRecord, isProviderAvailable, type LLMMessage, type LLMInteraction } from './llm-client'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface AssistantRequest {
	question: string
	userId: string
	completedConcepts: string[]
	language?: string
}

export interface AssistantResponse {
	/** The explanation text */
	explanation: string
	/** Whether a pictograph should be shown */
	showPictograph: boolean
	/** Letter to show (if any) */
	pictographLetter?: string
	/** Variation index (if specific) */
	pictographVariation?: number
	/** Source of the response */
	source: 'template' | 'api'
	/** Provider used (if API) */
	provider?: 'deepseek' | 'haiku'
	/** Response latency in ms */
	latencyMs: number
	/** Interaction record for tracking (if API) */
	interaction?: LLMInteraction
	/** Whether the question was recognized */
	recognized: boolean
	/** Type of question */
	questionType: string
}

// ═══════════════════════════════════════════════════════════════════════════
// Letter Type Information
// ═══════════════════════════════════════════════════════════════════════════

const TYPE_INFO: Record<string, { type: number; letters: string[] }> = {
	'type 1': { type: 1, letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V'] },
	'type 2': { type: 2, letters: ['W', 'X', 'Y', 'Z', 'Σ', 'Δ', 'Θ', 'Ω'] },
	'type 3': { type: 3, letters: ['W-', 'X-', 'Y-', 'Z-', 'Σ-', 'Δ-', 'Θ-', 'Ω-'] },
	'type 4': { type: 4, letters: ['Φ', 'Ψ', 'Λ'] },
	'type 5': { type: 5, letters: ['Φ-', 'Ψ-', 'Λ-'] },
	'type 6': { type: 6, letters: ['α', 'β', 'γ'] },
	'dual-shift': { type: 1, letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V'] },
	'shift': { type: 2, letters: ['W', 'X', 'Y', 'Z', 'Σ', 'Δ', 'Θ', 'Ω'] },
	'cross-shift': { type: 3, letters: ['W-', 'X-', 'Y-', 'Z-', 'Σ-', 'Δ-', 'Θ-', 'Ω-'] },
	'dash': { type: 4, letters: ['Φ', 'Ψ', 'Λ'] },
	'dual-dash': { type: 5, letters: ['Φ-', 'Ψ-', 'Λ-'] },
	'static': { type: 6, letters: ['α', 'β', 'γ'] }
}

// ═══════════════════════════════════════════════════════════════════════════
// Template Handlers
// ═══════════════════════════════════════════════════════════════════════════

function handleLetterQuestion(
	letter: string,
	overlay: UserKnowledgeOverlay
): { explanation: string; showPictograph: boolean } {
	const level = getExplanationLevel(0, overlay.currentLevel)
	const explanation = getLetterExplanation(letter, level)

	if (explanation) {
		return { explanation, showPictograph: true }
	}

	// Fallback for unknown letters
	return {
		explanation: `I don't have information about the letter "${letter}". Are you sure it's a valid TKA letter?`,
		showPictograph: false
	}
}

function handleTermQuestion(
	term: string,
	overlay: UserKnowledgeOverlay
): { explanation: string; showPictograph: boolean } {
	const level = getExplanationLevel(1, overlay.currentLevel)
	const explanation = getTermDefinition(term, level)

	if (explanation) {
		return { explanation, showPictograph: false }
	}

	// Fallback for unknown terms
	return {
		explanation: `I don't have a definition for "${term}". Is this a TKA term you've encountered?`,
		showPictograph: false
	}
}

function handleListQuestion(subject: string): { explanation: string; showPictograph: boolean } {
	const typeInfo = TYPE_INFO[subject.toLowerCase()]

	if (typeInfo) {
		const letterList = typeInfo.letters.join(', ')
		return {
			explanation: `The ${subject} letters are: ${letterList}`,
			showPictograph: false
		}
	}

	return {
		explanation: `I'm not sure what "${subject}" refers to. Can you clarify?`,
		showPictograph: false
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// API Handler
// ═══════════════════════════════════════════════════════════════════════════

async function handleWithAPI(
	question: string,
	questionType: string,
	subject: string | undefined,
	subject2: string | undefined,
	overlay: UserKnowledgeOverlay,
	userId: string,
	language: string
): Promise<{
	explanation: string
	showPictograph: boolean
	provider: 'deepseek' | 'haiku'
	latencyMs: number
	interaction: LLMInteraction
}> {
	const provider = getProvider(userId)

	if (!isProviderAvailable(provider)) {
		throw new Error(`No LLM provider available. Please configure API keys.`)
	}

	// Build messages
	const systemPrompt = buildSystemPrompt(overlay, language)
	let userPrompt: string

	switch (questionType) {
		case 'letter':
			userPrompt = buildLetterPrompt(subject!, overlay.majorLevel)
			break
		case 'comparison':
			userPrompt = buildComparisonPrompt(subject!, subject2!, overlay.majorLevel)
			break
		case 'term':
			userPrompt = buildTermPrompt(subject!, overlay.majorLevel)
			break
		default:
			userPrompt = question
	}

	const messages: LLMMessage[] = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: userPrompt }
	]

	// Call LLM
	const response = await sendToLLM(messages, provider)

	// Create interaction record
	const interaction = createInteractionRecord(userId, question, overlay.currentLevel, response)

	// Determine if we should show a pictograph
	const showPictograph = questionType === 'letter' || questionType === 'comparison'

	return {
		explanation: response.text,
		showPictograph,
		provider: response.provider,
		latencyMs: response.latencyMs,
		interaction
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Interface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ask Tika a question
 */
export async function askTika(request: AssistantRequest): Promise<AssistantResponse> {
	const startTime = performance.now()
	const { question, userId, completedConcepts, language = 'en' } = request

	// Derive user's knowledge overlay
	const overlay = deriveUserOverlay(completedConcepts)

	// Classify the question
	const match = classifyQuestion(question)

	// Determine routing
	const useTemplate = shouldUseTemplate(match, overlay.currentLevel)

	let result: {
		explanation: string
		showPictograph: boolean
		source: 'template' | 'api'
		provider?: 'deepseek' | 'haiku'
		latencyMs: number
		interaction?: LLMInteraction
	}

	try {
		if (useTemplate) {
			// Handle with templates
			let templateResult: { explanation: string; showPictograph: boolean }

			switch (match.type) {
				case 'letter':
					templateResult = handleLetterQuestion(match.subject!, overlay)
					break
				case 'term':
					templateResult = handleTermQuestion(match.subject!, overlay)
					break
				case 'list':
					templateResult = handleListQuestion(match.subject!)
					break
				default:
					// Fallback to API for unhandled template types
					const apiResult = await handleWithAPI(
						question,
						match.type,
						match.subject,
						match.subject2,
						overlay,
						userId,
						language
					)
					result = {
						...apiResult,
						source: 'api'
					}
					break
			}

			if (!result!) {
				result = {
					...templateResult!,
					source: 'template',
					latencyMs: Math.round(performance.now() - startTime)
				}
			}
		} else {
			// Handle with LLM API
			const apiResult = await handleWithAPI(
				question,
				match.type,
				match.subject,
				match.subject2,
				overlay,
				userId,
				language
			)
			result = {
				...apiResult,
				source: 'api'
			}
		}
	} catch (error) {
		// Graceful fallback
		console.error('Tika assistant error:', error)
		result = {
			explanation: "I'm having trouble answering that right now. Could you try rephrasing your question?",
			showPictograph: false,
			source: 'template',
			latencyMs: Math.round(performance.now() - startTime)
		}
	}

	return {
		...result,
		pictographLetter: match.subject,
		recognized: match.type !== 'complex',
		questionType: match.type
	}
}

/**
 * Get a quick explanation for a letter (for "Explain this" buttons)
 */
export function getQuickLetterExplanation(letter: string, completedConcepts: string[]): string {
	const overlay = deriveUserOverlay(completedConcepts)
	const level = getExplanationLevel(0, overlay.currentLevel)
	return getLetterExplanation(letter, level) ?? `Unable to explain letter "${letter}"`
}

/**
 * Get letter info for display
 */
export function getLetterDisplayInfo(letter: string) {
	return getLetterInfo(letter)
}

/**
 * Get term info for display
 */
export function getTermDisplayInfo(term: string) {
	return getTermInfo(term)
}
