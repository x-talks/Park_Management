<script lang="ts">
	import { i18n } from '$lib/stores/i18n.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { modalConfirm } from '$lib/stores/modal.svelte';
	import { createPayment, deletePayment, patchSpot } from '$lib/api/endpoints';
	import { getRentForMonth, getPaymentFraction } from '$lib/utils/payments';
	import { sortSpots } from '$lib/utils/spots';
	import { exportPaymentsCsv } from '$lib/utils/csv';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
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

	const yearOptions = $derived(Array.from({ length: 5 }, (_, i) => currentYear - i));

	const months = $derived.by(() => {
		const maxMonth = selectedYear < currentYear ? 12 : selectedYear === currentYear ? currentMonth : 0;
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

	let rentInputs = $state<Record<string, string>>({});

	function initRentInput(s: Spot) {
		if (!(s.id in rentInputs)) rentInputs[s.id] = (s.monthlyRent ?? 80).toFixed(2);
	}

	function renterFor(s: Spot): User | undefined {
		return users.find((u) => u.id === s.assignedUserId);
	}

	function isPaid(spotId: string, month: number, year: number, type: string): Payment | undefined {
		return payments.find((p) => p.spotId === spotId && p.month === month && p.year === year && p.type === type);
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

	let commInputs = $state<Record<string, string>>({});

	function initCommInput(s: Spot) {
		if (!(s.id in commInputs)) commInputs[s.id] = getRentForMonth(s, selectedYear, 1).toFixed(2);
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

	const selectClass = "h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50";
	const inputSmClass = "w-[70px] h-7 rounded border border-input bg-transparent px-1.5 text-xs focus-visible:ring-[2px] focus-visible:ring-ring/50";
</script>

<Card.Root>
	<Card.Header class="flex-row items-center justify-between space-y-0 pb-3">
		<Card.Title>{i18n.t('admin.pay.title')}</Card.Title>
		<div class="flex items-center gap-2">
			<select id="payment-year" bind:value={selectedYear} class={selectClass}>
				{#each yearOptions as y}
					<option value={y}>{y}</option>
				{/each}
			</select>
			<Button id="csv-export-btn" variant="outline" size="sm" onclick={doExportCsv}>{i18n.t('admin.csv.export')}</Button>
		</div>
	</Card.Header>

	<Card.Content class="p-0">
		<div class="flex gap-3 px-4 pb-3 text-xs">
			<span class="rounded px-2 py-0.5 font-semibold bg-green-500/15 text-green-500">✓ {i18n.t('admin.pay.legend.paid')}</span>
			<span class="rounded px-2 py-0.5 font-semibold bg-muted text-muted-foreground">— {i18n.t('admin.pay.legend.pending')}</span>
			<span class="rounded px-2 py-0.5 font-semibold bg-primary/10 text-primary">{i18n.t('admin.pay.legend.commission')}</span>
		</div>

		<div id="payment-matrix" class="overflow-x-auto">
			<table class="w-full min-w-[600px] border-collapse text-sm">
				<thead>
					<tr class="border-b border-border bg-muted/30">
						<th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{i18n.t('admin.pay.col.spot')}</th>
						<th class="px-3 py-2 text-left text-xs font-medium text-muted-foreground">{i18n.t('admin.pay.col.renter')}</th>
						<th class="px-3 py-2 text-center text-xs font-medium text-muted-foreground min-w-[72px]">{i18n.t('admin.pay.col.commission')}</th>
						{#each months as m}
							<th class="px-2 py-2 text-center text-xs font-medium text-muted-foreground min-w-[72px]">{m.label}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each assignedSpots as s (s.id)}
						{@const renter = renterFor(s)}
						{@const _ = initRentInput(s)}
						{@const _c = initCommInput(s)}
						{@const commPaid = commissionPaid(s.id)}
						<tr class="border-b border-border/50 hover:bg-muted/20">
							<td class="px-3 py-2 font-bold text-sm">Spot {s.label}</td>

							<td class="px-3 py-2 text-xs min-w-[140px]">
								<span>{renter ? `${renter.name ?? ''} ${renter.lastName ?? ''}`.trim() || renter.username : '—'}</span>
								{#if renter?.terminationDate}
									<span class="inline-block text-[0.65rem] bg-amber-500/15 text-amber-500 rounded px-1 ml-1">{i18n.t('admin.users.termination.chip', renter.terminationDate)}</span>
								{/if}
								<div class="flex items-center gap-1 mt-1 text-[0.7rem] text-muted-foreground">
									<span>€/mo:</span>
									<input
										type="number" min="1" step="0.01"
										class={inputSmClass}
										bind:value={rentInputs[s.id]}
										title="Edit monthly rent"
										onblur={() => saveRent(s)}
										onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void saveRent(s); } }}
									/>
								</div>
							</td>

							<td class="px-2 py-2 text-center text-xs {commPaid ? 'bg-green-500/10 text-green-600' : 'bg-muted/30'}">
								{#if commPaid}
									✓ {commPaid.paidDate}
									<button class="text-[0.65rem] ml-1 opacity-60 hover:opacity-100" title={i18n.t('admin.btn.revert')} onclick={() => doRevertCommission(commPaid)}>↩</button>
								{:else}
									<input type="number" min="0" step="0.01" class="{inputSmClass} mb-1" bind:value={commInputs[s.id]} title="Commission amount" /><br />
									<button class="text-[0.7rem] bg-green-500/20 text-green-600 rounded px-1.5 py-0.5 hover:bg-green-500/30" title={i18n.t('admin.btn.markpaid')} onclick={() => doMarkCommission(s, parseFloat(commInputs[s.id]) || 0)}>✓</button>
								{/if}
							</td>

							{#each months as m}
								{@const before = isBefore(renter, m.month, m.year)}
								{@const after = isAfterTermination(renter, m.month, m.year)}
								{@const paid = isPaid(s.id, m.month, m.year, 'rent')}
								{@const monthRent = getRentForMonth(s, m.year, m.month)}
								{@const { fraction, label: fracLabel } = fractionForCell(renter, m.month, m.year)}
								{@const amount = (monthRent * fraction).toFixed(2)}
								<td class="px-2 py-2 text-center text-xs {paid ? 'bg-green-500/10 text-green-600' : !before && !after ? 'bg-muted/20' : ''}">
									{#if before || after}
										—
									{:else if paid}
										✓ {paid.paidDate}
										<button class="text-[0.65rem] ml-1 opacity-60 hover:opacity-100" title={i18n.t('admin.btn.revert')} onclick={() => doRevertRent(paid, m.label, m.year)}>↩</button>
									{:else}
										<div class="text-[0.7rem] text-muted-foreground mb-0.5">€{amount}{fracLabel}</div>
										<button
											class="text-[0.7rem] bg-green-500/20 text-green-600 rounded px-1.5 py-0.5 hover:bg-green-500/30"
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
	</Card.Content>
</Card.Root>
