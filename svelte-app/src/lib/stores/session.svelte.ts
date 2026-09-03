// Session store — holds the authenticated SafeUser and tokens.
// localStorage keys are identical to the current app for drop-in compatibility:
//   pm_access_token, pm_refresh_token, pm_user
import { browser } from '$app/environment';
import type { Role, SafeUser } from '$lib/types';

const K_ACCESS = 'pm_access_token';
const K_REFRESH = 'pm_refresh_token';
const K_USER = 'pm_user';

const ROLE_ORDER: Record<Role, number> = { renter: 0, admin: 1, master: 2 };

function readUser(): SafeUser | null {
	if (!browser) return null;
	const raw = localStorage.getItem(K_USER);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as SafeUser;
	} catch {
		return null;
	}
}

class SessionStore {
	user = $state<SafeUser | null>(readUser());

	get accessToken(): string | null {
		return browser ? localStorage.getItem(K_ACCESS) : null;
	}

	get refreshToken(): string | null {
		return browser ? localStorage.getItem(K_REFRESH) : null;
	}

	get isLoggedIn(): boolean {
		return this.user !== null;
	}

	/** True if the current user's role meets or exceeds the required minimum. */
	hasRole(min: Role): boolean {
		if (!this.user) return false;
		return ROLE_ORDER[this.user.role] >= ROLE_ORDER[min];
	}

	set(user: SafeUser, accessToken: string, refreshToken: string): void {
		this.user = user;
		if (!browser) return;
		localStorage.setItem(K_USER, JSON.stringify(user));
		localStorage.setItem(K_ACCESS, accessToken);
		localStorage.setItem(K_REFRESH, refreshToken);
	}

	setTokens(accessToken: string, refreshToken: string): void {
		if (!browser) return;
		localStorage.setItem(K_ACCESS, accessToken);
		localStorage.setItem(K_REFRESH, refreshToken);
	}

	clear(): void {
		this.user = null;
		if (!browser) return;
		localStorage.removeItem(K_USER);
		localStorage.removeItem(K_ACCESS);
		localStorage.removeItem(K_REFRESH);
	}
}

export const session = new SessionStore();
