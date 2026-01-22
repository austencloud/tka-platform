import type { ContentModerationResult } from '../../domain/models/content-moderation-models';

/**
 * Content Moderator Interface
 *
 * Deterministic profanity/slur detection for public content.
 * Does NOT restrict private content - only gates public visibility.
 */
export interface IContentModerator {
	/**
	 * Check a single word for prohibited content.
	 * Used when a user creates/saves a single sequence.
	 *
	 * @param word - The sequence word to check (e.g., "FUCK", "HELLO")
	 * @returns Moderation result with isAllowed flag and any flagged terms
	 */
	checkWord(word: string): ContentModerationResult;

	/**
	 * Check an act (collection of sequences) for prohibited content.
	 * Concatenates all words and checks for hidden phrases.
	 * e.g., ["FUCK", "BOBS", "MOM"] -> "FUCKBOBSMOM" is caught
	 *
	 * @param sequenceWords - Array of sequence words in the act
	 * @returns Moderation result for the combined content
	 */
	checkAct(sequenceWords: string[]): ContentModerationResult;

	/**
	 * Normalize a string for comparison against the wordlist.
	 * Exposed for testing and debugging purposes.
	 *
	 * - Converts to lowercase
	 * - Removes spaces, hyphens, underscores
	 * - Converts l33tspeak (0→o, 1→i, 3→e, etc.)
	 *
	 * @param input - Raw input string
	 * @returns Normalized string ready for matching
	 */
	normalize(input: string): string;
}
