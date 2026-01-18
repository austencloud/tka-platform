/**
 * Stream Client for TIKA API
 *
 * Parses the Vercel AI SDK data protocol:
 * - 0:"text" = text delta
 * - 9:{...}  = tool call
 * - a:{...}  = tool result
 */

/**
 * Call TIKA streaming endpoint and parse the response
 *
 * @param {string} question - The user's question
 * @param {number} userLevel - User's knowledge level (1-4)
 * @param {string[]} completedConcepts - List of completed concept IDs
 * @returns {Promise<{explanation: string, toolsCalled: Array, latencyMs: number}>}
 */
export async function callTikaStreaming(question, userLevel, completedConcepts = []) {
	const startTime = Date.now();

	const response = await fetch('http://localhost:5173/api/tika/ask', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			messages: [
				{
					id: crypto.randomUUID(),
					role: 'user',
					content: question,
					parts: [{ type: 'text', text: question }],
					createdAt: new Date().toISOString()
				}
			],
			completedConcepts: completedConcepts,
			language: 'en'
		})
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`API error: ${response.status} - ${errorText}`);
	}

	const text = await response.text();
	const parsed = parseDataStream(text);

	return {
		explanation: parsed.fullText,
		toolsCalled: parsed.toolCalls,
		latencyMs: Date.now() - startTime
	};
}

/**
 * Parse the Vercel AI SDK data stream format
 *
 * Protocol reference: https://sdk.vercel.ai/docs/ai-sdk-ui/stream-protocol
 *
 * Line prefixes:
 * - 0: = text delta (JSON string)
 * - 9: = tool call start
 * - a: = tool result
 * - e: = finish (with usage stats)
 * - d: = done
 *
 * @param {string} text - Raw stream response text
 * @returns {{fullText: string, toolCalls: Array}}
 */
function parseDataStream(text) {
	const lines = text.split('\n').filter((l) => l.trim());
	let fullText = '';
	const toolCalls = [];
	const toolCallsById = new Map();

	for (const line of lines) {
		try {
			// Text delta: 0:"text content"
			if (line.startsWith('0:')) {
				const content = JSON.parse(line.slice(2));
				if (typeof content === 'string') {
					fullText += content;
				}
			}
			// Tool call: 9:{toolCallId, toolName, args}
			else if (line.startsWith('9:')) {
				const data = JSON.parse(line.slice(2));
				const toolCall = {
					id: data.toolCallId,
					name: data.toolName,
					input: data.args,
					result: null
				};
				toolCalls.push(toolCall);
				toolCallsById.set(data.toolCallId, toolCall);
			}
			// Tool result: a:{toolCallId, result}
			else if (line.startsWith('a:')) {
				const data = JSON.parse(line.slice(2));
				const toolCall = toolCallsById.get(data.toolCallId);
				if (toolCall) {
					toolCall.result = data.result;
				}
			}
			// Finish message: e:{finishReason, usage}
			else if (line.startsWith('e:')) {
				// Could extract usage stats if needed
				// const data = JSON.parse(line.slice(2));
			}
			// Done marker: d:{...}
			else if (line.startsWith('d:')) {
				// Stream complete
			}
		} catch (parseError) {
			// Skip malformed lines but log for debugging
			console.warn('Failed to parse stream line:', line, parseError.message);
		}
	}

	return { fullText, toolCalls };
}

/**
 * Get the completed concepts for a given user level
 * Used to simulate a user at that knowledge level
 *
 * @param {number} level - User level (1-4)
 * @returns {string[]} - Array of completed concept IDs
 */
export function getLevelConcepts(level) {
	const concepts = {
		1: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8'],
		2: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6', '1.7', '1.8', '2.1', '2.2', '2.3'],
		3: [
			'1.1',
			'1.2',
			'1.3',
			'1.4',
			'1.5',
			'1.6',
			'1.7',
			'1.8',
			'2.1',
			'2.2',
			'2.3',
			'3.1',
			'3.2',
			'3.3'
		],
		4: [
			'1.1',
			'1.2',
			'1.3',
			'1.4',
			'1.5',
			'1.6',
			'1.7',
			'1.8',
			'2.1',
			'2.2',
			'2.3',
			'3.1',
			'3.2',
			'3.3',
			'4.1',
			'4.2',
			'4.3',
			'4.4',
			'4.5'
		]
	};
	return concepts[level] || concepts[1];
}
