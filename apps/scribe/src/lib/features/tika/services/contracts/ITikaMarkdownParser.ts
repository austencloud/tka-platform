/**
 * Contract for TIKA Markdown Parser
 *
 * Converts markdown text to HTML with special handling for:
 * - Tables (preserved structure)
 * - Links (converted to footnote references)
 * - Standard markdown (headers, bold, italic, lists)
 */

export interface ParsedMarkdown {
	/** The HTML-rendered content */
	html: string;
	/** Extracted links for footnote-style display */
	links: Array<{ text: string; url: string }>;
}

export interface ITikaMarkdownParser {
	/**
	 * Parse markdown text to HTML with link extraction
	 * @param markdown Raw markdown string
	 * @returns Parsed HTML and extracted links
	 */
	parse(markdown: string): ParsedMarkdown;

	/**
	 * Escape HTML special characters
	 * @param str Raw string
	 * @returns HTML-escaped string
	 */
	escapeHtml(str: string): string;
}
