/**
 * TKA-OS v1.0 — Domain Types
 *
 * Core type definitions for the retro desktop shell: windows, icons,
 * dialogs, and start menu items. These model the fictional 1995
 * operating system built by the Bellweather Technical Institute.
 */

export interface RetroWindowState {
	id: string;
	title: string;
	icon?: string;
	x: number;
	y: number;
	width: number;
	height: number;
	minWidth?: number;
	minHeight?: number;
	isMinimized: boolean;
	isMaximized: boolean;
	zIndex: number;
}

export interface RetroDesktopIcon {
	id: string;
	label: string;
	icon: string;
	executable: string;
	moduleId?: string;
}

export type RetroDialogType = "info" | "warning" | "error" | "question";

export interface RetroDialogConfig {
	title: string;
	message: string;
	type: RetroDialogType;
	buttons: string[];
}

export interface RetroStartMenuItem {
	label: string;
	icon?: string;
	action?: () => void;
	children?: RetroStartMenuItem[];
	separator?: boolean;
}
