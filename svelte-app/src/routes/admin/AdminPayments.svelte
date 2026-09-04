<script lang="ts">
	import { i18n } from '$lib/stores/i18n.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { modalConfirm } from '$lib/stores/modal.svelte';
	import { createPayment, deletePayment, patchSpot } from '$lib/api/endpoints';
	import { getRentForMonth, getPaymentFraction } from '$lib/utils/payments';
	import { sortSpots } from '$lib/utils/spots';
	import { exportPaymentsCsv } from '$lib/utils/csv';
	import type { Spot, User, Payment } from '$lib/types';

	interface Props {
		spots: Spot[];
		users: User[];
		payments: Payment[];
		onRefresh: () => Promise<void>;
	}

	let { spots, users, payments, onRefresh }: Props = $props();

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth() + 1;

	let selectedYear = $state(currentYear);

	const yearOptions = $derived(
		Array.from({ length: 5 }, (_, i) => currentYear - i)
	);

	const months = $derived.by(() => {
		const maxMonth =
			selectedYear < currentYear ? 12 : selectedYear === currentYear ? currentMonth : 0;
		return Array.from({ length: maxMonth }, (_, i) => {
			const d = new Date(selectedYear, i, 1);
			return {
				month: i + 1,
				year: selectedYear,
				label: d.toLocaleString('default', { month: 'short' })
			};
		});
	});

	const assignedSpots = $derived(sortSpots(spots).filter((s) => s.assignedUserId));

	// Per-spot rent input values (for the inline rent editor in the matrix renter column)
	let rentInputs = $state<Record<string, string>>({});

	function initRentInput(s: Spot) {
		if (!(s.id in rentInputs)) {
			rentInputs[s.id] = (s.monthlyRent ?? 80).toFixed(2);
		}
	}

	function renterFor(s: Spot): User | undefined {
		return users.find((u) => u.id === s.assignedUserId);
	}

	function isPaid(spotId: string, month: number, year: number, type: string): Payment | undefined {
		return payments.find(
			(p) => p.spotId === spotId && p.month === month && p.year === year && p.type === type
		);
	}

	function commissionPaid(spotId: string): Payment | undefined {
		return payments.find((p) => p.spotId === spotId && p.type === 'commission');
	}

	function fractionForCell(renter: User | undefined, month: number, year: number): { fraction: number; label: string } {
		if (!renter?.registeredAt) return { fraction: 1, label: '' };
		const reg = new Date(renter.registeredAt);
		if (year !== reg.getFullYear() || month !== reg.getMonth() + 1) return { fraction: 1, label: '' };
		const { fraction, key } = getPaymentFraction(renter.registeredAt);
		const labelMap: Record<string, string> = { full: '', half: ' ½', third: ' ⅓' };
		return { fraction, label: labelMap[key] };
	}

	function isBefore(renter: User | undefined, month: number, year: number): boolean {
		if (!renter?.registeredAt) return false;
		const reg = new Date(renter.registeredAt);
		const ry = reg.getFullYear(), rm = reg.getMonth() + 1;
		return year < ry || (year === ry && month < rm);
	}

	function isAfterTermination(renter: User | undefined, month: number, year: number): boolean {
		if (!renter?.terminationDate) return false;
		const term = new Date(renter.terminationDate);
		const ty = term.getFullYear(), tm = term.getMonth() + 1;
		return year > ty || (year === ty && month > tm);
	}

	async function doMarkPaid(s: Spot, month: number, year: number, amount?: number) {
		const renter = renterFor(s);
		if (!renter || !session.user) return;
		try {
			await createPayment({ spotId: s.id, userId: renter.id, month, year, type: 'rent', amount });
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doMarkCommission(s: Spot, amount: number) {
		const renter = renterFor(s);
		if (!renter || !session.user) return;
		try {
			await createPayment({ spotId: s.id, userId: renter.id, month: 0, year: selectedYear, type: 'commission', amount });
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doRevertRent(p: Payment, monthLabel: string, year: number) {
		const ok = await modalConfirm(i18n.t('admin.confirm.revert.rent', monthLabel, String(year)), { danger: true });
		if (!ok) return;
		try {
			await deletePayment(p.id);
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doRevertCommission(p: Payment) {
		const ok = await modalConfirm(i18n.t('admin.confirm.revert.commission'), { danger: true });
		if (!ok) return;
		try {
			await deletePayment(p.id);
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	// Inline commission amount per spot
	let commInputs = $state<Record<string, string>>({});

	function initCommInput(s: Spot) {
		if (!(s.id in commInputs)) {
			commInputs[s.id] = getRentForMonth(s, selectedYear, 1).toFixed(2);
		}
	}

	async function saveRent(s: Spot) {
		const val = parseFloat(rentInputs[s.id]);
		if (isNaN(val) || val <= 0) return;
		if (Math.abs(val - (s.monthlyRent ?? 80)) < 0.001) return;
		const fromMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const existingHistory = s.rentHistory ?? [];
		const newHistory = [...existingHistory.filter((h) => h.from !== fromMonth), { from: fromMonth, rent: val }];
		try {
			await patchSpot(s.id, { monthlyRent: val, rentHistory: newHistory });
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	function doExportCsv() {
		exportPaymentsCsv(spots, users, payments, selectedYear);
		toast(i18n.t('admin.csv.export') + ' ✓', 'success');
	}
</script>

<div class="card">
	<div class="card-header">
		<h2>{i18n.t('admin.pay.title')}</h2>
		<div class="header-actions">
			<select id="payment-year" bind:value={selectedYear} class="year-sel">
				{#each yearOptions as y}
					<option value={y}>{y}</option>
				{/each}
			</select>
			<button id="csv-export-btn" class="secondary" onclick={doExportCsv}>{i18n.t('admin.csv.export')}</button>
		</div>
	</div>

	<div class="legend">
		<span class="legend-item paid-sample">✓ {i18n.t('admin.pay.legend.paid')}</span>
		<span class="legend-item unpaid-sample">— {i18n.t('admin.pay.legend.pending')}</span>
		<span class="legend-item comm-sample">{i18n.t('admin.pay.legend.commission')}</span>
	</div>

	<div id="payment-matrix" class="table-wrap">
		<table class="payment-matrix">
			<thead>
				<tr>
					<th>{i18n.t('admin.pay.col.spot')}</th>
					<th>{i18n.t('admin.pay.col.renter')}</th>
					<th class="pay-col">{i18n.t('admin.pay.col.commission')}</th>
					{#each months as m}
						<th class="pay-col">{m.label}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each assignedSpots as s (s.id)}
					{@const renter = renterFor(s)}
					{@const _ = initRentInput(s)}
					{@const _c = initCommInput(s)}
					{@const commPaid = commissionPaid(s.id)}
					<tr>
						<!-- Spot label -->
						<td>Spot {s.label}</td>

						<!-- Renter + inline rent editor -->
						<td class="renter-cell">
							<span>{renter ? `${renter.name ?? ''} ${renter.lastName ?? ''}`.trim() || renter.username : '—'}</span>
							{#if renter?.terminationDate}
								<span class="termination-chip">{i18n.t('admin.users.termination.chip', renter.terminationDate)}</span>
							{/if}
							<div class="rent-editor">
								<span class="rent-lbl">€/mo:</span>
								<input
									type="number" min="1" step="0.01"
									class="rent-inp-sm"
									bind:value={rentInputs[s.id]}
									title="Edit monthly rent"
									onblur={() => saveRent(s)}
									onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveRent(s); } }}
								/>
							</div>
						</td>

						<!-- Commission cell -->
						<td class="pay-col" class:payment-cell-paid={commPaid} class:payment-cell-unpaid={!commPaid}>
							{#if commPaid}
								✓ {commPaid.paidDate}
								<button class="secondary icon-xs" title={i18n.t('admin.btn.revert')} onclick={() => doRevertCommission(commPaid)}>↩</button>
							{:else}
								<input
									type="number" min="0" step="0.01"
									class="rent-inp-sm"
									bind:value={commInputs[s.id]}
									title="Commission amount"
									style="margin-bottom:0.2rem"
								/>
								<br />
								<button class="success-btn icon-xs" title={i18n.t('admin.btn.markpaid')} onclick={() => doMarkCommission(s, parseFloat(commInputs[s.id]) || 0)}>✓</button>
							{/if}
						</td>

						<!-- Monthly cells -->
						{#each months as m}
							{@const before = isBefore(renter, m.month, m.year)}
							{@const after = isAfterTermination(renter, m.month, m.year)}
							{@const paid = isPaid(s.id, m.month, m.year, 'rent')}
							{@const monthRent = getRentForMonth(s, m.year, m.month)}
							{@const { fraction, label: fracLabel } = fractionForCell(renter, m.month, m.year)}
							{@const amount = (monthRent * fraction).toFixed(2)}
							<td
								class="pay-col"
								class:payment-cell-paid={paid}
								class:payment-cell-unpaid={!paid && !before && !after}
							>
								{#if before || after}
									—
								{:else if paid}
									✓ {paid.paidDate}
									<button class="secondary icon-xs" title={i18n.t('admin.btn.revert')} onclick={() => doRevertRent(paid, m.label, m.year)}>↩</button>
								{:else}
									<div class="amount-hint">€{amount}{fracLabel}</div>
									<button
										class="success-btn icon-xs"
										title={i18n.t('admin.btn.markpaid')}
										onclick={() => doMarkPaid(s, m.month, m.year, parseFloat(amount))}
									>✓</button>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.header-actions {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}
	.year-sel {
		width: auto;
		font-size: 0.85rem;
		padding: 0.25rem 0.5rem;
	}
	.legend {
		display: flex;
		gap: 1rem;
		margin-bottom: 0.75rem;
		font-size: 0.78rem;
	}
	.legend-item {
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
	}
	.paid-sample { background: var(--green-bg); color: var(--green); }
	.unpaid-sample { background: var(--bg-card-hover); color: var(--text-secondary); }
	.comm-sample { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }

	.payment-matrix {
		min-width: 600px;
	}
	.pay-col {
		text-align: center;
		min-width: 72px;
		font-size: 0.78rem;
	}
	.payment-cell-paid {
		background: var(--green-bg);
		color: var(--green);
	}
	.payment-cell-unpaid {
		background: var(--bg-card-hover);
	}
	.amount-hint {
		font-size: 0.72rem;
		color: var(--text-secondary);
		margin-bottom: 0.2rem;
	}
	.renter-cell {
		font-size: 0.82rem;
		min-width: 140px;
	}
	.termination-chip {
		display: inline-block;
		font-size: 0.65rem;
		background: var(--amber-bg);
		color: var(--amber);
		border-radius: var(--radius-sm);
		padding: 0.1rem 0.3rem;
		margin-left: 0.25rem;
	}
	.rent-editor {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		margin-top: 0.25rem;
		font-size: 0.72rem;
	}
	.rent-lbl {
		color: var(--text-secondary);
	}
	.rent-inp-sm {
		width: 70px;
		font-size: 0.75rem;
		padding: 0.1rem 0.25rem;
	}
	.icon-xs {
		font-size: 0.75rem;
		padding: 0.1rem 0.3rem;
		min-height: 0;
		min-width: 0;
		line-height: 1;
	}
</style>
