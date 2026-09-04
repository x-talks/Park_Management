import type { Payment, Spot, User } from '$lib/types';

export function exportPaymentsCsv(
	spots: Spot[],
	users: User[],
	payments: Payment[],
	year: number
): void {
	const months = Array.from({ length: 12 }, (_, i) => ({
		month: i + 1,
		label: new Date(year, i, 1).toLocaleString('default', { month: 'short' })
	}));

	const assigned = spots.filter((s) => s.assignedUserId);
	const rows: string[] = [];

	rows.push(['Spot', 'Renter', ...months.map((m) => m.label)].join(','));

	assigned.forEach((s) => {
		const user = users.find((u) => u.id === s.assignedUserId);
		const name = user ? `${user.name ?? ''} ${user.lastName ?? ''}`.trim() || user.username : '';
		const cells = months.map((m) => {
			const paid = payments.find(
				(p) => p.spotId === s.id && p.type === 'rent' && p.month === m.month && p.year === year
			);
			return paid ? 'Paid' : 'Pending';
		});
		rows.push([`"Spot ${s.label}"`, `"${name}"`, ...cells].join(','));
	});

	const csv = rows.join('\n');
	const blob = new Blob([csv], { type: 'text/csv' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `payments_${year}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}
