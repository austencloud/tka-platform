/**
 * Content Moderation Models
 *
 * Types for the deterministic profanity/slur detection system that gates
 * public visibility only. Private content remains unrestricted.
 */

/** Categories of flagged content */
export type FlaggedCategory = 'profanity' | 'slur' | 'hate' | 'sexual';

/** A term that was flagged during moderation */
export interface FlaggedTerm {
	/** The original term as it appeared in the content */
	term: string;
	/** The normalized form that matched the wordlist */
	matchedPattern: string;
	/** Category of the violation */
	category: FlaggedCategory;
}

/** Result of a content moderation check */
export interface ContentModerationResult {
	/** Whether the content is allowed for public visibility */
	isAllowed: boolean;
	/** List of terms that were flagged (empty if allowed) */
	flaggedTerms: FlaggedTerm[];
	/** The normalized form of the content that was checked */
	normalizedContent: string;
}

/** Status of a content appeal */
export type AppealStatus = 'pending' | 'approved' | 'denied';

/** Type of content being appealed */
export type AppealContentType = 'sequence' | 'act';

/** An appeal submitted by a user for flagged content */
export interface ContentAppeal {
	/** Unique identifier for the appeal */
	id: string;
	/** Type of content being appealed */
	contentType: AppealContentType;
	/** ID of the content (sequence or act) */
	contentId: string;
	/** User ID of the content owner */
	ownerId: string;
	/** The word/content that was flagged */
	word: string;
	/** The specific terms that triggered the flag */
	flaggedTerms: FlaggedTerm[];
	/** User's reason for appeal */
	appealReason: string;
	/** Current status of the appeal */
	status: AppealStatus;
	/** When the appeal was submitted */
	createdAt: Date;
	/** When the appeal was resolved (if resolved) */
	resolvedAt?: Date;
	/** Admin who resolved the appeal */
	resolvedBy?: string;
	/** Admin notes about the resolution */
	adminNotes?: string;
}

/** Data for creating a new appeal */
export interface CreateAppealData {
	contentType: AppealContentType;
	contentId: string;
	word: string;
	flaggedTerms: FlaggedTerm[];
	appealReason: string;
}

/** Data for resolving an appeal (admin only) */
export interface ResolveAppealData {
	status: 'approved' | 'denied';
	adminNotes?: string;
}
