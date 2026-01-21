/**
 * TIKA Models API Endpoint
 *
 * Returns available AI models based on configured API keys.
 * Enables graceful degradation when certain providers are unavailable.
 */

import type { RequestHandler } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

export interface ModelOption {
  id: string
  name: string
  shortName: string
  icon: string
  color: string
  description: string
}

export const GET: RequestHandler = async () => {
  const models: ModelOption[] = []

  // Sonnet 4 - always first (default)
  if (env.ANTHROPIC_API_KEY) {
    models.push({
      id: 'sonnet-4',
      name: 'Claude Sonnet 4',
      shortName: 'Sonnet 4',
      icon: 'fa-brain',
      color: '#6366f1',
      description: 'Balanced intelligence',
    })
  }

  // Deepseek - cost-effective alternative
  if (env.DEEPSEEK_API_KEY) {
    models.push({
      id: 'deepseek',
      name: 'Deepseek V3',
      shortName: 'Deepseek',
      icon: 'fa-water',
      color: '#3b82f6',
      description: 'Cost-effective testing',
    })
  }

  return new Response(JSON.stringify({ models }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
