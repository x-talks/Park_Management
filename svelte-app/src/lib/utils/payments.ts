// Payment utilities — consolidated from admin.js and invite.js/parking.html
// (these were duplicated in the original app). Pure and unit-testable: no i18n
// here — callers translate the fraction desc via t(`pay.fraction.${key}.desc`).
import type { Payment, Spot } from '$lib/types';

export type FractionKey = 'full' | 'half' | 'third';

export interface PaymentFraction {
	fraction: number;
	key: FractionKey;
	label: string; // fallback label; UI may translate via pay.fraction.${key}
}

/**
 * Pro-rated first-month fraction by registration day-of-month:
 *   day ≤10 → full (1), ≤20 → half (0.5), else third (1/3).
 */
export function getPaymentFraction(registeredAt: string): PaymentFraction {
	const day = new Date(registeredAt).getDate();
	if (day <= 10) return { fraction: 1, key: 'full', label: 'Full month' };
	if (day <= 20) return { fraction: 0.5, key: 'half', label: '½ month' };
	return { fraction: 1 / 3, key: 'third', label: '⅓ month' };
}

/**
 * Effective monthly rent for a spot in a given year/month, resolved from
 * rentHistory (most-recent entry whose `from` ≤ the target month), falling
 * back to the spot's monthlyRent, then 80. Ported verbatim from admin.js.
 */
export function getRentForMonth(spot: Spot, year: number, month: number): number {
	const history = spot.rentHistory;
	if (history && history.length > 0) {
		const key = `${year}-${String(month).padStart(2, '0')}`;
		const applicable = history
			.filter((h) => h.from <= key)
			.sort((a, b) => b.from.localeCompare(a.from));
		if (applicable.length > 0) return applicable[0].rent;
	}
	return spot.monthlyRent || 80;
}

/**
 * The list of months (1..12) to bill in a given year, bounded by the renter's
 * registration date and optional termination date.
 */
export function getPaymentMonthsForYear(
	registeredAt: string,
	year: number,
	terminationDate: string | null
): number[] {
	const reg = new Date(registeredAt);
	const regYear = reg.getFullYear();
	const regMonth = reg.getMonth() + 1;

	let startMonth = 1;
	if (year < regYear) return [];
	if (year === regYear) startMonth = regMonth;

	let endMonth = 12;
	if (terminationDate) {
		const term = new Date(terminationDate);
		const termYear = term.getFullYear();
		const termMonth = term.getMonth() + 1;
		if (year > termYear) return [];
		if (year === termYear) endMonth = termMonth;
	}

	const months: number[] = [];
	for (let m = startMonth; m <= endMonth; m++) months.push(m);
	return months;
}

/** True if a payment row exists for the given spot/month/year/type. */
export function isPaid(
	payments: Payment[],
	spotId: string,
	month: number,
	year: number,
	type: string
): boolean {
	return payments.some(
		(p) => p.spotId === spotId && p.month === month && p.year === year && p.type === type
	);
}
