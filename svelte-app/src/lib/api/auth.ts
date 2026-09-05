// Auth — login/logout, JWT refresh scheduling, and 401 re-auth handlers.
// Mirrors js/auth.js + the refresh/re-auth logic in js/api.js.
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { base } from '$app/paths';
import { config } from '$lib/config';
import { session } from '$lib/stores/session.svelte';
import { setAuthHandlers, fetchWithTimeout } from './client';
import type { LoginResponse } from '$lib/types';

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let lastUsername: string | null = null;

/** Decode a JWT payload's `exp` (seconds). Returns null if unreadable. */
function jwtExp(token: string): number | null {
	try {
		const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
		return typeof payload.exp === 'number' ? payload.exp : null;
	} catch {
		return null;
	}
}

/** Schedule a refresh 60s before the access token expires. */
export function scheduleRefresh(accessToken: string): void {
	if (!browser) return;
	if (refreshTimer) clearTimeout(refreshTimer);
	const exp = jwtExp(accessToken);
	if (!exp) return;
	const msUntil = exp * 1000 - Date.now() - 60_000;
	refreshTimer = setTimeout(
		() => {
			void tryRefresh();
		},
		Math.max(0, msUntil)
	);
}

/** Silent refresh via Supabase token endpoint. Returns success. */
export async function tryRefresh(): Promise<boolean> {
	const refreshToken = session.refreshToken;
	if (!refreshToken) return false;
	try {
		const res = await fetchWithTimeout(
			`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
			{
				method: 'POST',
				headers: { apikey: config.supabaseKey, 'Content-Type': 'application/json' },
				body: JSON.stringify({ refresh_token: refreshToken })
			}
		);
		if (!res.ok) return false;
		const data = (await res.json()) as { access_token?: string; refresh_token?: string };
		if (!data.access_token || !data.refresh_token) return false;
		session.setTokens(data.access_token, data.refresh_token);
		scheduleRefresh(data.access_token);
		return true;
	} catch {
		return false;
	}
}

export async function login(username: string, password: string): Promise<LoginResponse> {
	const user = username.trim().toUpperCase();
	const res = await fetchWithTimeout(`${config.workerUrl}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username: user, password })
	});
	const data = (await res.json()) as LoginResponse & { error?: string };
	if (!res.ok) throw new Error(data.error ?? 'Login failed');
	session.set(data.user, data.accessToken, data.refreshToken);
	lastUsername = user;
	scheduleRefresh(data.accessToken);
	return data;
}

export async function logout(): Promise<void> {
	try {
		await fetchWithTimeout(`${config.workerUrl}/auth/logout`, { method: 'POST' });
	} catch {
		/* stateless no-op; ignore */
	}
	if (refreshTimer) clearTimeout(refreshTimer);
	session.clear();
	if (browser) void goto(base + '/', { replaceState: true });
}

// The re-auth modal resolves this when the user re-enters their password.
let reauthResolver: ((password: string | null) => void) | null = null;
let reauthPromise: Promise<void> | null = null;

/** Called by ReauthModal when the user submits or cancels. */
export function resolveReauth(password: string | null): void {
	reauthResolver?.(password);
}

/** Store hook so a component can show the modal. Set by ReauthModal on mount. */
export let showReauthModal: (() => void) | null = null;
export function registerReauthModal(show: () => void): void {
	showReauthModal = show;
}

async function handleAuthFailure(): Promise<void> {
	if (reauthPromise) return reauthPromise;
	reauthPromise = (async () => {
		if (!lastUsername || !showReauthModal) {
			await logout();
			return;
		}
		showReauthModal();
		const password = await new Promise<string | null>((resolve) => {
			reauthResolver = resolve;
		});
		reauthResolver = null;
		if (!password) {
			await logout();
			return;
		}
		try {
			await login(lastUsername, password);
		} catch {
			await logout();
		}
	})();
	try {
		await reauthPromise;
	} finally {
		reauthPromise = null;
	}
}

/** Wire the client's 401 handlers. Call once on app init. */
export function initAuth(): void {
	setAuthHandlers(tryRefresh, handleAuthFailure);
	const token = session.accessToken;
	if (token) scheduleRefresh(token);
}
