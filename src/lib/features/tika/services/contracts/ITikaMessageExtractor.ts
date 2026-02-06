/**
 * Contract for TIKA Message Extractor
 *
 * Extracts structured content from AI SDK message parts.
 * Handles both old (tool-invocation) and new (tool-{name}) formats.
 */

import type { UIMessage } from 'ai';
import type {
	InlinePictograph,
	InlineGallery,
	InlineSequencePlayer,
	InlineStepGrid,
	InlineQuiz
} from '../../types';

/**
 * Normalized tool info for display
 */
export interface ToolInfo {
	name: string;
	args: Record<string, unknown>;
	isPending: boolean;
}

/**
 * Inline content extracted from tool outputs
 */
export interface InlineContent {
	pictograph?: InlinePictograph;
	gallery?: InlineGallery;
	galleries?: InlineGallery[];
	sequencePlayer?: InlineSequencePlayer;
	stepGrid?: InlineStepGrid;
	quiz?: InlineQuiz;
}

export interface ITikaMessageExtractor {
	/**
	 * Get text content from message parts
	 */
	getTextFromParts(parts: UIMessage['parts']): string;

	/**
	 * Get tool invocations from message parts (normalized across formats)
	 */
	getToolsFromParts(parts: UIMessage['parts']): ToolInfo[];

	/**
	 * Get the first tool output from parts (for rendering when no text response)
	 */
	getToolOutputFromParts(parts: UIMessage['parts']): string | null;

	/**
	 * Get all inline content from message parts
	 */
	getInlineContentFromParts(parts: UIMessage['parts']): InlineContent[];

	/**
	 * Extract explanation from tool output, handling various structures
	 */
	extractExplanation(output: unknown): string;

	/**
	 * Extract inline content (pictograph, gallery, etc.) from tool output
	 */
	extractInlineContent(output: unknown): InlineContent;
}
