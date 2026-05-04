import type {
	ContentModerationResult,
	FlaggedTerm
} from '../domain/models/content-moderation-models';
import {
	EXACT_MATCH_TERMS,
	LEET_MAPPINGS,
	VARIATION_PATTERNS,
	getAllExactTerms
} from '../data/profanity-wordlist';

const exactTerms: Set<string> = getAllExactTerms();

/**
 * Normalize input by lowercasing, stripping separators, and applying l33tspeak conversions.
 */
export function normalize(input: string): string {
	let result = input.toLowerCase();

	// Remove common separators
	result = result.replace(/[\s\-_\.]/g, '');

	// Apply l33tspeak conversions
	for (const [leet, normal] of Object.entries(LEET_MAPPINGS)) {
		// Escape special regex characters
		const escaped = leet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		result = result.replace(new RegExp(escaped, 'g'), normal);
	}

	return result;
}

/**
 * Try to extract the original term from the input that matched.
 * Falls back to the normalized pattern if not found.
 */
function extractOriginalTerm(original: string, normalizedMatch: string): string {
	// Simple case-insensitive search for the term
	const index = normalize(original).indexOf(normalizedMatch);

	if (index !== -1) {
		// Try to extract approximately the same length from original
		// This is imperfect due to l33tspeak, but gives a reasonable result
		const approxLength = normalizedMatch.length;
		return original.substring(index, Math.min(index + approxLength + 2, original.length));
	}

	return normalizedMatch;
}

/**
 * Find all violations in the content.
 */
function findViolations(original: string, normalized: string): FlaggedTerm[] {
	const flagged: FlaggedTerm[] = [];
	const seenPatterns = new Set<string>();

	// Check for exact matches - look for terms as substrings
	for (const [category, terms] of Object.entries(EXACT_MATCH_TERMS) as Array<
		[keyof typeof EXACT_MATCH_TERMS, Set<string>]
	>) {
		for (const term of terms) {
			if (normalized.includes(term) && !seenPatterns.has(term)) {
				seenPatterns.add(term);
				flagged.push({
					term: extractOriginalTerm(original, term),
					matchedPattern: term,
					category
				});
			}
		}
	}

	// Check regex patterns for variations
	for (const [pattern, category, matchedPattern] of VARIATION_PATTERNS) {
		if (!seenPatterns.has(matchedPattern) && pattern.test(normalized)) {
			seenPatterns.add(matchedPattern);
			const match = normalized.match(pattern);
			flagged.push({
				term: match ? extractOriginalTerm(original, match[0]) : matchedPattern,
				matchedPattern,
				category
			});
		}
	}

	return flagged;
}

/**
 * Check a single word for moderation violations.
 */
export function checkWord(word: string): ContentModerationResult {
	const normalizedWord = normalize(word);
	const flaggedTerms = findViolations(word, normalizedWord);

	return {
		isAllowed: flaggedTerms.length === 0,
		flaggedTerms,
		normalizedContent: normalizedWord
	};
}

/**
 * Check an act (list of sequence words) for moderation violations,
 * including hidden phrases from concatenation.
 */
export function checkAct(sequenceWords: string[]): ContentModerationResult {
	// Concatenate all words for hidden phrase detection
	const concatenated = sequenceWords.join('');
	const normalizedConcat = normalize(concatenated);
	const flaggedTerms = findViolations(concatenated, normalizedConcat);

	return {
		isAllowed: flaggedTerms.length === 0,
		flaggedTerms,
		normalizedContent: normalizedConcat
	};
}
