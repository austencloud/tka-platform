// Reactive localStorage-backed UI preferences for the guide editor shell.
// State is shared across the whole route — a single EditorPrefs instance
// is created on first import and re-used.
//
// Persisted keys (localStorage):
//   tka.guide.leftCollapsed  — boolean; left nav visible?
//   tka.guide.rightCollapsed — boolean; right panels visible?
//   tka.guide.viewMode       — 'single' | 'spread' | 'compare'
//   tka.guide.zoom           — number; page scale (0.25 .. 2.0)

import { browser } from '$app/environment';

export type ViewMode = 'single' | 'spread' | 'compare';

const LEFT_KEY = 'tka.guide.leftCollapsed';
const RIGHT_KEY = 'tka.guide.rightCollapsed';
const VIEW_KEY = 'tka.guide.viewMode';
const ZOOM_KEY = 'tka.guide.zoom';

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 2.0;
export const ZOOM_STEP = 0.1;

function clampZoom(v: number): number {
	if (!Number.isFinite(v)) return 1;
	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v));
}

function readBool(key: string, fallback: boolean): boolean {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (raw === 'true') return true;
		if (raw === 'false') return false;
	} catch {
		// Safari private mode / storage full — fall through to default
	}
	return fallback;
}

function readView(fallback: ViewMode): ViewMode {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(VIEW_KEY);
		if (raw === 'single' || raw === 'spread' || raw === 'compare') return raw;
	} catch {
		// ignore
	}
	return fallback;
}

function readZoom(fallback: number): number {
	if (!browser) return fallback;
	try {
		const raw = localStorage.getItem(ZOOM_KEY);
		if (raw) return clampZoom(parseFloat(raw));
	} catch {
		// ignore
	}
	return fallback;
}

function writeKey(key: string, value: string): void {
	if (!browser) return;
	try {
		localStorage.setItem(key, value);
	} catch {
		// ignore quota / privacy errors
	}
}

class EditorPrefs {
	leftCollapsed = $state(readBool(LEFT_KEY, false));
	rightCollapsed = $state(readBool(RIGHT_KEY, false));
	viewMode: ViewMode = $state(readView('single'));
	zoom = $state(readZoom(1));

	toggleLeft(): void {
		this.leftCollapsed = !this.leftCollapsed;
		writeKey(LEFT_KEY, String(this.leftCollapsed));
	}

	toggleRight(): void {
		this.rightCollapsed = !this.rightCollapsed;
		writeKey(RIGHT_KEY, String(this.rightCollapsed));
	}

	setViewMode(m: ViewMode): void {
		this.viewMode = m;
		writeKey(VIEW_KEY, m);
	}

	setZoom(v: number): void {
		this.zoom = clampZoom(v);
		writeKey(ZOOM_KEY, String(this.zoom));
	}

	zoomIn(): void {
		this.setZoom(this.zoom + ZOOM_STEP);
	}

	zoomOut(): void {
		this.setZoom(this.zoom - ZOOM_STEP);
	}

	resetZoom(): void {
		this.setZoom(1);
	}
}

export const editorPrefs = new EditorPrefs();
