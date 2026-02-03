/**
 * MorphChip Types
 *
 * TypeScript interfaces for the morphing chip primitive components.
 */

import type { Snippet } from "svelte";

/**
 * Option for a MorphChip's selectable values
 */
export interface MorphChipOption<T = string> {
	value: T;
	label: string;
}

/**
 * Props for MorphChipGroup container
 */
export interface MorphChipGroupProps {
	/** Which chip is currently expanded (bindable) */
	expandedId?: string | null;
	/** Gap between chips in pixels (default: 8) */
	gap?: number;
	/** Height when a chip is expanded in pixels (default: 108) */
	expandedHeight?: number;
	/** Spring animation configuration */
	springConfig?: { stiffness: number; damping: number };
	/** Child content (MorphChip components) */
	children: Snippet;
	/** Callback when expansion state changes (useful for parent layout coordination) */
	onExpandedChange?: (expandedId: string | null) => void;
}

/**
 * Props for individual MorphChip
 */
export interface MorphChipProps<T = string> {
	/** Unique identifier for this chip */
	id: string;
	/** Label shown in collapsed state */
	label: string;
	/** Label shown in expanded state (defaults to label) */
	expandedLabel?: string;
	/** Current selected value (bindable) */
	value: T;
	/** Available options to select from (ignored if expandedContent is provided) */
	options: MorphChipOption<T>[];
	/** Callback when value changes */
	onchange?: (value: T) => void;
	/** Milliseconds before auto-collapse after selection (default: 150) */
	collapseDelay?: number;
	/** Custom expanded content (replaces default options-row) */
	expandedContent?: Snippet<[{
		collapse: () => void;
		morphProgress: number;
	}]>;
	/** Display value override (for custom chips that don't derive from options) */
	displayValue?: string;
	/** Override expanded height for this specific chip (falls back to group default) */
	expandedHeight?: number;
}

/**
 * Context provided by MorphChipGroup to child MorphChips
 */
export interface MorphChipContext {
	/** Currently expanded chip ID (null if none) */
	readonly expandedId: string | null;
	/** Spring-driven morph progress (0 = collapsed, 1 = expanded) */
	readonly morphProgress: number;
	/** Total number of chips registered */
	readonly chipCount: number;
	/** Gap between chips in pixels */
	readonly gap: number;
	/** Height when expanded */
	readonly expandedHeight: number;
	/** Container element for measurement */
	readonly containerEl: HTMLElement | null;
	/** Expand a chip by ID */
	expand: (id: string) => void;
	/** Collapse the currently expanded chip */
	collapse: () => void;
	/** Register a chip (with optional per-chip expanded height), returns its index */
	registerChip: (id: string, expandedHeight?: number) => number;
	/** Unregister a chip */
	unregisterChip: (id: string) => void;
	/** Register a resize callback (returns unregister function) */
	onResize: (callback: () => void) => () => void;
}
