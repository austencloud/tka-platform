/**
 * IConversationMemoryRetriever - Contract for retrieving past conversation context
 *
 * Searches saved TIKA sessions by title and last user message to provide
 * lightweight context about past conversations. Used to inject ~500 chars
 * of memory into the system prompt so TIKA can reference prior discussions.
 */

export interface ConversationMemorySummary {
  sessionId: string;
  title: string;
  lastUserMessage: string;
  updatedAt: Date;
  messageCount: number;
}

export interface IConversationMemoryRetriever {
  /**
   * Find sessions relevant to the current query.
   * Scores against title + lastUserMessage fields only (no full-message loading).
   */
  findRelevantSessions(
    query: string,
    limit?: number
  ): Promise<ConversationMemorySummary[]>;

  /**
   * Build a compact memory context string for the system prompt.
   * Returns top 3 matches formatted as one-line summaries, capped at 500 chars.
   */
  buildMemoryContext(query: string): Promise<string>;

  /**
   * Get a brief summary of the user's conversation history.
   * Returns session count, date range, and recent titles.
   */
  getHistorySummary(): Promise<string>;
}
