import type { authState } from '$lib/shared/auth/state/auth-state.svelte';
/**
 * Lightweight bootstrap for retro routes.
 * Loads composition root (side-effect registrations) + Firebase + auth.
 * Skips: prefetch, analytics, moderation banners, modal state, web vitals.
 */
export async function initRetroMode(): Promise<{
	authState: typeof authState;
}> {
	// 1. Load composition root (triggers service registration)
	await import("$lib/shared/composition-root");

	// 2. Initialize Firestore
	const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
	await getFirestoreInstance();

	// 3. Initialize auth state (sets up onAuthStateChanged listener)
	const { authState } = await import(
		"$lib/shared/auth/state/auth-state.svelte"
	);
	await authState.initialize();

	return { authState };
}
