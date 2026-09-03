// Domain types — mirror the Supabase schema and the Worker API contract exactly.
// Column names are camelCase (quoted identifiers in Postgres). No `any` anywhere.

export type Role = 'renter' | 'admin' | 'master';

export type SpotState = 'free' | 'occupied' | 'reserved';

/** One entry in a spot's rent history: rent effective from a given YYYY-MM month. */
export interface RentHistoryEntry {
	from: string; // 'YYYY-MM'
	rent: number;
}

export interface Spot {
	id: string; // e.g. 's1', 'sA', 'sB'
	label: string;
	state: SpotState;
	reserved: boolean;
	owned: boolean;
	monthlyRent: number;
	rentHistory: RentHistoryEntry[] | null;
	assignedUserId: string | null;
}

/** Full users row (admin views). Includes sensitive columns. */
export interface User {
	id: string;
	username: string;
	authId: string | null;
	name: string | null;
	lastName: string | null;
	licensePlate: string | null;
	phone: string | null;
	carModel: string | null;
	carColor: string | null;
	address: string | null;
	role: Role;
	active: boolean;
	registeredAt: string | null; // DATE
	terminationDate: string | null; // DATE
	assignedSpots: string[] | null;
	pendingEdits: Record<string, string> | null;
	passwordHash: string | null;
	lastPassword: string | null;
	language?: string | null;
}

/** Safe user shape returned by POST /auth/login — no passwordHash/lastPassword/authId. */
export type SafeUser = Omit<User, 'passwordHash' | 'lastPassword' | 'authId'>;

export type PaymentType = 'rent' | 'commission';

export interface Payment {
	id: string;
	spotId: string;
	userId: string;
	month: number; // 1..12
	year: number;
	type: PaymentType | string;
	paidDate: string; // DATE 'YYYY-MM-DD'
	markedByAdminId: string;
	amount?: number; // present only when created with an explicit amount
}

export interface Invite {
	id: string;
	token: string;
	spotId: string;
	expiresAt: string; // ISO
	usedBy: string | null;
	name: string | null;
	lastName: string | null;
	phone: string | null;
	address: string | null;
	licensePlate: string | null;
	carModel: string | null;
	carColor: string | null;
}

export interface PendingRegistration {
	id: string;
	token: string;
	spotId: string;
	name: string | null;
	lastName: string | null;
	licensePlate: string | null;
	phone: string | null;
	address: string | null;
	carModel: string | null;
	carColor: string | null;
	passwordHash: string; // plaintext temp password during the pending window (by design)
	submittedAt: string; // ISO
}

export interface Incident {
	id: string;
	spotId: string;
	reportedByUserId: string;
	observedPlate: string | null;
	note: string | null;
	imageUrl: string | null;
	filePath: string | null;
	reportedAt: string; // ISO
}

/** Response of POST /auth/login. */
export interface LoginResponse {
	accessToken: string;
	refreshToken: string;
	user: SafeUser;
}
