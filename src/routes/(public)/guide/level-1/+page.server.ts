// Admin-only guide editor. Fails CLOSED in production: any visitor whose
// Firebase UID is not in ADMIN_UIDS (including unauthenticated users) is
// redirected to the site root. Dev is unrestricted so local work doesn't
// require auth context.
//
// ADMIN_UIDS must be populated before any production deployment. Until
// then the route is effectively private-in-prod (all redirects to /).

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
		throw redirect(302, '/');
	}
	return {};
};
