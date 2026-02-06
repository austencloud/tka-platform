/**
 * Contract for TIKA Session Formatter
 *
 * Formats TikaSession data for various export purposes:
 * - AI review (comprehensive markdown with tool details)
 * - Human-readable summaries
 */

import type { TikaSession } from '../../domain/models/tika-conversation-models';

export interface ITikaSessionFormatter {
	/**
	 * Format a session for AI review.
	 * Produces comprehensive markdown including:
	 * - Session metadata (ID, timestamps, review status)
	 * - Review grades and notes
	 * - Full conversation with tool invocations
	 * - Tool inputs/outputs for debugging
	 */
	formatForAIReview(session: TikaSession): string;

	/**
	 * Extract text content from a message, including tool outputs.
	 * Handles both old (tool-invocation) and new (tool-{name}) AI SDK formats.
	 */
	getMessageText(message: { parts?: unknown[]; content?: string }): string;
}
