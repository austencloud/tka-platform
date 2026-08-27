/**
 * TIKA Message Extractor
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
} from '../types';

export interface ToolInfo {
	name: string;
	args: Record<string, unknown>;
	isPending: boolean;
}
export interface InlineContent {
	pictograph?: InlinePictograph;
	gallery?: InlineGallery;
	galleries?: InlineGallery[];
	sequencePlayer?: InlineSequencePlayer;
	stepGrid?: InlineStepGrid;
	quiz?: InlineQuiz;
}

export function getTextFromParts(parts: UIMessage['parts']): string {
	if (!parts) return '';
	return parts
		.filter((part) => part.type === 'text')
		.map((part) => (part as { type: 'text'; text: string }).text)
		.join('');
}

export function getToolsFromParts(parts: UIMessage['parts']): ToolInfo[] {
	if (!parts) return [];
	const tools: ToolInfo[] = [];

	for (const part of parts) {
		// Old format: tool-invocation
		if (part.type === 'tool-invocation') {
			const inv = (part as { toolInvocation?: { toolName: string; args: Record<string, unknown>; state: string } })
				.toolInvocation;
			if (inv) {
				tools.push({
					name: inv.toolName,
					args: inv.args,
					isPending: inv.state !== 'result'
				});
			}
		}
		// New format: type is "tool-{toolName}"
		else if (part.type.startsWith('tool-')) {
			const toolName = part.type.replace('tool-', '');
			const toolPart = part as { input?: Record<string, unknown>; state?: string };
			tools.push({
				name: toolName,
				args: toolPart.input || {},
				isPending: toolPart.state !== 'output-available'
			});
		}
	}

	return tools;
}

export function getToolOutputFromParts(parts: UIMessage['parts']): string | null {
	if (!parts) return null;
	for (const part of parts) {
		// Check for new AI SDK format: type is "tool-{toolName}"
		if (part.type.startsWith('tool-') && part.type !== 'tool-invocation') {
			const toolPart = part as { output?: unknown; state?: string };
			if (toolPart.state === 'output-available' && toolPart.output) {
				return extractExplanation(toolPart.output);
			}
		}
		// Check for old format
		if (part.type === 'tool-invocation') {
			const inv = (part as { toolInvocation?: { state: string; result?: unknown } }).toolInvocation;
			if (inv?.state === 'result' && inv.result) {
				return extractExplanation(inv.result);
			}
		}
	}
	return null;
}

export function extractExplanation(output: unknown): string {
	if (typeof output === 'string') return output;
	if (output && typeof output === 'object') {
		const obj = output as Record<string, unknown>;
		// Check common response fields in priority order
		if (typeof obj.explanation === 'string') return obj.explanation;
		if (typeof obj.content === 'string') return obj.content;
		if (typeof obj.message === 'string') return obj.message;
		// Fallback to JSON
		return JSON.stringify(output, null, 2);
	}
	return String(output);
}

export function extractInlineContent(output: unknown): InlineContent {
	const content: InlineContent = {};
	if (!output || typeof output !== 'object') return content;

	const obj = output as Record<string, unknown>;

	// Check for inline pictograph
	if (obj.inlinePictograph && typeof obj.inlinePictograph === 'object') {
		const pic = obj.inlinePictograph as Record<string, unknown>;
		if (pic.type === 'inline-pictograph' && typeof pic.letter === 'string') {
			content.pictograph = obj.inlinePictograph as InlinePictograph;
		}
	}

	// Check for inline gallery (single)
	if (obj.inlineGallery && typeof obj.inlineGallery === 'object') {
		const gal = obj.inlineGallery as Record<string, unknown>;
		if (gal.type === 'inline-gallery' && Array.isArray(gal.items)) {
			content.gallery = obj.inlineGallery as InlineGallery;
		}
	}

	// Check for inline galleries (multiple, e.g., diamond + box mode)
	if (obj.inlineGalleries && Array.isArray(obj.inlineGalleries)) {
		content.galleries = [];
		for (const gal of obj.inlineGalleries) {
			if (gal && typeof gal === 'object') {
				const galObj = gal as Record<string, unknown>;
				if (galObj.type === 'inline-gallery' && Array.isArray(galObj.items)) {
					content.galleries.push(gal as InlineGallery);
				}
			}
		}
	}

	// Check for inline sequence player
	if (obj.inlineSequencePlayer && typeof obj.inlineSequencePlayer === 'object') {
		const seq = obj.inlineSequencePlayer as Record<string, unknown>;
		if (seq.type === 'inline-sequence-player' && typeof seq.word === 'string') {
			content.sequencePlayer = obj.inlineSequencePlayer as InlineSequencePlayer;
		}
	}

	if (obj.inlineStepGrid && typeof obj.inlineStepGrid === 'object') {
		const grid = obj.inlineStepGrid as Record<string, unknown>;
		if (grid.type === 'inline-step-grid' && Array.isArray(grid.steps)) {
			content.stepGrid = obj.inlineStepGrid as InlineStepGrid;
		}
	}

	if (obj.inlineQuiz && typeof obj.inlineQuiz === 'object') {
		const quiz = obj.inlineQuiz as Record<string, unknown>;
		if (quiz.type === 'inline-quiz' && typeof quiz.question === 'string') {
			content.quiz = obj.inlineQuiz as InlineQuiz;
		}
	}

	return content;
}

export function getInlineContentFromParts(parts: UIMessage['parts']): InlineContent[] {
	if (!parts) return [];
	const allContent: InlineContent[] = [];

	for (const part of parts) {
		// Check for new AI SDK format: type is "tool-{toolName}"
		if (part.type.startsWith('tool-') && part.type !== 'tool-invocation') {
			const toolPart = part as { output?: unknown; state?: string };
			if (toolPart.state === 'output-available' && toolPart.output) {
				const content = extractInlineContent(toolPart.output);
				if (
					content.pictograph ||
					content.gallery ||
					content.galleries?.length ||
					content.sequencePlayer ||
					content.stepGrid ||
					content.quiz
				) {
					allContent.push(content);
				}
			}
		}
		// Check for old format
		if (part.type === 'tool-invocation') {
			const inv = (part as { toolInvocation?: { state: string; result?: unknown } }).toolInvocation;
			if (inv?.state === 'result' && inv.result) {
				const content = extractInlineContent(inv.result);
				if (
					content.pictograph ||
					content.gallery ||
					content.galleries?.length ||
					content.sequencePlayer ||
					content.stepGrid ||
					content.quiz
				) {
					allContent.push(content);
				}
			}
		}
	}

	return allContent;
}
