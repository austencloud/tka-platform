/**
 * Tier Classifier
 *
 * Client-side heuristic that classifies voice transcripts as "action" or "question".
 * Zero cost, zero latency. Runs before any LLM call.
 *
 * - "action" → Tier 2 (LLM resolves to VoiceCommand)
 * - "question" → Tier 3 (route to TIKA chat, Phase 4)
 *
 * False positives are harmless: Tier 2 LLM can set escalateToChat: true
 * if it determines the user is actually asking a question.
 */

export type TierClassification = "action" | "question";

const QUESTION_STARTERS = [
  "what",
  "who",
  "where",
  "when",
  "why",
  "how",
  "which",
  "is there",
  "are there",
  "can i",
  "can you",
  "could you",
  "do you",
  "does",
];

const QUESTION_KEYWORDS = [
  "explain",
  "describe",
  "tell me about",
  "tell me what",
  "tell me how",
  "what is",
  "what are",
  "what does",
  "what's the difference",
  "difference between",
  "meaning of",
  "define",
];

export function classifyTier(rawText: string): TierClassification {
  const text = rawText.trim().toLowerCase();

  if (text.endsWith("?")) return "question";

  for (const keyword of QUESTION_KEYWORDS) {
    if (text.includes(keyword)) return "question";
  }

  for (const starter of QUESTION_STARTERS) {
    if (text.startsWith(starter + " ")) return "question";
  }

  return "action";
}
