/**
 * VTG Search
 *
 * Full-text search across VTG domain data: patterns, shapes,
 * categories, glossary terms, and contributors.
 */

import type { VTGPattern } from "../data/patterns.js";
import type { VTGCategory } from "../data/categories.js";
import type { MinimalBeatShape } from "../data/shapes.js";
import type { FlowArtsGlossaryEntry } from "@flow-arts/core";
import { VTG_PATTERNS } from "../data/patterns.js";
import { VTG_CATEGORIES } from "../data/categories.js";
import { VTG_SHAPES } from "../data/shapes.js";
import { VTG_GLOSSARY } from "../data/glossary.js";
import { VTG_CONTRIBUTORS } from "../data/contributors.js";

export type VTGSearchResultType = "pattern" | "category" | "shape" | "glossary" | "contributor";

export interface VTGSearchResult {
	/** What kind of result this is */
	type: VTGSearchResultType;
	/** Matched item ID */
	id: string;
	/** Display name */
	name: string;
	/** Short description or definition */
	summary: string;
	/** The underlying data object */
	data: VTGPattern | VTGCategory | MinimalBeatShape | FlowArtsGlossaryEntry | ContributorResult;
	/** Higher score = more relevant. Exact name match > partial name > description match. */
	score: number;
}

/** Minimal contributor shape for search results (contributors don't have an id field) */
interface ContributorResult {
	name: string;
	role: string;
	contributions: string[];
}

/**
 * Returns 0 for no match, higher values for better matches.
 *
 * Scoring tiers:
 *   100 — exact match (full string equals query)
 *    80 — exact word match (query is a whole word in the string)
 *    50 — starts-with match
 *    20 — substring match
 */
function scoreMatch(candidate: string, queryLower: string): number {
	const lower = candidate.toLowerCase();
	if (lower === queryLower) return 100;
	// Whole-word boundary match
	const wordPattern = new RegExp(`\\b${escapeRegex(queryLower)}\\b`);
	if (wordPattern.test(lower)) return 80;
	if (lower.startsWith(queryLower)) return 50;
	if (lower.includes(queryLower)) return 20;
	return 0;
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bestScore(candidates: string[], queryLower: string): number {
	let best = 0;
	for (const c of candidates) {
		const s = scoreMatch(c, queryLower);
		if (s > best) best = s;
	}
	return best;
}

export function searchVTG(query: string): VTGSearchResult[] {
	if (!query || !query.trim()) return [];

	const q = query.trim().toLowerCase();
	const results: VTGSearchResult[] = [];

	// Search glossary terms — term name, aliases, definition
	for (const entry of VTG_GLOSSARY) {
		const nameFields = [entry.term, ...(entry.aliases ?? [])];
		const nameScore = bestScore(nameFields, q);
		const defScore = scoreMatch(entry.definition, q) * 0.5; // description matches worth half
		const score = Math.max(nameScore, defScore);
		if (score > 0) {
			results.push({
				type: "glossary",
				id: entry.term,
				name: entry.term,
				summary: entry.definition,
				data: entry,
				score,
			});
		}
	}

	// Search categories — name, abbreviation, description
	for (const cat of VTG_CATEGORIES) {
		const nameFields = [cat.name, cat.abbreviation, cat.id];
		const nameScore = bestScore(nameFields, q);
		const descScore = scoreMatch(cat.description, q) * 0.5;
		const score = Math.max(nameScore, descScore);
		if (score > 0) {
			results.push({
				type: "category",
				id: cat.id,
				name: cat.name,
				summary: cat.description,
				data: cat,
				score,
			});
		}
	}

	// Search shapes — name, aliases, description
	for (const shape of VTG_SHAPES) {
		const nameFields = [shape.name, shape.id, ...(shape.aliases ?? [])];
		const nameScore = bestScore(nameFields, q);
		const descScore = scoreMatch(shape.description, q) * 0.5;
		const score = Math.max(nameScore, descScore);
		if (score > 0) {
			results.push({
				type: "shape",
				id: shape.id,
				name: shape.name,
				summary: shape.description,
				data: shape,
				score,
			});
		}
	}

	// Search patterns — name, aliases, description
	for (const pattern of VTG_PATTERNS) {
		const nameFields = [pattern.name, pattern.id, ...(pattern.aliases ?? [])];
		const nameScore = bestScore(nameFields, q);
		const descScore = scoreMatch(pattern.description, q) * 0.5;
		const score = Math.max(nameScore, descScore);
		if (score > 0) {
			results.push({
				type: "pattern",
				id: pattern.id,
				name: pattern.name,
				summary: pattern.description,
				data: pattern,
				score,
			});
		}
	}

	// Search contributors — name, aliases, role, contributions
	for (const contrib of VTG_CONTRIBUTORS) {
		const nameFields = [contrib.name, ...(contrib.aliases ?? [])];
		const nameScore = bestScore(nameFields, q);
		const roleScore = scoreMatch(contrib.role, q) * 0.7;
		const contribScore = bestScore(contrib.contributions, q) * 0.5;
		const score = Math.max(nameScore, roleScore, contribScore);
		if (score > 0) {
			results.push({
				type: "contributor",
				id: contrib.name.toLowerCase().replace(/\s+/g, "-"),
				name: contrib.name,
				summary: contrib.role,
				data: { name: contrib.name, role: contrib.role, contributions: contrib.contributions },
				score,
			});
		}
	}

	// Sort by score descending, then alphabetically by name for ties
	results.sort((a, b) => {
		if (b.score !== a.score) return b.score - a.score;
		return a.name.localeCompare(b.name);
	});

	return results;
}
