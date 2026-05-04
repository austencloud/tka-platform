/**
 * Server-side module that searches the static app capabilities manifest.
 * Tokenizes queries and scores against keyword indices.
 * Pure functions, no Firestore, instant.
 */

import { APP_CAPABILITIES, type AppCapability } from "../knowledge/app-capabilities-manifest";

export interface CapabilityMatch {
  capability: AppCapability;
  relevance: number; // 0-1
}

const DEFAULT_LIMIT = 3;

export function findCapabilities(query: string, limit: number = DEFAULT_LIMIT): CapabilityMatch[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored: CapabilityMatch[] = [];

  for (const capability of APP_CAPABILITIES) {
    const score = scoreCapability(capability, queryTokens);
    if (score > 0) {
      scored.push({ capability, relevance: score });
    }
  }

  // Normalize scores to 0-1 range
  const maxScore = Math.max(...scored.map((s) => s.relevance), 1);
  for (const entry of scored) {
    entry.relevance = Math.round((entry.relevance / maxScore) * 100) / 100;
  }

  return scored
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, limit);
}

function scoreCapability(capability: AppCapability, queryTokens: string[]): number {
  let score = 0;
  const actionTokens = tokenize(capability.action);
  const moduleToken = capability.module.toLowerCase();
  const tabToken = capability.tab?.toLowerCase() || "";

  for (const qt of queryTokens) {
    // Keyword match (highest weight)
    if (capability.keywords.some((kw) => kw.includes(qt) || qt.includes(kw))) {
      score += 3;
    }

    // Action text match
    if (actionTokens.some((at) => at.includes(qt) || qt.includes(at))) {
      score += 2;
    }

    // Module/tab match
    if (moduleToken.includes(qt) || qt.includes(moduleToken)) {
      score += 1;
    }
    if (tabToken && (tabToken.includes(qt) || qt.includes(tabToken))) {
      score += 1;
    }
  }

  return score;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  "the", "is", "at", "of", "on", "in", "to", "for", "it", "an",
  "and", "or", "do", "a", "me", "my", "we", "be", "so", "if",
  "by", "up", "no", "as", "can", "how", "what", "where", "when",
]);
