// Low-level HTTP client — mirrors js/api.js transport behavior.
import { config } from '$lib/config';
import { session } from '$lib/stores/session.svelte';

export interface FetchOpts {
	timeoutMs?: number;
	retries?: number;
}

/** AbortController-based timeout wrapper with 1 retry on transport failure (not HTTP errors). */
export async function fetchWithTimeout(
	url: string,
	init: RequestInit = {},
	{ timeoutMs = 10_000, retries = 1 }: FetchOpts = {}
): Promise<Response> {
	let lastErr: unknown;
	for (let attempt = 0; attempt <= retries; attempt++) {
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), timeoutMs);
		try {
			return await fetch(url, { ...init, signal: ctrl.signal });
		} catch (err) {
			lastErr = err;
		} finally {
			clearTimeout(timer);
		}
	}
	throw lastErr instanceof Error ? lastErr : new Error('Network request failed');
}

/** Hook the data layer sets so a 401 can trigger silent refresh / re-auth. */
let onAuthRefresh: (() => Promise<boolean>) | null = null;
let onAuthFailure: (() => Promise<void>) | null = null;

export function setAuthHandlers(refresh: () => Promise<boolean>, failure: () => Promise<void>): void {
	onAuthRefresh = refresh;
	onAuthFailure = failure;
}

async function doWorkerCall(method: string, path: string, body?: unknown): Promise<Response> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	const token = session.accessToken;
	if (token) headers['Authorization'] = `Bearer ${token}`;
	return fetchWithTimeout(`${config.workerUrl}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body)
	});
}

/**
 * Core Worker mutation call. On 401: silent refresh → retry → re-auth → retry →
 * hard failure. Throws Error(data.error) on non-ok. Returns parsed JSON or null.
 */
export async function workerRequest<T = unknown>(
	method: string,
	path: string,
	body?: unknown
): Promise<T | null> {
	let res = await doWorkerCall(method, path, body);

	if (res.status === 401) {
		const refreshed = onAuthRefresh ? await onAuthRefresh() : false;
		if (refreshed) {
			res = await doWorkerCall(method, path, body);
		}
		if (res.status === 401 && onAuthFailure) {
			await onAuthFailure();
			res = await doWorkerCall(method, path, body);
		}
	}

	const text = await res.text();
	const data: unknown = text ? JSON.parse(text) : null;

	if (!res.ok) {
		const msg =
			data && typeof data === 'object' && 'error' in data
				? String((data as { error: unknown }).error)
				: `Request failed (${res.status})`;
		throw new Error(msg);
	}
	return data as T | null;
}
