// Spot utilities — ported verbatim from js/parking.js.
import type { Spot } from '$lib/types';

export type SpotStatusClass = 'free' | 'occupied' | 'reserved' | 'pending' | 'mine';

export const LEFT_SPOTS = ['20', '19', '18', '17', '16', '15', '14', '13', '12', '11'];
export const RIGHT_SPOTS = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'];

/** Map a display label to its spot id. 'A'→'sA', 'B'→'sB', else 's{label}'. */
export function spotId(label: string): string {
	return label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
}

/** Find a spot by label, defaulting to a synthetic free spot if absent. */
export function getSpotData(spots: Spot[], label: string): Spot {
	const sid = spotId(label);
	return (
		spots.find((s) => s.id === sid) ??
		({
			id: sid,
			label,
			state: 'free',
			reserved: false,
			owned: false,
			monthlyRent: 80,
			rentHistory: null,
			assignedUserId: null
		} satisfies Spot)
	);
}

/** Base state class: reserved > pending > occupied/free. */
export function spotStateClass(spot: Spot, pendingSpotIds: Set<string>): SpotStatusClass {
	if (spot.reserved) return 'reserved';
	if (pendingSpotIds.has(spot.id)) return 'pending';
	return spot.state === 'occupied' ? 'occupied' : 'free';
}

/** Full classification, with 'mine' taking precedence when the spot is the user's own. */
export function classifyStatus(
	spot: Spot,
	mineSpotIds: Set<string>,
	pendingSpotIds: Set<string>
): SpotStatusClass {
	if (mineSpotIds.has(spot.id)) return 'mine';
	return spotStateClass(spot, pendingSpotIds);
}

/** Sort: occupied first, then by numeric label. Mirrors admin.js sortSpots. */
export function sortSpots(spots: Spot[]): Spot[] {
	return [...spots].sort((a, b) => {
		const aOcc = a.state === 'occupied' ? 0 : 1;
		const bOcc = b.state === 'occupied' ? 0 : 1;
		if (aOcc !== bOcc) return aOcc - bOcc;
		const an = parseInt(a.label, 10);
		const bn = parseInt(b.label, 10);
		if (isNaN(an) && isNaN(bn)) return a.label.localeCompare(b.label);
		if (isNaN(an)) return 1;
		if (isNaN(bn)) return -1;
		return an - bn;
	});
}

/** German license plate format, e.g. HD-XY-123. */
export const LICENSE_PLATE_RE = /^[A-ZÄÖÜ]{1,3}-[A-Z]{1,2}-\d{1,4}$/i;
