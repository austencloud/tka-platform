/**
 * TKA-OS v1.0 - Domain Types
 *
 * Core type definitions for the retro desktop shell: windows, icons,
 * dialogs, and start menu items. These model the fictional 1995
 * operating system built by the Bellweather Technical Institute.
 */

import type { RetroIconName } from "../../components/rendering/retro-icons";

export interface RetroWindowState {
	id: string;
	title: string;
	icon?: RetroIconName;
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
	icon: RetroIconName;
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
	icon?: RetroIconName;
	action?: () => void;
	children?: RetroStartMenuItem[];
	separator?: boolean;
}

export interface RetroContextMenuItem {
	label: string;
	icon?: RetroIconName;
	action?: () => void;
	children?: RetroContextMenuItem[];
	separator?: boolean;
	disabled?: boolean;
	isDefault?: boolean;
}

export interface RetroTreeNode {
	id: string;
	label: string;
	icon?: string;
	children?: RetroTreeNode[];
	expanded?: boolean;
}
