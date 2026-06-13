/**
 * TIKA Models API Endpoint
 *
 * Returns available AI models based on configured API keys.
 * Enables graceful degradation when certain providers are unavailable.
 */

import type { RequestHandler } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'
import { requireFirebaseUser } from '$lib/server/auth/requireFirebaseUser'
import { RATE_LIMITS } from '$lib/server/security/rate-limiter'
import { withRateLimit } from '$lib/server/security/withRateLimit'

export interface ModelOption {
  id: string
  name: string
  shortName: string
  icon: string
  color: string
  description: string
}

export const GET: RequestHandler = async (event) => {
  // Leaks which API keys are configured - require auth
  const caller = await requireFirebaseUser(event)

  const blocked = await withRateLimit(event, RATE_LIMITS.GENERAL, 'user', caller.uid)
  if (blocked) return blocked

  const models: ModelOption[] = []

  if (env.ANTHROPIC_API_KEY) {
    // Sonnet 4.6 - latest generation (default)
    models.push({
      id: 'sonnet-4',
      name: 'Claude Sonnet 4.6',
      shortName: 'Sonnet 4.6',
      icon: 'fa-brain',
      color: '#6366f1',
      description: 'Latest generation',
    })

    // Sonnet 4 - previous generation, available for A/B comparison
    models.push({
      id: 'sonnet-4-legacy',
      name: 'Claude Sonnet 4',
      shortName: 'Sonnet 4',
      icon: 'fa-brain',
      color: '#94a3b8',
      description: 'Previous generation',
    })

    // Haiku 4.5 - fast and lightweight
    models.push({
      id: 'haiku',
      name: 'Claude Haiku 4.5',
      shortName: 'Haiku 4.5',
      icon: 'fa-bolt',
      color: '#f59e0b',
      description: 'Fast and lightweight',
    })
  }

  // DeepSeek - cost-effective alternative
  if (env.DEEPSEEK_API_KEY) {
    models.push({
      id: 'deepseek',
      name: 'DeepSeek V3',
      shortName: 'DeepSeek',
      icon: 'fa-water',
      color: '#3b82f6',
      description: 'Cost-effective alternative',
    })
  }

  return new Response(JSON.stringify({ models }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  })
}
