/**
 * TIKA Markdown Parser
 *
 * Converts markdown text to HTML for display in TIKA chat responses.
 * Handles tables, links (as footnote references), and standard markdown.
 */

import type { ITikaMarkdownParser, ParsedMarkdown } from '../contracts/ITikaMarkdownParser';

export class TikaMarkdownParser implements ITikaMarkdownParser {
	parse(markdown: string): ParsedMarkdown {
		if (!markdown) return { html: '', links: [] };

		// First, extract and process tables BEFORE any other transformation
		// Tables need their structure preserved
		const tableBlocks: string[] = [];
		let processed = markdown.replace(
			/\|[^\n]+\|\n\|[-:\s|]+\|\n(\|[^\n]+\|\n?)*/g,
			(tableMatch) => {
				const lines = tableMatch.trim().split('\n');
				if (lines.length < 2) return tableMatch;

				// Parse header row
				const headerCells = lines[0].split('|').slice(1, -1).map((c) => c.trim());
				// Skip separator row (line[1])
				// Parse data rows
				const dataRows = lines.slice(2).map((row) => row.split('|').slice(1, -1).map((c) => c.trim()));

				let tableHtml = '<table><thead><tr>';
				tableHtml += headerCells.map((h) => `<th>${this.escapeHtml(h)}</th>`).join('');
				tableHtml += '</tr></thead><tbody>';
				for (const row of dataRows) {
					tableHtml += '<tr>' + row.map((c) => `<td>${this.escapeHtml(c)}</td>`).join('') + '</tr>';
				}
				tableHtml += '</tbody></table>';

				const placeholder = `__TABLE_${tableBlocks.length}__`;
				tableBlocks.push(tableHtml);
				return placeholder;
			}
		);

		// Extract links and convert to footnote references
		// Links become superscript numbers, actual links go in footer index
		const linkIndex: Array<{ text: string; url: string }> = [];
		processed = processed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
			// Check if this URL already exists in the index
			const existingIndex = linkIndex.findIndex((l) => l.url === url);
			if (existingIndex >= 0) {
				// Reuse existing footnote number
				return `${text}__FOOTNOTE_${existingIndex + 1}__`;
			}
			// Add new link to index
			linkIndex.push({ text, url });
			return `${text}__FOOTNOTE_${linkIndex.length}__`;
		});

		// Now escape HTML and process markdown
		processed = this.escapeHtml(processed)
			// Headers (## before # to prevent double-matching)
			.replace(/^### (.+)$/gm, '<h4>$1</h4>')
			.replace(/^## (.+)$/gm, '<h3>$1</h3>')
			.replace(/^# (.+)$/gm, '<h2>$1</h2>')
			// Bold (must come before italic to handle ** before *)
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			// Italic (single * only - underscore conflicts with __FOOTNOTE__ placeholders)
			.replace(/\*([^*]+?)\*/g, '<em>$1</em>')
			// Lists - wrap consecutive li items in ul
			.replace(/^- (.+)$/gm, '<li>$1</li>')
			// Paragraphs
			.replace(/\n\n+/g, '</p><p>')
			.replace(/\n/g, '<br>');

		// Convert footnote placeholders to superscript numbers
		processed = processed.replace(/__FOOTNOTE_(\d+)__/g, (_, num) => {
			return `<sup class="footnote-ref">${num}</sup>`;
		});

		// Restore tables
		for (let i = 0; i < tableBlocks.length; i++) {
			processed = processed.replace(`__TABLE_${i}__`, tableBlocks[i]);
		}

		// Wrap consecutive <li> in <ul>
		processed = processed.replace(/(<li>.*?<\/li>(?:<br>)?)+/g, (match) => {
			const items = match.replace(/<br>/g, '');
			return '<ul>' + items + '</ul>';
		});

		// Wrap in paragraph if not already structured
		if (processed && !processed.startsWith('<')) {
			processed = '<p>' + processed + '</p>';
		}

		// Clean up empty paragraphs and stray br
		processed = processed
			.replace(/<p><\/p>/g, '')
			.replace(/<p><br>/g, '<p>')
			.replace(/<br><\/p>/g, '</p>')
			.replace(/<p>(\s*<(?:h[1-4]|ul|table))/g, '$1')
			.replace(/(<\/(?:h[1-4]|ul|table)>)\s*<\/p>/g, '$1');

		return { html: processed, links: linkIndex };
	}

	escapeHtml(str: string): string {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
}

/** Singleton instance for convenience */
export const tikaMarkdownParser = new TikaMarkdownParser();
