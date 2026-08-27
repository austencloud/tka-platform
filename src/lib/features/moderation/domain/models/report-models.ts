/**
 * User Report Domain Models
 *
 * Defines types, interfaces, and display configurations for the user reporting system.
 */

// Core Types

export type ReportCategory =
	| 'harassment'
	| 'spam'
	| 'inappropriate_content'
	| 'impersonation'
	| 'other';

export type ReportStatus = 'new' | 'reviewing' | 'resolved';

export type ReportResolution =
	| 'dismissed'
	| 'warning_issued'
	| 'account_disabled'
	| 'content_removed'
	| 'escalated';

// Interfaces

export interface UserReport {
	id: string;
	createdAt: Date;

	// Reporter info
	reporterId: string;
	reporterDisplayName: string;
	// NOTE: reporterEmail removed for privacy - not stored in public user docs

	// Reported user info
	reportedUserId: string;
	reportedUserDisplayName: string;
	// NOTE: reportedUserEmail removed for privacy - not stored in public user docs

	// Report content
	category: ReportCategory;
	description: string;
	evidenceUrls?: string[];

	// Admin fields
	status: ReportStatus;
	resolution?: ReportResolution;
	adminNotes?: string;
	resolvedAt?: Date;
	resolvedBy?: string;
}

export interface CreateReportInput {
	reportedUserId: string;
	reportedUserDisplayName: string;
	// NOTE: reportedUserEmail removed for privacy
	category: ReportCategory;
	description: string;
	evidenceUrls?: string[];
}

export interface ResolveReportInput {
	reportId: string;
	resolution: ReportResolution;
	adminNotes?: string;
}

export interface ReportFilters {
	status?: ReportStatus;
	category?: ReportCategory;
	reportedUserId?: string;
	reporterId?: string;
}

export interface PaginatedReportsResult {
	reports: UserReport[];
	hasMore: boolean;
	lastDoc: unknown; // Firestore DocumentSnapshot for cursor pagination
}

// Display Configuration

export interface CategoryConfig {
	label: string;
	description: string;
	icon: string;
}

export const REPORT_CATEGORIES: Record<ReportCategory, CategoryConfig> = {
	harassment: {
		label: 'Harassment',
		description: 'Bullying, threats, or targeted abuse',
		icon: 'fa-user-slash'
	},
	spam: {
		label: 'Spam',
		description: 'Promotional content or bot accounts',
		icon: 'fa-robot'
	},
	inappropriate_content: {
		label: 'Inappropriate Content',
		description: 'Offensive sequences or profile content',
		icon: 'fa-ban'
	},
	impersonation: {
		label: 'Impersonation',
		description: 'Pretending to be someone else',
		icon: 'fa-mask'
	},
	other: {
		label: 'Other',
		description: 'General violations not listed above',
		icon: 'fa-flag'
	}
};

export interface StatusConfig {
	label: string;
	color: string;
	icon: string;
}

export const REPORT_STATUSES: Record<ReportStatus, StatusConfig> = {
	new: {
		label: 'New',
		color: 'var(--semantic-warning, #f59e0b)',
		icon: 'fa-circle-exclamation'
	},
	reviewing: {
		label: 'Reviewing',
		color: 'var(--semantic-info, #3b82f6)',
		icon: 'fa-magnifying-glass'
	},
	resolved: {
		label: 'Resolved',
		color: 'var(--semantic-success, #22c55e)',
		icon: 'fa-check-circle'
	}
};

export interface ResolutionConfig {
	label: string;
	description: string;
	severity: 'low' | 'medium' | 'high';
	icon: string;
}

export const REPORT_RESOLUTIONS: Record<ReportResolution, ResolutionConfig> = {
	dismissed: {
		label: 'Dismissed',
		description: 'No violation found',
		severity: 'low',
		icon: 'fa-xmark'
	},
	warning_issued: {
		label: 'Issue Warning',
		description: 'Send a warning to this user',
		severity: 'medium',
		icon: 'fa-triangle-exclamation'
	},
	account_disabled: {
		label: 'Account Disabled',
		description: 'User account has been disabled',
		severity: 'high',
		icon: 'fa-user-lock'
	},
	content_removed: {
		label: 'Content Removed',
		description: 'Specific content was removed',
		severity: 'medium',
		icon: 'fa-trash'
	},
	escalated: {
		label: 'Escalated',
		description: 'Needs further review',
		severity: 'medium',
		icon: 'fa-arrow-up'
	}
};

// Utility Functions

export function getCategoryConfig(category: ReportCategory): CategoryConfig {
	return REPORT_CATEGORIES[category];
}

export function getStatusConfig(status: ReportStatus): StatusConfig {
	return REPORT_STATUSES[status];
}

export function getResolutionConfig(resolution: ReportResolution): ResolutionConfig {
	return REPORT_RESOLUTIONS[resolution];
}

export function formatReportDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	}).format(date);
}
