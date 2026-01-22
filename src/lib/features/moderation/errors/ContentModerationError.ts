import type { FlaggedTerm } from '../domain/models/content-moderation-models';

/**
 * Error thrown when content is flagged by moderation
 * and cannot be published publicly.
 */
export class ContentModerationError extends Error {
	/** The terms that caused the content to be flagged */
	readonly flaggedTerms: FlaggedTerm[];

	/** The content ID that was being moderated (if applicable) */
	readonly contentId?: string;

	/** The word/content that was checked */
	readonly content: string;

	constructor(message: string, flaggedTerms: FlaggedTerm[], content: string, contentId?: string) {
		super(message);
		this.name = 'ContentModerationError';
		this.flaggedTerms = flaggedTerms;
		this.content = content;
		this.contentId = contentId;

		// Maintains proper stack trace for where error was thrown (V8 only)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ContentModerationError);
		}
	}

	/**
	 * Get a user-friendly message describing why content was flagged
	 */
	getUserMessage(): string {
		if (this.flaggedTerms.length === 0) {
			return 'This content cannot be shared publicly.';
		}

		const categories = [...new Set(this.flaggedTerms.map((t) => t.category))];
		const categoryLabels: Record<string, string> = {
			profanity: 'inappropriate language',
			slur: 'offensive terms',
			hate: 'hate speech',
			sexual: 'explicit content'
		};

		const labels = categories.map((c) => categoryLabels[c] || c);

		if (labels.length === 1) {
			return `This content contains ${labels[0]} and cannot be shared publicly.`;
		}

		return `This content contains ${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}, and cannot be shared publicly.`;
	}
}
