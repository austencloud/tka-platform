/**
 * Profanity Wordlist
 *
 * Curated list of terms that should not appear in publicly visible content.
 * This is used for deterministic matching - no LLM involved.
 *
 * Categories:
 * - profanity: Common swear words
 * - slur: Racial, ethnic, gender, sexuality slurs
 * - hate: Hate speech terms
 * - sexual: Explicit sexual terms
 *
 * Note: Names are allowed. Body parts with anatomical use are allowed.
 * This list is intentionally conservative to avoid false positives.
 */

import type { FlaggedCategory } from '../domain/models/content-moderation-models';

/** Exact match terms organized by category */
export const EXACT_MATCH_TERMS: Record<FlaggedCategory, Set<string>> = {
	profanity: new Set([
		'fuck',
		'shit',
		'bitch',
		'ass',
		'asshole',
		'bastard',
		'damn',
		'crap',
		'piss',
		'dick',
		'cock',
		'cunt',
		'twat',
		'prick',
		'wanker',
		'bollocks',
		'bugger',
		'arse',
		'arsehole',
		'shithead',
		'dickhead',
		'fuckhead',
		'motherfucker',
		'fucker',
		'bullshit',
		'horseshit',
		'jackass',
		'dumbass',
		'fatass',
		'smartass',
		'douchebag',
		'douche'
	]),

	slur: new Set([
		// Racial slurs
		'nigger',
		'nigga',
		'negro',
		'coon',
		'darkie',
		'spic',
		'wetback',
		'beaner',
		'chink',
		'gook',
		'slope',
		'zipperhead',
		'jap',
		'kraut',
		'polack',
		'kike',
		'heeb',
		'hymie',
		'wop',
		'dago',
		'guido',
		'gringo',
		'honky',
		'cracker',
		'whitey',
		'redskin',
		'injun',
		'squaw',
		'raghead',
		'towelhead',
		'sandnigger',
		'camel jockey',
		'paki',
		// Gender/sexuality slurs
		'fag',
		'faggot',
		'dyke',
		'lesbo',
		'homo',
		'queer', // context-dependent but blocked for safety
		'tranny',
		'shemale',
		'ladyboy',
		'sissy',
		// Disability slurs
		'retard',
		'retarded',
		'spaz',
		'spastic',
		'cripple',
		'tard',
		'mongoloid'
	]),

	hate: new Set([
		'nazi',
		'hitler',
		'heil',
		'genocide',
		'holocaust', // context-dependent
		'ethnic cleansing',
		'white power',
		'white pride',
		'aryan',
		'kkk',
		'lynch'
	]),

	sexual: new Set([
		'porn',
		'porno',
		'pornography',
		'xxx',
		'cum',
		'cumshot',
		'jizz',
		'semen',
		'blowjob',
		'handjob',
		'rimjob',
		'bartjob',
		'titjob',
		'bukake',
		'gangbang',
		'orgy',
		'threesome',
		'foursome',
		'dildo',
		'vibrator',
		'fleshlight',
		'masturbate',
		'masturbation',
		'fap',
		'fapping',
		'boner',
		'erection',
		'orgasm',
		'climax',
		'ejaculate',
		'ejaculation',
		'pussy',
		'vagina', // anatomical but blocked in this context
		'penis', // anatomical but blocked in this context
		'tits',
		'titties',
		'boobs',
		'boobies',
		'milf',
		'gilf',
		'dilf',
		'anal',
		'anus',
		'butthole',
		'hentai',
		'ecchi',
		'ahegao',
		'creampie',
		'facial',
		'deepthroat',
		'throatfuck',
		'assfuck',
		'doggystyle',
		'missionary',
		'cowgirl',
		'reverse cowgirl',
		'sixty nine',
		'sixtynine',
		'bdsm',
		'bondage',
		'dominatrix',
		'fetish',
		'kinky',
		'slut',
		'whore',
		'hoe',
		'skank',
		'prostitute',
		'hooker',
		'escort',
		'stripper',
		'nude',
		'naked',
		'nudity',
		'nsfw',
		'horny',
		'horney'
	])
};

/**
 * L33tspeak character mappings for normalization
 * Applied before checking against wordlist
 */
export const LEET_MAPPINGS: Record<string, string> = {
	'0': 'o',
	'1': 'i',
	'3': 'e',
	'4': 'a',
	'5': 's',
	'7': 't',
	'8': 'b',
	'@': 'a',
	$: 's',
	'!': 'i',
	'(': 'c',
	'<': 'c',
	'+': 't',
	'|': 'i',
	'\\': 'l',
	'/': 'l'
};

/**
 * Regex patterns for catching variations that exact matching might miss.
 * These run after l33tspeak normalization.
 * Pattern format: [regex, category, matchedPattern]
 */
export const VARIATION_PATTERNS: Array<[RegExp, FlaggedCategory, string]> = [
	// F-word variations (fu*k, f**k, fu-ck, etc.)
	[/f+[u*]+[c(<]+k+/i, 'profanity', 'fuck'],
	[/f+[u*]+k+/i, 'profanity', 'fuck'], // without the c
	[/ph+[u*]+[c(<]+k+/i, 'profanity', 'fuck'], // ph = f

	// S-word variations
	[/sh+[i1!]+t+/i, 'profanity', 'shit'],
	[/5h+[i1!]+t+/i, 'profanity', 'shit'],

	// B-word variations
	[/b+[i1!]+t+ch+/i, 'profanity', 'bitch'],
	[/b+[i1!]+a+t+ch+/i, 'profanity', 'bitch'],

	// A-word variations
	[/a+[s5]+h+o+l+e+/i, 'profanity', 'asshole'],
	[/a+[s5]+[s5]+/i, 'profanity', 'ass'],

	// N-word variations (critical to catch)
	[/n+[i1!]+g+[ae]+r*/i, 'slur', 'nigger'],
	[/n+[i1!]+g+g+[ae]*/i, 'slur', 'nigga'],

	// C-word variations
	[/c+[u*]+n+t+/i, 'profanity', 'cunt'],

	// D-word variations
	[/d+[i1!]+[c(<]+k+/i, 'profanity', 'dick'],

	// Repeated letters (fuuuuck, shiiiit)
	[/f{2,}u+c*k+/i, 'profanity', 'fuck'],
	[/s{2,}h+i+t+/i, 'profanity', 'shit'],

	// Common compound variations
	[/mother\s*f+[u*]+[c(<]*k*/i, 'profanity', 'motherfucker'],
	[/bull\s*sh+[i1!]+t+/i, 'profanity', 'bullshit']
];

/**
 * Get all exact match terms as a single set (for quick O(1) lookup)
 */
export function getAllExactTerms(): Set<string> {
	const all = new Set<string>();
	for (const category of Object.values(EXACT_MATCH_TERMS)) {
		for (const term of category) {
			all.add(term);
		}
	}
	return all;
}

/**
 * Find which category a term belongs to
 */
export function getCategoryForTerm(normalizedTerm: string): FlaggedCategory | null {
	for (const [category, terms] of Object.entries(EXACT_MATCH_TERMS) as Array<
		[FlaggedCategory, Set<string>]
	>) {
		if (terms.has(normalizedTerm)) {
			return category;
		}
	}
	return null;
}
