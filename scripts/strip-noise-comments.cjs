#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');
const VERBOSE = process.argv.includes('--verbose');

if (!DRY_RUN && !APPLY) {
	console.error('Usage: node scripts/strip-noise-comments.cjs [--dry-run | --apply] [--verbose]');
	process.exit(1);
}

const FILLER_WORDS = new Set([
	'the', 'a', 'an', 'for', 'and', 'with', 'from', 'that', 'this',
	'to', 'of', 'in', 'on', 'by', 'is', 'or', 'all', 'its', 'set',
	'get', 'if', 'it', 'be', 'as', 'are', 'was', 'has', 'had', 'not',
	'will', 'can', 'do', 'does', 'did', 'been', 'being', 'have', 'no',
	'so', 'at', 'up', 'we', 'our', 'but', 'new', 'any',
]);

const stats = {
	filesProcessed: 0,
	filesModified: 0,
	sectionDividersRemoved: 0,
	emptyJsdocLinesRemoved: 0,
	restatingJsdocBlocksRemoved: 0,
	restatingClassJsdocRemoved: 0,
	borderlineJsdocTrimmed: 0,
	paramTagsRemoved: 0,
	totalLinesRemoved: 0,
};

function splitCamelCase(name) {
	return name
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
		.toLowerCase()
		.split(/[\s_]+/)
		.filter(w => w.length > 1 && !FILLER_WORDS.has(w));
}

function extractCommentWords(text) {
	return text
		.replace(/[^a-zA-Z\s]/g, ' ')
		.toLowerCase()
		.split(/\s+/)
		.filter(w => w.length > 1 && !FILLER_WORDS.has(w));
}

function wordOverlap(commentWords, nameWords) {
	if (nameWords.length === 0) return 0;
	const nameSet = new Set(nameWords);
	const matches = commentWords.filter(w => nameSet.has(w));
	return matches.length / nameWords.length;
}

const DIVIDER_RE = /^\s*\/\/\s*[=\-*]{4,}\s*$/;
const COMMENT_LINE_RE = /^\s*\/\//;
const JSDOC_OPEN = /^\s*\/\*\*/;
const JSDOC_CLOSE = /\*\/\s*$/;
const JSDOC_SINGLE = /^\s*\/\*\*\s*(.*?)\s*\*\/\s*$/;
const BARE_ASTERISK = /^\s*\*\s*$/;
const PARAM_TAG_RE = /^\s*\*\s*@param\s+\{?[^}]*\}?\s*(\w+)\s+(.*)/;
const PARAM_TAG_SIMPLE_RE = /^\s*\*\s*@param\s+(\w+)\s+(.*)/;
const METHOD_DECL_RE = /^\s*(?:export\s+)?(?:async\s+)?(?:static\s+)?(?:private\s+|protected\s+|public\s+|readonly\s+)*(?:function\s+)?(\w+)\s*[\(<(]/;
const CLASS_DECL_RE = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/;
const AT_TAG_RE = /^\s*\*\s*@/;

function processFile(filePath) {
	const original = fs.readFileSync(filePath, 'utf8');
	const lines = original.split('\n');
	const removals = [];
	const modifications = new Map();

	// Pass 1: Section dividers
	for (let i = 0; i < lines.length; i++) {
		if (DIVIDER_RE.test(lines[i])) {
			removals.push(i);
			stats.sectionDividersRemoved++;
			// Check if next line is a comment title (between two dividers or standalone)
			if (i + 1 < lines.length && COMMENT_LINE_RE.test(lines[i + 1]) && !DIVIDER_RE.test(lines[i + 1])) {
				// Check if there's a closing divider after the title
				if (i + 2 < lines.length && DIVIDER_RE.test(lines[i + 2])) {
					removals.push(i + 1);
					removals.push(i + 2);
					stats.sectionDividersRemoved += 2;
					i += 2;
				}
			}
		}
	}

	// Pass 2: JSDoc blocks
	let i = 0;
	while (i < lines.length) {
		if (removals.includes(i)) { i++; continue; }

		// Single-line JSDoc: /** text */
		const singleMatch = lines[i].match(JSDOC_SINGLE);
		if (singleMatch) {
			const commentText = singleMatch[1].replace(/^\s*\*?\s*/, '').replace(/\s*\*?\s*$/, '');
			// Find next non-empty, non-removed line
			let nextIdx = i + 1;
			while (nextIdx < lines.length && (removals.includes(nextIdx) || lines[nextIdx].trim() === '')) nextIdx++;

			if (nextIdx < lines.length) {
				const methodMatch = lines[nextIdx].match(METHOD_DECL_RE);
				const classMatch = lines[nextIdx].match(CLASS_DECL_RE);

				if (methodMatch || classMatch) {
					const name = (methodMatch || classMatch)[1];
					const nameWords = splitCamelCase(name);
					const commentWords = extractCommentWords(commentText);
					const overlap = wordOverlap(commentWords, nameWords);

					if (overlap >= 0.5 && commentText.length < 100) {
						removals.push(i);
						if (methodMatch) stats.restatingJsdocBlocksRemoved++;
						if (classMatch) stats.restatingClassJsdocRemoved++;
					}
				}

				// Class JSDoc with "Implementation" or "Service" pattern
				if (classMatch) {
					const name = classMatch[1];
					const lower = commentText.toLowerCase();
					const nameWords = splitCamelCase(name);
					if ((lower.includes('implementation') || lower.includes('service')) &&
						nameWords.some(w => lower.includes(w))) {
						if (!removals.includes(i)) {
							removals.push(i);
							stats.restatingClassJsdocRemoved++;
						}
					}
				}
			}
			i++;
			continue;
		}

		// Multi-line JSDoc: /** ... */
		if (JSDOC_OPEN.test(lines[i])) {
			const blockStart = i;
			let blockEnd = i;
			while (blockEnd < lines.length && !JSDOC_CLOSE.test(lines[blockEnd])) blockEnd++;
			if (blockEnd >= lines.length) { i++; continue; }

			const blockLines = [];
			for (let j = blockStart; j <= blockEnd; j++) blockLines.push(lines[j]);

			// Extract descriptive lines (non-@tag, non-open/close, non-empty)
			const descLines = [];
			const tagLines = [];
			const emptyLines = [];

			for (let j = 1; j < blockLines.length - 1; j++) {
				const line = blockLines[j];
				if (BARE_ASTERISK.test(line)) {
					emptyLines.push(blockStart + j);
				} else if (AT_TAG_RE.test(line)) {
					tagLines.push({ idx: blockStart + j, text: line });
				} else {
					descLines.push({ idx: blockStart + j, text: line.replace(/^\s*\*\s*/, '').trim() });
				}
			}

			// Strip empty JSDoc filler lines at end of block (before closing */)
			// Also strip trailing empty lines before @tags
			for (const emptyIdx of emptyLines) {
				// Keep empty lines that separate distinct paragraphs (between two desc lines)
				const prevHasContent = descLines.some(d => d.idx < emptyIdx);
				const nextHasContent = descLines.some(d => d.idx > emptyIdx);
				if (!(prevHasContent && nextHasContent)) {
					removals.push(emptyIdx);
					stats.emptyJsdocLinesRemoved++;
				}
			}

			// Single descriptive line + no tags = check for restating
			if (descLines.length === 1 && tagLines.length === 0) {
				const commentText = descLines[0].text;
				let nextIdx = blockEnd + 1;
				while (nextIdx < lines.length && (removals.includes(nextIdx) || lines[nextIdx].trim() === '')) nextIdx++;

				if (nextIdx < lines.length) {
					const methodMatch = lines[nextIdx].match(METHOD_DECL_RE);
					const classMatch = lines[nextIdx].match(CLASS_DECL_RE);

					if (methodMatch || classMatch) {
						const name = (methodMatch || classMatch)[1];
						const nameWords = splitCamelCase(name);
						const commentWords = extractCommentWords(commentText);
						const overlap = wordOverlap(commentWords, nameWords);

						if (overlap >= 0.5 && commentText.length < 100) {
							for (let j = blockStart; j <= blockEnd; j++) removals.push(j);
							if (methodMatch) stats.restatingJsdocBlocksRemoved++;
							if (classMatch) stats.restatingClassJsdocRemoved++;
						}
					}

					if (classMatch) {
						const name = classMatch[1];
						const lower = commentText.toLowerCase();
						const nameWords = splitCamelCase(name);
						if ((lower.includes('implementation') || lower.includes('service')) &&
							nameWords.some(w => lower.includes(w))) {
							const alreadyRemoved = removals.includes(blockStart);
							if (!alreadyRemoved) {
								for (let j = blockStart; j <= blockEnd; j++) removals.push(j);
								stats.restatingClassJsdocRemoved++;
							}
						}
					}
				}
			}

			// Multiple descriptive lines: check if first line restates, others add value
			if (descLines.length > 1 && tagLines.length === 0) {
				let nextIdx = blockEnd + 1;
				while (nextIdx < lines.length && (removals.includes(nextIdx) || lines[nextIdx].trim() === '')) nextIdx++;

				if (nextIdx < lines.length) {
					const methodMatch = lines[nextIdx].match(METHOD_DECL_RE);
					if (methodMatch) {
						const name = methodMatch[1];
						const nameWords = splitCamelCase(name);
						const firstLineWords = extractCommentWords(descLines[0].text);
						const overlap = wordOverlap(firstLineWords, nameWords);

						if (overlap >= 0.5 && descLines[0].text.length < 100) {
							removals.push(descLines[0].idx);
							stats.borderlineJsdocTrimmed++;
						}
					}
				}
			}

			// Strip obvious @param tags
			for (const tag of tagLines) {
				let match = tag.text.match(PARAM_TAG_RE) || tag.text.match(PARAM_TAG_SIMPLE_RE);
				if (match) {
					const paramName = match[1].toLowerCase();
					const desc = match[2].trim().toLowerCase();
					// "The {paramName}" or "The {paramName} to ..."
					if (desc === `the ${paramName}` ||
						desc === paramName ||
						desc.match(new RegExp(`^the\\s+${paramName}\\s+to\\s+\\w+$`)) ||
						desc.match(new RegExp(`^${paramName}\\s+to\\s+\\w+$`)) ||
						desc === `the ${paramName}.` ||
						desc === `${paramName}.`) {
						removals.push(tag.idx);
						stats.paramTagsRemoved++;
					}
				}
			}

			// If all content lines in block are removed, remove the open/close too
			const contentIndices = [...descLines.map(d => d.idx), ...tagLines.map(t => t.idx), ...emptyLines];
			if (contentIndices.length > 0 && contentIndices.every(idx => removals.includes(idx))) {
				removals.push(blockStart);
				removals.push(blockEnd);
			}

			i = blockEnd + 1;
			continue;
		}

		i++;
	}

	// Deduplicate and sort removals
	const removalSet = new Set(removals);
	const sortedRemovals = [...removalSet].sort((a, b) => a - b);

	if (sortedRemovals.length === 0) return null;

	// Apply modifications
	const newLines = [];
	for (let j = 0; j < lines.length; j++) {
		if (removalSet.has(j)) continue;
		if (modifications.has(j)) {
			newLines.push(modifications.get(j));
		} else {
			newLines.push(lines[j]);
		}
	}

	// Clean up: remove runs of 3+ blank lines down to 2
	const cleaned = [];
	let blankRun = 0;
	for (const line of newLines) {
		if (line.trim() === '') {
			blankRun++;
			if (blankRun <= 2) cleaned.push(line);
		} else {
			blankRun = 0;
			cleaned.push(line);
		}
	}

	const result = cleaned.join('\n');
	const linesRemoved = lines.length - cleaned.length;

	return { result, linesRemoved, removalCount: sortedRemovals.length };
}

function walkDir(dir, extensions) {
	const results = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist' ||
				entry.name === '.svelte-kit' || entry.name === 'build' || entry.name === '.vercel') continue;
			results.push(...walkDir(full, extensions));
		} else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
			results.push(full);
		}
	}
	return results;
}

function main() {
	const rootDir = path.resolve(__dirname, '..');
	const srcDir = path.join(rootDir, 'src');
	const packagesDir = path.join(rootDir, 'packages');
	const mcpDir = path.join(rootDir, 'mcp-server-pkg');

	const dirs = [srcDir, packagesDir, mcpDir].filter(d => fs.existsSync(d));
	const extensions = ['.ts', '.svelte', '.tsx', '.jsx'];

	let allFiles = [];
	for (const dir of dirs) {
		allFiles.push(...walkDir(dir, extensions));
	}

	console.log(`\nScanning ${allFiles.length} files...\n`);

	const modified = [];

	for (const filePath of allFiles) {
		stats.filesProcessed++;
		try {
			const result = processFile(filePath);
			if (result) {
				stats.filesModified++;
				stats.totalLinesRemoved += result.linesRemoved;
				const rel = path.relative(rootDir, filePath);
				modified.push({ path: rel, linesRemoved: result.linesRemoved });

				if (VERBOSE) {
					console.log(`  ${rel}: -${result.linesRemoved} lines`);
				}

				if (APPLY) {
					fs.writeFileSync(filePath, result.result, 'utf8');
				}
			}
		} catch (err) {
			console.error(`Error processing ${filePath}: ${err.message}`);
		}
	}

	console.log('=== Summary ===');
	console.log(`Files scanned:              ${stats.filesProcessed}`);
	console.log(`Files modified:             ${stats.filesModified}`);
	console.log(`Section dividers removed:   ${stats.sectionDividersRemoved}`);
	console.log(`Empty JSDoc lines removed:  ${stats.emptyJsdocLinesRemoved}`);
	console.log(`Restating JSDoc removed:    ${stats.restatingJsdocBlocksRemoved}`);
	console.log(`Restating class JSDoc:      ${stats.restatingClassJsdocRemoved}`);
	console.log(`Borderline JSDoc trimmed:   ${stats.borderlineJsdocTrimmed}`);
	console.log(`Param tags removed:         ${stats.paramTagsRemoved}`);
	console.log(`Total lines removed:        ${stats.totalLinesRemoved}`);
	console.log(`Mode:                       ${APPLY ? 'APPLIED' : 'DRY RUN'}`);

	if (!VERBOSE && modified.length > 0) {
		console.log(`\nTop 20 files by lines removed:`);
		modified.sort((a, b) => b.linesRemoved - a.linesRemoved);
		for (const m of modified.slice(0, 20)) {
			console.log(`  ${m.path}: -${m.linesRemoved}`);
		}
	}
}

main();
