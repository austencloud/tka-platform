// Permissive Phase 1 gate. Production builds with a known admin UID list
// will block non-admin Firebase users; dev is unrestricted. Tighten in
// Phase 2 once the auth context is wired through hooks.server.ts.

import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const ADMIN_UIDS = new Set<string>([
	// Austen's Firebase UID — fill in before merging to production.
]);

export const load: PageServerLoad = async ({ locals }) => {
	const user = (locals as { user?: { uid?: string } }).user;
	if (
		process.env.NODE_ENV === 'production' &&
		user?.uid &&
		!ADMIN_UIDS.has(user.uid)
	) {
		throw redirect(302, '/guide/level-1/compare');
	}
	return {};
};
