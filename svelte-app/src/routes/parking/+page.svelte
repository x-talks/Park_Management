<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { getSpots, getUsers, getPayments, getPendingRegistrations } from '$lib/api/supabase';
	import { assignSpot, releaseSpot } from '$lib/api/endpoints';
	import { PollStore } from '$lib/stores/poll';
	import { getRentForMonth, getPaymentFraction } from '$lib/utils/payments';
	import { sortSpots } from '$lib/utils/spots';
	import ParkingMap from './ParkingMap.svelte';
	import Chip, { type Variant as ChipVariant } from '$lib/components/Chip.svelte';
	import type { Spot, User, Payment, PendingRegistration } from '$lib/types';

	let spots = $state<Spot[]>([]);
	let users = $state<User[]>([]);
	let payments = $state<Payment[]>([]);
	let pendingRegs = $state<PendingRegistration[]>([]);

	const pendingSpotIds = $derived(new Set(pendingRegs.map((pr) => pr.spotId)));

	// Sheet state
	let selectedSpotId = $state<string | null>(null);
	let sheetMode = $state<'info' | 'assign'>('info');
	let sheetOpen = $state(false);

	const selectedSpot = $derived(spots.find((s) => s.id === selectedSpotId) ?? null);
	const selectedRenter = $derived(
		selectedSpot?.assignedUserId ? users.find((u) => u.id === selectedSpot.assignedUserId) ?? null : null
	);
	const isAdmin = $derived(session.hasRole('admin'));
	const isMySpot = $derived(!!selectedRenter && selectedRenter.id === session.user?.id);

	const meUser = $derived(users.find((u) => u.id === session.user?.id) ?? null);
	const hasOwnSpot = $derived((meUser?.assignedSpots?.length ?? 0) > 0);

	// Payments section
	const now = new Date();
	const currentYear = now.getFullYear();
	let paymentYear = $state(currentYear);
	const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

	interface MonthRow {
		month: number;
		year: number;
		label: string;
		isFirst: boolean;
		isFuture: boolean;
	}

	function getMonthsForRenter(u: User, year: number): MonthRow[] {
		const regDate = u.registeredAt ? new Date(u.registeredAt) : null;
		const termDate = u.terminationDate ? new Date(u.terminationDate) : null;
		const rows: MonthRow[] = [];
		for (let m = 1; m <= 12; m++) {
			if (regDate) {
				const ry = regDate.getFullYear(), rm = regDate.getMonth() + 1;
				if (year < ry || (year === ry && m < rm)) continue;
			}
			if (termDate) {
				const ty = termDate.getFullYear(), tm = termDate.getMonth() + 1;
				if (year > ty || (year === ty && m > tm)) continue;
			}
			const isFuture = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth() + 1);
			const isFirst = regDate ? (year === regDate.getFullYear() && m === regDate.getMonth() + 1) : false;
			const label = new Date(year, m - 1, 1).toLocaleString('default', { month: 'long' });
			rows.push({ month: m, year, label, isFirst, isFuture });
		}
		return rows;
	}

	async function loadAll() {
		[spots, users, payments, pendingRegs] = await Promise.all([
			getSpots(),
			getUsers(),
			getPayments(),
			getPendingRegistrations()
		]);
	}

	const poll = new PollStore();

	onMount(async () => {
		if (!session.user) { void goto('/'); return; }
		await loadAll();
		poll.start(loadAll);
	});

	onDestroy(() => poll.stop());

	function openSheet(spotId: string) {
		if (selectedSpotId === spotId && sheetOpen) {
			closeSheet();
		} else {
			selectedSpotId = spotId;
			sheetMode = 'info';
			sheetOpen = true;
		}
	}

	function closeSheet() {
		sheetOpen = false;
		selectedSpotId = null;
	}

	async function doRelease() {
		if (!selectedSpot) return;
		try {
			await releaseSpot(selectedSpot.id);
			toast('Spot released', 'success');
			closeSheet();
			await loadAll();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	const assignableUsers = $derived(users.filter((u) => u.active && u.role === 'renter'));

	async function doAssign(userId: string) {
		if (!selectedSpot) return;
		try {
			await assignSpot(selectedSpot.id, userId);
			closeSheet();
			await loadAll();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	function sheetStatusVariant(): ChipVariant {
		if (!selectedSpot) return 'neutral';
		if (selectedSpot.reserved) return 'reserved';
		if (pendingSpotIds.has(selectedSpot.id)) return 'pending';
		return selectedSpot.state === 'occupied' ? 'occupied' : 'free';
	}

	function sheetStatusLabel(): string {
		if (!selectedSpot) return '';
		if (selectedSpot.reserved) return 'Reserved';
		if (pendingSpotIds.has(selectedSpot.id)) return 'Pending';
		return selectedSpot.state === 'occupied' ? 'Occupied' : 'Free';
	}

	function sheetMeta(): string {
		if (!selectedSpot) return '';
		if (selectedSpot.reserved) return 'External reservation — not available';
		if (!selectedRenter) return 'No one assigned';
		if (isAdmin) {
			const name = `${selectedRenter.name ?? ''} ${selectedRenter.lastName ?? ''}`.trim() || selectedRenter.username;
			return `${name} · ${(selectedRenter.licensePlate ?? selectedRenter.username).toUpperCase()}`;
		}
		return isMySpot ? 'Assigned to you' : 'Occupied';
	}

	function scrollToPayments() {
		closeSheet();
		document.getElementById('my-payments-section')?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<div class="parking-page">
	<div class="map-container">
		<ParkingMap
			{spots}
			{users}
			currentUserId={session.user?.id ?? null}
			{pendingSpotIds}
			{selectedSpotId}
			onSpotClick={openSheet}
		/>
	</div>

	<!-- Bottom sheet -->
	{#if sheetOpen && selectedSpot}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="sheet-backdrop" onclick={closeSheet}></div>
		<div class="bottom-sheet open" id="spot-sheet" aria-modal="true" role="dialog">
			<div class="sheet-handle"></div>
			<div id="sheet-content">
				{#if sheetMode === 'info'}
					<div class="sheet-title">
						Spot {selectedSpot.label}
						{#if isMySpot}<span class="my-spot-star">★ {i18n.t('map.my')}</span>{/if}
						<Chip label={sheetStatusLabel()} variant={sheetStatusVariant()} />
					</div>
					<div class="sheet-meta">{sheetMeta()}</div>
					<div class="sheet-actions">
						{#if !isAdmin && selectedSpot.state === 'free' && !selectedSpot.reserved && !hasOwnSpot && !pendingSpotIds.has(selectedSpot.id)}
							<button class="sheet-btn" onclick={closeSheet}>{i18n.t('map.reserve')}</button>
						{/if}
						{#if isMySpot}
							<button class="sheet-btn secondary" onclick={scrollToPayments}>{i18n.t('map.pay')}</button>
						{/if}
						<button class="sheet-btn warn" onclick={() => { closeSheet(); void goto(`/incident?spot=${selectedSpot.id}`); }}>
							⚠ {i18n.t('map.report')}
						</button>
						{#if isAdmin && selectedSpot.state === 'occupied' && selectedSpot.assignedUserId}
							<button class="sheet-btn danger" onclick={doRelease}>{i18n.t('map.release')}</button>
						{/if}
						{#if isAdmin && !selectedSpot.assignedUserId && !selectedSpot.reserved}
							<button class="sheet-btn admin" onclick={() => (sheetMode = 'assign')}>{i18n.t('map.assign')}</button>
						{/if}
					</div>
				{:else}
					<!-- Assign modal content -->
					<div class="sheet-title">Assign Renter</div>
					{#if assignableUsers.length === 0}
						<p class="sheet-empty">No active renters found.</p>
					{:else}
						{#each assignableUsers as u (u.id)}
							<button class="sheet-btn user-btn" onclick={() => doAssign(u.id)}>
								{`${u.name ?? ''} ${u.lastName ?? ''}`.trim() || u.username}  ·  {(u.licensePlate ?? u.username).toUpperCase()}
							</button>
						{/each}
					{/if}
					<button class="sheet-btn secondary" onclick={() => (sheetMode = 'info')}>← Back</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- My payments section -->
	{#if meUser && (meUser.assignedSpots?.length ?? 0) > 0}
		<div id="my-payments-section" class="card payments-card">
			<div class="card-header">
				<h2>{i18n.t('pay.title')}</h2>
				<select bind:value={paymentYear} class="year-sel">
					{#each yearOptions as y}
						<option value={y}>{y}</option>
					{/each}
				</select>
			</div>
			{#if meUser.terminationDate}
				<div class="alert warn">⏹ {i18n.t('pay.termination.notice', meUser.terminationDate)}</div>
			{/if}
			{#each (meUser.assignedSpots ?? []) as sid (sid)}
				{@const spot = spots.find((s) => s.id === sid)}
				{#if spot}
					{@const regDate = meUser.registeredAt}
					{@const commPaid = payments.find((p) => p.spotId === sid && p.type === 'commission')}
					{@const commRent = getRentForMonth(spot, regDate ? new Date(regDate).getFullYear() : paymentYear, regDate ? new Date(regDate).getMonth() + 1 : 1)}
					{@const monthRows = getMonthsForRenter(meUser, paymentYear)}
					<h3 class="spot-title">Spot {spot.label}</h3>
					<div class="table-wrap">
						<table>
							<thead>
								<tr>
									<th>{i18n.t('pay.col.month')}</th>
									<th>{i18n.t('pay.col.amount')}</th>
									<th>{i18n.t('pay.col.status')}</th>
								</tr>
							</thead>
							<tbody>
								<!-- Commission row -->
								<tr class="commission-row">
									<td>
										<strong>{i18n.t('pay.commission')}</strong>
										<span class="pay-desc">{i18n.t('pay.commission.desc')}</span>
									</td>
									<td>€{commRent.toFixed(2)}</td>
									<td>
										<Chip
											label={commPaid ? i18n.t('pay.status.paid', commPaid.paidDate) : i18n.t('pay.status.pending')}
											variant={commPaid ? 'paid' : 'unpaid'}
										/>
									</td>
								</tr>
								<!-- Monthly rows -->
								{#each monthRows as row (row.month)}
									{@const paid = payments.find((p) => p.spotId === sid && p.month === row.month && p.year === row.year && p.type === 'rent')}
									{@const monthRent = getRentForMonth(spot, row.year, row.month)}
									{@const frac = row.isFirst && regDate ? getPaymentFraction(regDate) : { fraction: 1, key: 'full' as const }}
									{@const amount = (monthRent * frac.fraction).toFixed(2)}
									<tr>
										<td>
											{row.label}
											{#if row.isFirst && frac.fraction < 1}
												<span class="pay-fraction">({i18n.t(`pay.fraction.${frac.key}` as Parameters<typeof i18n.t>[0])})</span>
											{/if}
										</td>
										<td>€{amount}</td>
										<td>
											{#if row.isFuture}
												<Chip label={i18n.t('pay.status.future')} variant="neutral" />
											{:else if paid}
												<Chip label={i18n.t('pay.status.paid', paid.paidDate)} variant="paid" />
											{:else}
												<Chip label={i18n.t('pay.status.pending')} variant="unpaid" />
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<style>
	.parking-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding-bottom: 6rem;
	}
	.map-container {
		padding: 0.5rem 0;
	}
	/* Bottom sheet */
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.4);
		z-index: 90;
	}
	.bottom-sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		max-height: 60vh;
		overflow-y: auto;
		background: var(--bg-card);
		border-radius: 16px 16px 0 0;
		padding: 0.75rem 1.25rem 2rem;
		z-index: 100;
		box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.25);
	}
	.sheet-handle {
		width: 36px;
		height: 4px;
		background: var(--border);
		border-radius: 2px;
		margin: 0 auto 0.75rem;
	}
	.sheet-title {
		font-size: 1.1rem;
		font-weight: 800;
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.my-spot-star {
		font-size: 0.75rem;
		color: var(--accent);
		font-weight: 700;
	}
	.sheet-meta {
		font-size: 0.85rem;
		color: var(--text-secondary);
		margin-bottom: 0.75rem;
	}
	.sheet-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.sheet-btn {
		padding: 0.45rem 1rem;
		border-radius: var(--radius);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		border: 1px solid var(--border);
		background: var(--bg-card-hover);
		color: var(--text-primary);
		transition: all var(--transition);
	}
	.sheet-btn:hover { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
	.sheet-btn.secondary { opacity: 0.8; }
	.sheet-btn.warn { background: var(--amber-bg); color: var(--amber); border-color: var(--amber); }
	.sheet-btn.danger { background: var(--red-bg); color: var(--red); border-color: var(--red); }
	.sheet-btn.admin { background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent); border-color: var(--accent); }
	.sheet-btn.user-btn { display: block; width: 100%; text-align: left; margin-bottom: 0.4rem; }
	.sheet-empty { color: var(--text-muted); font-size: 0.85rem; margin: 0.75rem 0; }
	/* Payments */
	.payments-card { margin-top: 0.5rem; }
	.year-sel { width: auto; font-size: 0.85rem; padding: 0.25rem 0.5rem; }
	.spot-title { font-size: 0.95rem; font-weight: 700; margin: 0.75rem 0 0.4rem; }
	.commission-row { background: color-mix(in srgb, var(--accent) 8%, transparent); }
	.pay-desc { font-size: 0.72rem; color: var(--text-muted); margin-left: 0.4rem; }
	.pay-fraction { font-size: 0.75rem; color: var(--text-secondary); margin-left: 0.25rem; }
</style>
