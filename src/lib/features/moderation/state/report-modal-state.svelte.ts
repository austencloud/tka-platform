/**
 * Report Modal State
 *
 * Manages the state for the user report modal (open/close, target user, submission).
 * Uses Svelte 5 runes for reactivity.
 */

import type { ReportCategory } from '../domain/models/report-models';

interface ReportTargetUser {
	id: string;
	displayName: string;
	// NOTE: Email omitted for privacy - reports are tracked by user ID
}

interface ReportModalState {
	isOpen: boolean;
	targetUser: ReportTargetUser | null;
	selectedCategory: ReportCategory | null;
	description: string;
	isSubmitting: boolean;
	error: string | null;
	success: boolean;
}

// Reactive state using Svelte 5 $state rune
let _state = $state<ReportModalState>({
	isOpen: false,
	targetUser: null,
	selectedCategory: null,
	description: '',
	isSubmitting: false,
	error: null,
	success: false
});

/**
 * Open the report modal for a specific user.
 */
export function openReportModal(user: ReportTargetUser): void {
	_state = {
		isOpen: true,
		targetUser: user,
		selectedCategory: null,
		description: '',
		isSubmitting: false,
		error: null,
		success: false
	};
}

/**
 * Close the report modal and reset state.
 */
export function closeReportModal(): void {
	_state = {
		isOpen: false,
		targetUser: null,
		selectedCategory: null,
		description: '',
		isSubmitting: false,
		error: null,
		success: false
	};
}

export function setCategory(category: ReportCategory): void {
	_state.selectedCategory = category;
	_state.error = null;
}

export function setDescription(text: string): void {
	_state.description = text;
	_state.error = null;
}

export function setSubmitting(isSubmitting: boolean): void {
	_state.isSubmitting = isSubmitting;
}

export function setError(error: string | null): void {
	_state.error = error;
}

/**
 * Mark submission as successful.
 */
export function setSuccess(): void {
	_state.success = true;
	_state.isSubmitting = false;
}

/**
 * Validate the form before submission.
 */
export function validateForm(): boolean {
	// i18n NOTE: These messages should route through t() with dedicated keys
	// (moderation_validation_select_category / _description_required / _description_too_long),
	// but those keys must be added to messages/en.json (outside this feature's edit scope).
	// Until then, English strings are used directly to avoid showing raw key names to users.
	if (!_state.selectedCategory) {
		_state.error = 'Please select a category';
		return false;
	}

	if (_state.selectedCategory === 'other' && !_state.description.trim()) {
		_state.error = 'Please provide a description for "Other" reports';
		return false;
	}

	if (_state.description.length > 1000) {
		_state.error = 'Description must be less than 1000 characters';
		return false;
	}

	return true;
}

/**
 * Export the report modal state with reactive getters.
 */
export const reportModalState = {
	get isOpen() {
		return _state.isOpen;
	},
	get targetUser() {
		return _state.targetUser;
	},
	get selectedCategory() {
		return _state.selectedCategory;
	},
	get description() {
		return _state.description;
	},
	get isSubmitting() {
		return _state.isSubmitting;
	},
	get error() {
		return _state.error;
	},
	get success() {
		return _state.success;
	},
	get canSubmit() {
		return (
			_state.selectedCategory !== null &&
			!_state.isSubmitting &&
			(_state.selectedCategory !== 'other' || _state.description.trim().length > 0)
		);
	},

	// Actions
	open: openReportModal,
	close: closeReportModal,
	setCategory,
	setDescription,
	setSubmitting,
	setError,
	setSuccess,
	validate: validateForm
};
