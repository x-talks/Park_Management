// Typed wrappers for every Worker write route. All go through workerRequest,
// which handles the 401 refresh/re-auth flow. Mirrors the mapped API contract.
import { workerRequest } from './client';
import type { Role } from '$lib/types';

// ── Users ──────────────────────────────────────────────────────────────────
export interface CreateUserBody {
	name: string;
	lastName: string;
	phone: string;
	address: string;
	licensePlate: string;
	carModel?: string;
	carColor?: string;
	spotId?: string;
	password: string;
	monthlyRent?: number;
}
export const createUser = (body: CreateUserBody) =>
	workerRequest<{ ok: boolean; userId: string; email: string }>('POST', '/users', body);

export const patchUser = (id: string, changes: Record<string, unknown>) =>
	workerRequest('PATCH', `/users/${id}`, changes);

export const deleteUser = (id: string) => workerRequest('DELETE', `/users/${id}`);

export const setPassword = (id: string, password: string, currentPassword?: string) =>
	workerRequest('POST', `/users/${id}/password`, { password, currentPassword });

export const setRole = (id: string, role: Role) =>
	workerRequest('POST', `/users/${id}/role`, { role });

export const migrateUser = (id: string) =>
	workerRequest<{ ok: boolean; authId: string; tempPassword: string; email: string }>(
		'POST',
		`/admin/migrate-user/${id}`
	);

// ── Spots ──────────────────────────────────────────────────────────────────
export const patchSpot = (id: string, changes: Record<string, unknown>) =>
	workerRequest('PATCH', `/spots/${id}`, changes);

export const assignSpot = (id: string, userId: string) =>
	workerRequest('POST', `/spots/${id}/assign`, { userId });

export const releaseSpot = (id: string) => workerRequest('POST', `/spots/${id}/release`);

// ── Payments ─────────────────────────────────────────────────────────────────
export interface CreatePaymentBody {
	spotId: string;
	userId: string;
	month: number;
	year: number;
	type?: string;
	amount?: number;
}
export const createPayment = (body: CreatePaymentBody) =>
	workerRequest('POST', '/payments', body);

export const deletePayment = (id: string) => workerRequest('DELETE', `/payments/${id}`);

// ── Invites ──────────────────────────────────────────────────────────────────
export interface CreateInviteBody {
	name: string;
	lastName: string;
	phone: string;
	address: string;
	spotId: string;
	licensePlate?: string | null;
	carModel?: string | null;
	carColor?: string | null;
	monthlyRent?: number | null;
}
export const createInvite = (body: CreateInviteBody) =>
	workerRequest<{ token: string; id: string; expiresAt: string }>('POST', '/invites', body);

export const patchInvite = (id: string, changes: Record<string, unknown>) =>
	workerRequest('PATCH', `/invites/${id}`, changes);

// ── Pending registrations ────────────────────────────────────────────────────
export interface SubmitPendingBody {
	token: string;
	name?: string;
	lastName?: string;
	phone?: string;
	address?: string;
	licensePlate: string;
	carModel?: string;
	carColor?: string;
	password: string;
}
export const submitPendingRegistration = (body: SubmitPendingBody) =>
	workerRequest<{ ok: boolean; id: string }>('POST', '/pending-registrations', body);

export const approvePending = (id: string) =>
	workerRequest<{ ok: boolean; userId: string }>(
		'POST',
		`/pending-registrations/${id}/approve`
	);

export const rejectPending = (id: string) =>
	workerRequest('DELETE', `/pending-registrations/${id}`);

// ── Incidents ────────────────────────────────────────────────────────────────
export interface CreateIncidentBody {
	spotId: string;
	observedPlate?: string | null;
	note?: string | null;
	imageUrl?: string | null;
	filePath?: string | null;
}
export const createIncident = (body: CreateIncidentBody) =>
	workerRequest<{ ok: boolean; id: string }>('POST', '/incidents', body);

export const deleteIncident = (id: string) => workerRequest('DELETE', `/incidents/${id}`);
