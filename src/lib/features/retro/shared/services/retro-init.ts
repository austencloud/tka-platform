/**
 * Lightweight bootstrap for retro routes.
 * Loads Firebase + auth + DI container.
 * Skips: prefetch, analytics, moderation banners, modal state, web vitals.
 */
export async function initRetroMode(): Promise<{
	container: typeof import("$lib/shared/di").container;
	authState: typeof import("$lib/shared/auth/state/authState.svelte").authState;
}> {
	// 1. Load DI container (triggers service registration)
	const { container } = await import("$lib/shared/di");

	// 2. Initialize Firestore
	const { getFirestoreInstance } = await import("$lib/shared/auth/firebase");
	await getFirestoreInstance();

	// 3. Initialize auth state (sets up onAuthStateChanged listener)
	const { authState } = await import(
		"$lib/shared/auth/state/authState.svelte"
	);
	await authState.initialize();

	return { container, authState };
}
