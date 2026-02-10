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
  // Leaks which API keys are configured — require auth
  const caller = await requireFirebaseUser(event)

  const blocked = withRateLimit(event, RATE_LIMITS.GENERAL, 'user', caller.uid)
  if (blocked) return blocked

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
