// Supabase direct reads — mirrors js/api.js readFile (browser→Supabase REST,
// anon key + user JWT, RLS-enforced). Reads only; all writes go via the Worker.
import { config } from '$lib/config';
import { session } from '$lib/stores/session.svelte';
import type { Incident, Invite, Payment, PendingRegistration, Spot, User } from '$lib/types';

function restHeaders(): Record<string, string> {
	const token = session.accessToken ?? config.supabaseKey;
	return {
		apikey: config.supabaseKey,
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	};
}

async function getTable<T>(table: string, query = 'order=id'): Promise<T[]> {
	const res = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${query}`, {
		headers: restHeaders()
	});
	if (res.status === 401) {
		// Match legacy _checkExpired: bounce to login on expired read.
		if (typeof window !== 'undefined') window.location.href = '/';
		return [];
	}
	if (!res.ok) throw new Error(`Read ${table} failed (${res.status})`);
	return (await res.json()) as T[];
}

export const getSpots = () => getTable<Spot>('spots');
export const getUsers = () => getTable<User>('users');
export const getPayments = () => getTable<Payment>('payments');
export const getInvites = () => getTable<Invite>('invites');
export const getPendingRegistrations = () =>
	getTable<PendingRegistration>('pending_registrations');
export const getIncidents = () => getTable<Incident>('incidents');

/** Validate an invite token before login (relies on the anon SELECT policy). */
export async function getInviteByToken(token: string): Promise<Invite | null> {
	const rows = await getTable<Invite>('invites', `token=eq.${encodeURIComponent(token)}`);
	return rows[0] ?? null;
}

/** Upload an incident image directly to Supabase Storage; returns the public URL. */
export async function uploadIncidentImage(filePath: string, file: File): Promise<string> {
	const res = await fetch(`${config.supabaseUrl}/storage/v1/object/incidents/${filePath}`, {
		method: 'POST',
		headers: {
			apikey: config.supabaseKey,
			Authorization: `Bearer ${session.accessToken ?? config.supabaseKey}`,
			'x-upsert': 'true',
			'Content-Type': file.type || 'application/octet-stream'
		},
		body: file
	});
	if (!res.ok) throw new Error(`Image upload failed (${res.status})`);
	return `${config.supabaseUrl}/storage/v1/object/public/incidents/${filePath}`;
}
