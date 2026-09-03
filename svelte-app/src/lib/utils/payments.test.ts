import { describe, it, expect } from 'vitest';
import {
	getPaymentFraction,
	getRentForMonth,
	getPaymentMonthsForYear,
	isPaid
} from './payments';
import type { Payment, Spot } from '$lib/types';

const baseSpot: Spot = {
	id: 's1',
	label: '1',
	state: 'occupied',
	reserved: false,
	owned: true,
	monthlyRent: 80,
	rentHistory: null,
	assignedUserId: 'u1'
};

describe('getPaymentFraction', () => {
	it('day ≤10 → full month', () => {
		expect(getPaymentFraction('2026-06-05').fraction).toBe(1);
		expect(getPaymentFraction('2026-06-10').key).toBe('full');
	});
	it('day 11–20 → half month', () => {
		expect(getPaymentFraction('2026-06-11').fraction).toBe(0.5);
		expect(getPaymentFraction('2026-06-20').key).toBe('half');
	});
	it('day >20 → third month', () => {
		expect(getPaymentFraction('2026-06-21').fraction).toBeCloseTo(1 / 3);
		expect(getPaymentFraction('2026-06-28').key).toBe('third');
	});
});

describe('getRentForMonth', () => {
	it('falls back to monthlyRent when no history', () => {
		expect(getRentForMonth(baseSpot, 2026, 6)).toBe(80);
	});
	it('falls back to 80 when monthlyRent is 0/missing and no history', () => {
		expect(getRentForMonth({ ...baseSpot, monthlyRent: 0 }, 2026, 6)).toBe(80);
	});
	it('resolves the most-recent applicable history entry', () => {
		const spot: Spot = {
			...baseSpot,
			rentHistory: [
				{ from: '2026-01', rent: 90 },
				{ from: '2026-05', rent: 110 }
			]
		};
		expect(getRentForMonth(spot, 2026, 3)).toBe(90); // between Jan and May
		expect(getRentForMonth(spot, 2026, 6)).toBe(110); // after May
	});
	it('falls back to monthlyRent when target month precedes all history', () => {
		const spot: Spot = { ...baseSpot, rentHistory: [{ from: '2026-05', rent: 110 }] };
		expect(getRentForMonth(spot, 2026, 1)).toBe(80);
	});
});

describe('getPaymentMonthsForYear', () => {
	it('starts at registration month in the registration year', () => {
		expect(getPaymentMonthsForYear('2026-03-01', 2026, null)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
	});
	it('is empty for years before registration', () => {
		expect(getPaymentMonthsForYear('2026-03-01', 2025, null)).toEqual([]);
	});
	it('runs full year for years after registration', () => {
		expect(getPaymentMonthsForYear('2026-03-01', 2027, null)).toHaveLength(12);
	});
	it('stops at termination month in the termination year', () => {
		expect(getPaymentMonthsForYear('2026-01-01', 2026, '2026-06-15')).toEqual([1, 2, 3, 4, 5, 6]);
	});
	it('is empty for years after termination', () => {
		expect(getPaymentMonthsForYear('2026-01-01', 2027, '2026-06-15')).toEqual([]);
	});
});

describe('isPaid', () => {
	const payments: Payment[] = [
		{
			id: 'p1',
			spotId: 's1',
			userId: 'u1',
			month: 6,
			year: 2026,
			type: 'rent',
			paidDate: '2026-06-01',
			markedByAdminId: 'a1'
		}
	];
	it('true when a matching row exists', () => {
		expect(isPaid(payments, 's1', 6, 2026, 'rent')).toBe(true);
	});
	it('false when month/type differs', () => {
		expect(isPaid(payments, 's1', 7, 2026, 'rent')).toBe(false);
		expect(isPaid(payments, 's1', 6, 2026, 'commission')).toBe(false);
	});
});
