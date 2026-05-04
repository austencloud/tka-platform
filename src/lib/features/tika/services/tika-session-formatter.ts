/**
 * TIKA Session Formatter
 *
 * Formats TikaSession data for AI review and other export purposes.
 */

import type { TikaSession } from '../domain/models/tika-conversation-models';

export function formatForAIReview(session: TikaSession): string {
	const lines: string[] = [
		'# Tika Conversation for Review',
		'',
		`**Session ID:** ${session.id}`,
		`**Created:** ${session.createdAt.toLocaleString()}`,
		`**Messages:** ${session.messageCount}`,
		`**Review Status:** ${session.reviewStatus || 'Not reviewed'}`
	];

	// Add review metadata if available
	if (session.reviewMetadata) {
		const meta = session.reviewMetadata;
		if (meta.grade) {
			lines.push(
				`**Grade:** ${meta.grade}${meta.confidence ? ` (${meta.confidence}% confidence)` : ''}`
			);
		}
		if (meta.notes) {
			lines.push(`**Reviewer Notes:** ${meta.notes}`);
		}
		if (meta.aiNotes) {
			lines.push(`**AI Analysis:** ${meta.aiNotes}`);
		}
	}

	lines.push('', '---', '');

	// Process each message with full tool details
	for (const message of session.messages) {
		if (message.role === 'user') {
			lines.push('## User Question');
			lines.push('');
			lines.push(getMessageText(message));
			lines.push('');
		} else if (message.role === 'assistant') {
			lines.push('## Tika Response');
			lines.push('');

			// Process message parts in detail
			if (message.parts) {
				// First, get any direct text content
				const textParts = message.parts.filter((p: unknown) => {
					const part = p as { type?: string };
					return part.type === 'text';
				});
				const textContent = textParts
					.map((p: unknown) => (p as { text?: string }).text || '')
					.join('');
				if (textContent) {
					lines.push(textContent);
					lines.push('');
				}

				// Then process all tool invocations with FULL details
				const toolDetails = formatToolInvocations(message.parts);

				// Add tool details section if there are tools
				if (toolDetails.length > 0) {
					lines.push('---');
					lines.push('');
					lines.push('## Tool Invocations');
					lines.push('');
					lines.push(...toolDetails);
				}
			}
		}
		lines.push('---');
		lines.push('');
	}

	return lines.join('\n');
}

export function getMessageText(message: { parts?: unknown[]; content?: string }): string {
	// First try text parts
	if (message.parts) {
		const textParts = message.parts.filter((p: unknown) => {
			const part = p as { type?: string };
			return part.type === 'text';
		});
		const textContent = textParts.map((p: unknown) => (p as { text?: string }).text || '').join('');
		if (textContent) return textContent;

		// If no text parts, try tool outputs
		for (const part of message.parts) {
			const p = part as {
				type?: string;
				output?: unknown;
				state?: string;
				toolInvocation?: { state: string; result?: unknown };
			};
			// New AI SDK format: type is "tool-{toolName}"
			if (p.type?.startsWith('tool-') && p.type !== 'tool-invocation') {
				if (p.state === 'output-available' && p.output) {
					const text = extractExplanation(p.output);
					if (text) return text;
				}
			}
			// Old format: tool-invocation
			if (p.type === 'tool-invocation' && p.toolInvocation) {
				if (p.toolInvocation.state === 'result' && p.toolInvocation.result) {
					const text = extractExplanation(p.toolInvocation.result);
					if (text) return text;
				}
			}
		}
	}

	// Fallback to content field
	return message.content || '';
}

/**
 * Format all tool invocations from message parts into markdown
 */
function formatToolInvocations(parts: unknown[]): string[] {
	const toolDetails: string[] = [];

	for (const part of parts) {
		const p = part as {
			type?: string;
			input?: Record<string, unknown>;
			output?: unknown;
			state?: string;
			toolInvocation?: {
				toolName: string;
				args: Record<string, unknown>;
				state: string;
				result?: unknown;
			};
		};

		// New AI SDK format: type is "tool-{toolName}"
		if (p.type?.startsWith('tool-') && p.type !== 'tool-invocation') {
			const toolName = p.type.replace('tool-', '');
			const isComplete = p.state === 'output-available';

			toolDetails.push(`### Tool: \`${toolName}\``);
			toolDetails.push('');
			toolDetails.push(`**Status:** ${isComplete ? '✅ Completed' : '⏳ Pending'}`);

			// Input parameters
			if (p.input) {
				toolDetails.push('');
				toolDetails.push('**Input:**');
				toolDetails.push('```json');
				toolDetails.push(JSON.stringify(p.input, null, 2));
				toolDetails.push('```');
			}

			// Output
			if (isComplete && p.output) {
				toolDetails.push('');
				toolDetails.push('**Output:**');
				formatToolOutput(p.output as Record<string, unknown>, toolDetails);
			}
			toolDetails.push('');
		}

		// Old format: tool-invocation
		if (p.type === 'tool-invocation' && p.toolInvocation) {
			const inv = p.toolInvocation;
			const isComplete = inv.state === 'result';

			toolDetails.push(`### Tool: \`${inv.toolName}\``);
			toolDetails.push('');
			toolDetails.push(`**Status:** ${isComplete ? '✅ Completed' : '⏳ Pending'}`);

			toolDetails.push('');
			toolDetails.push('**Input:**');
			toolDetails.push('```json');
			toolDetails.push(JSON.stringify(inv.args, null, 2));
			toolDetails.push('```');

			if (isComplete && inv.result) {
				toolDetails.push('');
				toolDetails.push('**Result:**');
				const result = inv.result as Record<string, unknown>;
				if (typeof result.explanation === 'string') {
					toolDetails.push(result.explanation);
				} else {
					toolDetails.push('```json');
					toolDetails.push(JSON.stringify(result, null, 2).slice(0, 1000));
					toolDetails.push('```');
				}
			}
			toolDetails.push('');
		}
	}

	return toolDetails;
}

/**
 * Format tool output with structured extraction for known types
 */
function formatToolOutput(output: Record<string, unknown>, lines: string[]): void {
	// Extract explanation if present
	if (typeof output.explanation === 'string') {
		lines.push('');
		lines.push('*Explanation:*');
		lines.push(output.explanation);
	}

	// Extract inline pictograph details
	if (output.inlinePictograph) {
		const pic = output.inlinePictograph as Record<string, unknown>;
		lines.push('');
		lines.push('*Generated Pictograph:*');
		lines.push(`- Letter: ${pic.letter}`);
		if (pic.variation !== undefined) lines.push(`- Variation: ${pic.variation}`);
		if (pic.propType) lines.push(`- Prop Type: ${pic.propType}`);
		if (pic.imageUrl) lines.push(`- Image: Generated successfully`);
	}

	// Extract inline gallery details
	if (output.inlineGallery) {
		const gal = output.inlineGallery as Record<string, unknown>;
		const items = (gal.items as unknown[]) || [];
		lines.push('');
		lines.push('*Generated Gallery:*');
		if (gal.title) lines.push(`- Title: ${gal.title}`);
		lines.push(`- Items: ${items.length} pictographs`);
		for (const item of items.slice(0, 5)) {
			const it = item as Record<string, unknown>;
			lines.push(`  - ${it.label || it.letter || 'Unknown'}`);
		}
		if (items.length > 5) {
			lines.push(`  - ... and ${items.length - 5} more`);
		}
	}

	// Extract multiple galleries
	if (output.inlineGalleries && Array.isArray(output.inlineGalleries)) {
		for (const gal of output.inlineGalleries) {
			const gallery = gal as Record<string, unknown>;
			const items = (gallery.items as unknown[]) || [];
			lines.push('');
			lines.push(`*Gallery: ${gallery.title || 'Untitled'}*`);
			lines.push(`- Items: ${items.length} pictographs`);
		}
	}

	// Extract sequence player details
	if (output.inlineSequencePlayer) {
		const seq = output.inlineSequencePlayer as Record<string, unknown>;
		lines.push('');
		lines.push('*Generated Sequence Player:*');
		if (seq.word) lines.push(`- Word: ${seq.word}`);
	}

	// Extract quiz details
	if (output.inlineQuiz) {
		const quiz = output.inlineQuiz as Record<string, unknown>;
		lines.push('');
		lines.push('*Generated Quiz:*');
		if (quiz.question) lines.push(`- Question: ${quiz.question}`);
		if (quiz.options && Array.isArray(quiz.options)) {
			lines.push(`- Options: ${quiz.options.length}`);
		}
	}

	// Raw output for inspection (truncated)
	const outputStr = JSON.stringify(output);
	if (outputStr.length < 500) {
		lines.push('');
		lines.push('*Raw Output (for debugging):*');
		lines.push('```json');
		lines.push(JSON.stringify(output, null, 2));
		lines.push('```');
	}
}

/**
 * Extract explanation from tool output
 */
function extractExplanation(output: unknown): string {
	if (typeof output === 'string') return output;
	if (output && typeof output === 'object') {
		const obj = output as Record<string, unknown>;
		// Check for explanation field (canonical response format)
		if (typeof obj.explanation === 'string') {
			return obj.explanation;
		}
	}
	return '';
}
