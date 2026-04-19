// Editor admin gate. Fails CLOSED in production: anyone whose Firebase UID
// is not in ADMIN_UIDS (including unauthenticated visitors) is redirected
// to the read-only compare view. Dev is unrestricted so local iteration
// doesn't require auth context. ADMIN_UIDS must be populated before any
// production deployment.

import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { PageServerLoad } from './$types';

const ADMIN_UIDS = new Set<string>([
	// Austen's Firebase UID. Populate from hooks.server.ts auth context.
	// Add an env-var override path once needed.
]);

export const load: PageServerLoad = async ({ locals }) => {
	if (dev) return {};
	const user = (locals as { user?: { uid?: string } }).user;
	if (!user?.uid || !ADMIN_UIDS.has(user.uid)) {
		throw redirect(302, '/guide/level-1/compare');
	}
	return {};
};
