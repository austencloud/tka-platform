/**
 * ConversationMemoryRetriever
 *
 * Retrieves relevant past conversation context by keyword-scoring
 * session titles and last user messages. Lightweight: never loads
 * full message arrays.
 */

import type { TikaSessionPreview, TikaSessionQueryOptions } from "../domain/models/tika-conversation-models";

export interface ConversationMemorySummary {
  sessionId: string;
  title: string;
  lastUserMessage: string;
  updatedAt: Date;
  messageCount: number;
}

interface SessionRepository {
  listSessions(options?: TikaSessionQueryOptions): Promise<TikaSessionPreview[]>;
}

const MAX_MEMORY_CHARS = 500;
const DEFAULT_MATCH_LIMIT = 3;

export class ConversationMemoryRetriever {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async findRelevantSessions(
    query: string,
    limit: number = DEFAULT_MATCH_LIMIT
  ): Promise<ConversationMemorySummary[]> {
    const sessions = await this.sessionRepository.listSessions({ limit: 50 });

    if (sessions.length === 0) return [];

    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scored = sessions
      .map((session) => ({
        session,
        score: this.scoreSession(session, queryTokens),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map(({ session }) => ({
      sessionId: session.id,
      title: session.title,
      lastUserMessage: session.lastUserMessage,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount,
    }));
  }

  async buildMemoryContext(query: string): Promise<string> {
    const matches = await this.findRelevantSessions(query, DEFAULT_MATCH_LIMIT);

    if (matches.length === 0) return "";

    const lines = matches.map(
      (m) => `- "${m.title}" (${m.messageCount} messages): ${m.lastUserMessage}`
    );

    let result = lines.join("\n");

    // Cap at MAX_MEMORY_CHARS
    if (result.length > MAX_MEMORY_CHARS) {
      result = result.slice(0, MAX_MEMORY_CHARS - 1) + "\u2026";
    }

    return result;
  }

  async getHistorySummary(): Promise<string> {
    const sessions = await this.sessionRepository.listSessions({ limit: 50 });

    if (sessions.length === 0) return "";

    const count = sessions.length;
    const recentTitles = sessions
      .slice(0, 3)
      .map((s) => `"${s.title}"`)
      .join(", ");

    const oldest = sessions[sessions.length - 1]!;
    const newest = sessions[0]!;

    const oldestDate = formatDate(oldest.updatedAt);
    const newestDate = formatDate(newest.updatedAt);

    if (count === 1) {
      return `You've had 1 conversation (${newestDate}): ${recentTitles}.`;
    }

    return `You've had ${count} conversations (${oldestDate} to ${newestDate}). Recent: ${recentTitles}.`;
  }

  /**
   * Score a session against query tokens.
   * Title matches are weighted 2x, lastUserMessage matches 1x.
   */
  private scoreSession(
    session: TikaSessionPreview,
    queryTokens: string[]
  ): number {
    const titleTokens = this.tokenize(session.title);
    const messageTokens = this.tokenize(session.lastUserMessage);

    let score = 0;
    for (const qt of queryTokens) {
      if (titleTokens.some((tt) => tt.includes(qt) || qt.includes(tt))) {
        score += 2;
      }
      if (messageTokens.some((mt) => mt.includes(qt) || qt.includes(mt))) {
        score += 1;
      }
    }

    return score;
  }

  /**
   * Tokenize a string into lowercase words, filtering out stop words and short tokens.
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const STOP_WORDS = new Set([
  "the",
  "is",
  "at",
  "of",
  "on",
  "in",
  "to",
  "for",
  "it",
  "an",
  "and",
  "or",
  "do",
  "a",
  "me",
  "my",
  "we",
  "be",
  "so",
  "if",
  "by",
  "up",
  "no",
  "as",
  "he",
  "she",
  "can",
  "did",
  "has",
  "was",
  "are",
  "but",
  "not",
  "you",
  "all",
  "any",
  "her",
  "him",
  "his",
  "how",
  "its",
  "may",
  "our",
  "out",
  "own",
  "too",
  "who",
  "why",
  "what",
  "that",
  "this",
  "with",
  "about",
  "tell",
  "show",
]);
