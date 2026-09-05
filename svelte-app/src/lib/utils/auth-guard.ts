// requireAuth — call inside onMount() of a protected page.
// Uses goto() (SPA navigation) instead of throw redirect (SSR-only).
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { session } from '$lib/stores/session.svelte';
import type { Role } from '$lib/types';

export function requireAuth(minRole: Role = 'renter'): void {
	if (!browser) return;
	if (!session.hasRole(minRole)) {
		void goto(base + '/', { replaceState: true });
	}
}
