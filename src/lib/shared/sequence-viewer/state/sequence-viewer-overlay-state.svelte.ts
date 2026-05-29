import { pushState, replaceState } from '$app/navigation';
import type { SequenceData } from '$lib/shared/foundation/domain/models/SequenceData';
import type { ViewingContext } from "../services/presentation-resolver";
import { getShortCodeManager } from '$lib/shared/qr/getShortCodeManager';
import { authState } from '$lib/shared/auth/state/authState.svelte';

let _isOpen = $state(false);
let _sequence = $state<SequenceData | null>(null);
let _variations = $state<SequenceData[]>([]);
let _variationIndex = $state(0);
let _returnLabel = $state('Back');
let _initialBpm = $state(60);
let _initialStep = $state(0);
let _dismissPath = $state<string | null>(null);
let _viewingContext = $state<ViewingContext>('notation');
let _handPathMode = $state(false);
let _openedFromUrl = $state(false);
let _activeShortCode = $state<string | null>(null);
let _openToken = 0;

export function openSequenceOverlay(
	sequence: SequenceData,
	options?: {
		returnLabel?: string;
		initialBpm?: number;
		initialStep?: number;
		skipHistoryPush?: boolean;
		dismissPath?: string;
		variations?: SequenceData[];
		viewingContext?: ViewingContext;
		handPathMode?: boolean;
		fromUrl?: boolean;
		shortCode?: string;
	}
): void {
	_sequence = sequence;
	_variations = options?.variations ?? [sequence];
	_variationIndex = _variations.findIndex(v => v.id === sequence.id);
	if (_variationIndex < 0) _variationIndex = 0;
	_returnLabel = options?.returnLabel || 'Back';
	_initialBpm = options?.initialBpm || 60;
	_initialStep = options?.initialStep || 0;
	_dismissPath = options?.dismissPath || null;
	_viewingContext = options?.viewingContext ?? 'notation';
	_handPathMode = options?.handPathMode ?? false;
	_openedFromUrl = options?.fromUrl ?? false;
	_activeShortCode = options?.shortCode ?? null;
	_isOpen = true;
	const token = ++_openToken;

	if (!options?.skipHistoryPush) {
		pushState('', { sequenceOverlay: true });
	}

	if (!options?.fromUrl && typeof window !== 'undefined') {
		const url = new URL(window.location.href);
		if (url.searchParams.has('v')) {
			url.searchParams.delete('v');
			replaceState(url.pathname + url.search + url.hash, { sequenceOverlay: true });
		}
		void mintAndSyncShortCode(sequence, token);
	} else if (options?.shortCode) {
		_activeShortCode = options.shortCode;
	}
}

async function waitForAuthSettled(timeoutMs = 5000): Promise<void> {
	if (!authState.loading) return;
	const start = Date.now();
	while (authState.loading && Date.now() - start < timeoutMs) {
		await new Promise((r) => setTimeout(r, 50));
	}
}

async function mintAndSyncShortCode(sequence: SequenceData, token: number): Promise<void> {
	const manager = getShortCodeManager();
	if (!manager) return;

	await waitForAuthSettled();
	if (token !== _openToken || !_isOpen) return;

	let code: string | null = null;

	// Guests can't write to Firestore (shortcodes require auth — see
	// firestore.rules). Skip the doomed write and mint a self-contained
	// inline code directly: no DB clutter, no console noise, works offline.
	if (!authState.isAuthenticated) {
		try {
			const offline = await manager.createOfflineCode(sequence);
			code = offline.code;
		} catch (offlineError) {
			console.warn('[SequenceViewerOverlay] URL sync failed - offline encoding failed.', offlineError);
			return;
		}
	} else {
		try {
			const result = await manager.createShortCode(sequence, {
				embedSequenceData: true,
			});
			code = result.code;
		} catch (firebaseError) {
			try {
				const offline = await manager.createOfflineCode(sequence);
				code = offline.code;
			} catch (offlineError) {
				console.warn(
					'[SequenceViewerOverlay] URL sync failed - neither Firestore nor offline encoding succeeded.',
					{ firebaseError, offlineError },
				);
				return;
			}
		}
	}

	if (!code || token !== _openToken || !_isOpen) return;
	_activeShortCode = code;
	const url = new URL(window.location.href);
	url.searchParams.set('v', code);
	replaceState(url.pathname + url.search + url.hash, { sequenceOverlay: true });
}

export function closeSequenceOverlay(): void {
	if (typeof window !== 'undefined') {
		const url = new URL(window.location.href);
		if (url.searchParams.has('v')) {
			url.searchParams.delete('v');
			const target = url.pathname + (url.search ? url.search : '') + url.hash;
			replaceState(target, {});
		}
	}
	_isOpen = false;
	_sequence = null;
	_variations = [];
	_variationIndex = 0;
	_returnLabel = 'Back';
	_initialBpm = 60;
	_initialStep = 0;
	_dismissPath = null;
	_viewingContext = 'notation';
	_handPathMode = false;
	_openedFromUrl = false;
	_activeShortCode = null;
}

export function switchVariation(index: number): void {
	if (index < 0 || index >= _variations.length) return;
	const variation = _variations[index];
	if (!variation) return;
	_variationIndex = index;
	_sequence = variation;
}

export function isSequenceOverlayOpen(): boolean {
	return _isOpen;
}

export function getSequenceOverlayState() {
	return {
		get isOpen() { return _isOpen; },
		get sequence() { return _sequence; },
		get variations() { return _variations; },
		get variationIndex() { return _variationIndex; },
		get returnLabel() { return _returnLabel; },
		get initialBpm() { return _initialBpm; },
		get initialStep() { return _initialStep; },
		get dismissPath() { return _dismissPath; },
		get viewingContext() { return _viewingContext; },
		get handPathMode() { return _handPathMode; },
		get openedFromUrl() { return _openedFromUrl; },
		get activeShortCode() { return _activeShortCode; },
	};
}
