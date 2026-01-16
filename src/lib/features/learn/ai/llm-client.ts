/**
 * LLM Client for Tika
 *
 * Supports A/B testing between DeepSeek and Claude Haiku.
 * Tracks interactions for analysis.
 */

import { browser } from '$app/environment'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type LLMProvider = 'deepseek' | 'haiku'

export interface LLMConfig {
	provider: LLMProvider
	model: string
	baseUrl: string
	getApiKey: () => string | undefined
}

export interface LLMMessage {
	role: 'system' | 'user' | 'assistant'
	content: string
}

export interface LLMResponse {
	text: string
	provider: LLMProvider
	latencyMs: number
	inputTokens?: number
	outputTokens?: number
	estimatedCost?: number
}

export interface LLMInteraction {
	id: string
	userId: string
	provider: LLMProvider
	question: string
	userLevel: number
	responseText: string
	latencyMs: number
	inputTokens?: number
	outputTokens?: number
	estimatedCost?: number
	timestamp: Date
	rating?: 1 | 2 | 3 | 4 | 5
	flaggedInaccurate?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// Provider Configurations
// ═══════════════════════════════════════════════════════════════════════════

const PROVIDERS: Record<LLMProvider, LLMConfig> = {
	deepseek: {
		provider: 'deepseek',
		model: 'deepseek-chat',
		baseUrl: 'https://api.deepseek.com/v1',
		getApiKey: () => (browser ? undefined : import.meta.env.VITE_DEEPSEEK_API_KEY)
	},
	haiku: {
		provider: 'haiku',
		model: 'claude-3-5-haiku-20241022',
		baseUrl: 'https://api.anthropic.com/v1',
		getApiKey: () => (browser ? undefined : import.meta.env.VITE_ANTHROPIC_API_KEY)
	}
}

// Cost per million tokens
const COSTS: Record<LLMProvider, { input: number; output: number }> = {
	deepseek: { input: 0.28, output: 0.42 },
	haiku: { input: 1.0, output: 5.0 }
}

// ═══════════════════════════════════════════════════════════════════════════
// A/B Test Assignment
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get the assigned LLM provider for a user (consistent per user)
 */
export function getAssignedProvider(userId: string): LLMProvider {
	// Simple hash-based assignment for 50/50 split
	const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
	return hash % 2 === 0 ? 'deepseek' : 'haiku'
}

/**
 * Override provider assignment (for testing)
 */
let providerOverride: LLMProvider | null = null

export function setProviderOverride(provider: LLMProvider | null): void {
	providerOverride = provider
}

export function getProvider(userId: string): LLMProvider {
	return providerOverride ?? getAssignedProvider(userId)
}

// ═══════════════════════════════════════════════════════════════════════════
// LLM API Calls
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Call DeepSeek API
 */
async function callDeepSeek(
	messages: LLMMessage[],
	config: LLMConfig
): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
	const apiKey = config.getApiKey()
	if (!apiKey) {
		throw new Error('DeepSeek API key not configured')
	}

	const response = await fetch(`${config.baseUrl}/chat/completions`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: config.model,
			messages: messages.map((m) => ({ role: m.role, content: m.content })),
			max_tokens: 1024,
			temperature: 0.7
		})
	})

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
	}

	const data = await response.json()
	return {
		text: data.choices[0].message.content,
		inputTokens: data.usage?.prompt_tokens,
		outputTokens: data.usage?.completion_tokens
	}
}

/**
 * Call Anthropic API (Claude Haiku)
 */
async function callAnthropic(
	messages: LLMMessage[],
	config: LLMConfig
): Promise<{ text: string; inputTokens?: number; outputTokens?: number }> {
	const apiKey = config.getApiKey()
	if (!apiKey) {
		throw new Error('Anthropic API key not configured')
	}

	// Separate system message from conversation
	const systemMessage = messages.find((m) => m.role === 'system')
	const conversationMessages = messages.filter((m) => m.role !== 'system')

	const response = await fetch(`${config.baseUrl}/messages`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'x-api-key': apiKey,
			'anthropic-version': '2023-06-01'
		},
		body: JSON.stringify({
			model: config.model,
			max_tokens: 1024,
			system: systemMessage?.content,
			messages: conversationMessages.map((m) => ({ role: m.role, content: m.content }))
		})
	})

	if (!response.ok) {
		const error = await response.text()
		throw new Error(`Anthropic API error: ${response.status} - ${error}`)
	}

	const data = await response.json()
	return {
		text: data.content[0].text,
		inputTokens: data.usage?.input_tokens,
		outputTokens: data.usage?.output_tokens
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Interface
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Send a message to the LLM and get a response
 */
export async function sendToLLM(
	messages: LLMMessage[],
	provider: LLMProvider
): Promise<LLMResponse> {
	const config = PROVIDERS[provider]
	const startTime = performance.now()

	let result: { text: string; inputTokens?: number; outputTokens?: number }

	if (provider === 'deepseek') {
		result = await callDeepSeek(messages, config)
	} else {
		result = await callAnthropic(messages, config)
	}

	const latencyMs = Math.round(performance.now() - startTime)

	// Estimate cost
	const costs = COSTS[provider]
	const estimatedCost =
		result.inputTokens && result.outputTokens
			? (result.inputTokens / 1_000_000) * costs.input +
				(result.outputTokens / 1_000_000) * costs.output
			: undefined

	return {
		text: result.text,
		provider,
		latencyMs,
		inputTokens: result.inputTokens,
		outputTokens: result.outputTokens,
		estimatedCost
	}
}

/**
 * Create an interaction record for tracking
 */
export function createInteractionRecord(
	userId: string,
	question: string,
	userLevel: number,
	response: LLMResponse
): LLMInteraction {
	return {
		id: crypto.randomUUID(),
		userId,
		provider: response.provider,
		question,
		userLevel,
		responseText: response.text,
		latencyMs: response.latencyMs,
		inputTokens: response.inputTokens,
		outputTokens: response.outputTokens,
		estimatedCost: response.estimatedCost,
		timestamp: new Date()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Provider Health Check
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Check if a provider is configured and available
 */
export function isProviderAvailable(provider: LLMProvider): boolean {
	const config = PROVIDERS[provider]
	return !!config.getApiKey()
}

/**
 * Get the first available provider, preferring the assigned one
 */
export function getAvailableProvider(userId: string): LLMProvider | null {
	const assigned = getProvider(userId)

	if (isProviderAvailable(assigned)) {
		return assigned
	}

	// Fallback to other provider
	const other = assigned === 'deepseek' ? 'haiku' : 'deepseek'
	if (isProviderAvailable(other)) {
		return other
	}

	return null
}
