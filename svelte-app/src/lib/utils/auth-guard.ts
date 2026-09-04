// requireAuth — call at the top of a protected page's load function.
// Redirects to / if not logged in or role is insufficient.
import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { session } from '$lib/stores/session.svelte';
import type { Role } from '$lib/types';

export function requireAuth(minRole: Role = 'renter'): void {
	if (!browser) return;
	if (!session.hasRole(minRole)) {
		throw redirect(302, '/');
	}
}
