export const Z = {
	BASE: 0,
	STICKY: 100,
	SIDEBAR: 200,
	DROPDOWN: 300,
	DRAWER: 400,
	OVERLAY: 500,
	MODAL: 600,
	TOAST: 700,
	TOOLTIP: 800,
	PRIORITY: 900,
	DEBUG: 1000,
} as const;

export type ZLayer = keyof typeof Z;
