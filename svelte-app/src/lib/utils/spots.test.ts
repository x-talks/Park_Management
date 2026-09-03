import { describe, it, expect } from 'vitest';
import {
	spotId,
	spotStateClass,
	classifyStatus,
	sortSpots,
	LICENSE_PLATE_RE
} from './spots';
import type { Spot } from '$lib/types';

function mk(id: string, over: Partial<Spot> = {}): Spot {
	return {
		id,
		label: id.replace(/^s/, ''),
		state: 'free',
		reserved: false,
		owned: false,
		monthlyRent: 80,
		rentHistory: null,
		assignedUserId: null,
		...over
	};
}

describe('spotId', () => {
	it('maps corner labels and numerics', () => {
		expect(spotId('A')).toBe('sA');
		expect(spotId('B')).toBe('sB');
		expect(spotId('7')).toBe('s7');
	});
});

describe('spotStateClass', () => {
	const empty = new Set<string>();
	it('reserved wins over everything', () => {
		expect(spotStateClass(mk('s1', { reserved: true, state: 'occupied' }), empty)).toBe('reserved');
	});
	it('pending when id in pending set', () => {
		expect(spotStateClass(mk('s2'), new Set(['s2']))).toBe('pending');
	});
	it('occupied/free from state', () => {
		expect(spotStateClass(mk('s3', { state: 'occupied' }), empty)).toBe('occupied');
		expect(spotStateClass(mk('s4', { state: 'free' }), empty)).toBe('free');
	});
});

describe('classifyStatus', () => {
	it('mine takes precedence over all', () => {
		const spot = mk('s1', { reserved: true, state: 'occupied' });
		expect(classifyStatus(spot, new Set(['s1']), new Set(['s1']))).toBe('mine');
	});
	it('delegates to state class when not mine', () => {
		expect(classifyStatus(mk('s2', { state: 'occupied' }), new Set(), new Set())).toBe('occupied');
	});
});

describe('sortSpots', () => {
	it('occupied first, then numeric label', () => {
		const spots = [
			mk('s3', { state: 'free' }),
			mk('s1', { state: 'occupied' }),
			mk('s2', { state: 'occupied' })
		];
		expect(sortSpots(spots).map((s) => s.id)).toEqual(['s1', 's2', 's3']);
	});
	it('non-numeric labels sort after numeric', () => {
		const spots = [mk('sA', { label: 'A' }), mk('s2', { label: '2' })];
		expect(sortSpots(spots).map((s) => s.label)).toEqual(['2', 'A']);
	});
});

describe('LICENSE_PLATE_RE', () => {
	it('accepts valid German plates', () => {
		expect(LICENSE_PLATE_RE.test('HD-XY-123')).toBe(true);
		expect(LICENSE_PLATE_RE.test('B-AB-1')).toBe(true);
		expect(LICENSE_PLATE_RE.test('MÜ-A-99')).toBe(true);
	});
	it('rejects malformed plates', () => {
		expect(LICENSE_PLATE_RE.test('HDXY123')).toBe(false);
		expect(LICENSE_PLATE_RE.test('HD-XY-12345')).toBe(false);
		expect(LICENSE_PLATE_RE.test('')).toBe(false);
	});
});
