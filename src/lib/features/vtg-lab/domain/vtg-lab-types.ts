/**
 * VTG Lab Domain Types
 *
 * Interfaces for the VTG Explorer - maps VTG modes to TKA letters,
 * rotation patterns, compounds, and terminology comparisons.
 */

import type { VTGMode } from "$lib/features/learn/domain/constants/vtg-experience-data";

/** Which internal tab is active in VTG Lab */
export type VtgLabTab = "explorer" | "rosetta";

/** Rotation style for a letter (how the two props spin relative to each other) */
export type RotationStyle = "pro/pro" | "anti/anti" | "hybrid";

/** A single letter entry within a VTG mode */
export interface VtgPatternEntry {
	/** The TKA letter (e.g. "A", "D", "S") */
	letter: string;
	/** Rotation style: pro/pro, anti/anti, or hybrid */
	rotationStyle: RotationStyle;
	/** Position transition (e.g. "alpha to alpha", "beta to alpha") */
	positionTransition: string;
	/** Whether this letter has position-dependent VTG classification */
	isPositionDependent: boolean;
	/** Note about position-dependent behavior, if any */
	positionNote?: string;
}

/** A group of letters sharing a rotation style within a mode */
export interface RotationGroup {
	style: RotationStyle;
	label: string;
	entries: VtgPatternEntry[];
}

/** Info about a compound letter pair */
export interface CompoundInfo {
	/** The compound name (e.g. "DJ", "MP") */
	name: string;
	/** The two component letters */
	components: [string, string];
	/** Mnemonic for the compound */
	mnemonic: string;
	/** Rotation style */
	rotationStyle: RotationStyle;
	/** Position cycle description */
	cycle: string;
}

/** A complete VTG mode with all its letters, rotation groups, and compounds */
export interface VtgModeGroup {
	/** VTG mode abbreviation */
	mode: VTGMode;
	/** Full name (e.g. "Split-Same") */
	name: string;
	/** TKA position description (e.g. "alpha to alpha") */
	tkaPositionDescription: string;
	/** TKA motion description */
	tkaMotionDescription: string;
	/** Letter type number(s) this covers */
	letterType: string;
	/** All letters in this mode, grouped by rotation style */
	rotationGroups: RotationGroup[];
	/** Compound letters associated with this mode (if any) */
	compounds: CompoundInfo[];
	/** Whether classification is position-dependent for some letters */
	hasPositionDependentLetters: boolean;
	/** Note about position-dependent classification */
	positionDependenceNote?: string;
}

/** A row in the VTG <-> TKA terminology comparison table */
export interface TerminologyRow {
	vtgTerm: string;
	vtgMeaning: string;
	tkaTerm: string;
	tkaMeaning: string;
}

/** A VTG turn ratio mapped to TKA turns */
export interface TurnRatioMapping {
	vtgRatio: string;
	vtgDescription: string;
	tkaTurns: string;
	tkaDescription: string;
}

/** Something TKA covers that VTG does not */
export interface BeyondVtgItem {
	title: string;
	description: string;
	icon: string;
	tkaFeature: string;
}
