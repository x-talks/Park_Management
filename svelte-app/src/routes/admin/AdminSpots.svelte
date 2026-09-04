<script lang="ts">
	import { i18n } from '$lib/stores/i18n.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { modalAlert, modalConfirm } from '$lib/stores/modal.svelte';
	import { patchSpot, assignSpot, releaseSpot } from '$lib/api/endpoints';
	import { sortSpots } from '$lib/utils/spots';
	import Chip, { type Variant as ChipVariant } from '$lib/components/Chip.svelte';
	import type { Spot, User } from '$lib/types';

	interface Props {
		spots: Spot[];
		users: User[];
		onRefresh: () => Promise<void>;
	}

	let { spots, users, onRefresh }: Props = $props();

	const sortedSpots = $derived(sortSpots(spots));
	const activeRenters = $derived(users.filter((u) => u.active && u.role === 'renter'));

	// Per-row state: selected user ID for assign dropdown
	let assignSelect = $state<Record<string, string>>({});
	// Per-row inline rent input value
	let rentInputs = $state<Record<string, string>>({});

	function renterFor(spot: Spot): User | undefined {
		return users.find((u) => u.id === spot.assignedUserId);
	}

	function spotChipVariant(s: Spot): ChipVariant {
		if (s.reserved) return 'reserved';
		return s.state === 'free' ? 'free' : 'occupied';
	}

	function spotChipLabel(s: Spot): string {
		if (s.reserved) return i18n.t('admin.spots.chip.reserved');
		return s.state === 'free'
			? i18n.t('admin.spots.chip.free')
			: i18n.t('admin.spots.chip.occupied');
	}

	function getRentDisplay(s: Spot): string {
		const v = s.monthlyRent != null ? s.monthlyRent : 80;
		return Number(v).toFixed(2);
	}

	function initRentInput(id: string, val: string) {
		if (!(id in rentInputs)) rentInputs[id] = val;
	}

	async function toggleOwned(s: Spot) {
		try {
			await patchSpot(s.id, { owned: !s.owned });
			await onRefresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Error', 'error');
		}
	}

	async function unreserve(s: Spot) {
		try {
			await patchSpot(s.id, { reserved: false });
			await onRefresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Error', 'error');
		}
	}

	async function reserve(s: Spot) {
		const ok = await modalConfirm(i18n.t('admin.confirm.reserve', s.label));
		if (!ok) return;
		try {
			await patchSpot(s.id, { reserved: true });
			await onRefresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Error', 'error');
		}
	}

	async function assign(s: Spot) {
		const uid = assignSelect[s.id];
		if (!uid) { await modalAlert(i18n.t('admin.alert.selectuser')); return; }
		try {
			await assignSpot(s.id, uid);
			await onRefresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Error', 'error');
		}
	}

	async function unassign(s: Spot) {
		const ok = await modalConfirm(i18n.t('admin.confirm.unassign', s.label), { danger: true });
		if (!ok) return;
		try {
			await releaseSpot(s.id);
			await onRefresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Error', 'error');
		}
	}

	async function saveRent(s: Spot) {
		const raw = rentInputs[s.id];
		const val = parseFloat(raw);
		if (isNaN(val) || val < 0) { await modalAlert(i18n.t('admin.alert.invalidrent')); return; }
		const current = s.monthlyRent != null ? s.monthlyRent : 80;
		if (Math.abs(val - current) < 0.001) return;
		// Store rent change with from = current month
		const now = new Date();
		const fromMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		const newEntry = { from: fromMonth, rent: val };
		const existingHistory = s.rentHistory ?? [];
		const newHistory = [...existingHistory.filter((h) => h.from !== fromMonth), newEntry];
		try {
			await patchSpot(s.id, { monthlyRent: val, rentHistory: newHistory });
			await onRefresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Error', 'error');
		}
	}

	function onRentKeydown(e: KeyboardEvent, s: Spot) {
		if (e.key === 'Enter') {
			e.preventDefault();
			void saveRent(s);
		}
	}

	// Master can see all; admin can see and edit non-master spots
	const canEdit = $derived(session.hasRole('admin'));
</script>

<div class="card">
	<div class="card-header">
		<h2>{i18n.t('nav.spots')}</h2>
	</div>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>{i18n.t('admin.spots.col.spot')}</th>
					<th>{i18n.t('admin.spots.col.owned')}</th>
					<th>{i18n.t('admin.spots.col.state')}</th>
					<th>{i18n.t('admin.spots.col.user')}</th>
					<th>{i18n.t('admin.spots.col.plate')}</th>
					<th>{i18n.t('admin.spots.col.rent')}</th>
					<th>{i18n.t('admin.spots.col.actions')}</th>
				</tr>
			</thead>
			<tbody>
				{#each sortedSpots as s (s.id)}
					{@const renter = renterFor(s)}
					{@const rentVal = getRentDisplay(s)}
					{@const _ = initRentInput(s.id, rentVal)}
					<tr>
						<td>{s.label}</td>
						<td class="cell-center">
							{#if canEdit}
								<button
									class="owned-btn"
									class:active={s.owned}
									title={s.owned ? 'Mark as not mine' : 'Mark as mine'}
									onclick={() => toggleOwned(s)}
								>{s.owned ? '★' : '☆'}</button>
							{:else}
								{s.owned ? '★' : '☆'}
							{/if}
						</td>
						<td><Chip label={spotChipLabel(s)} variant={spotChipVariant(s)} /></td>
						<td>{renter ? `${renter.name ?? ''} ${renter.lastName ?? ''}`.trim() || renter.username : '—'}</td>
						<td>{renter ? (renter.licensePlate ?? renter.username) : '—'}</td>
						<td>€{rentVal}</td>
						<td>
							{#if canEdit}
								<div class="btn-row">
									{#if s.reserved}
										<button class="success-btn icon-sm" title={i18n.t('admin.btn.unreserve')} onclick={() => unreserve(s)}>▶</button>
									{:else if !s.assignedUserId}
										<select
											class="assign-sel"
											bind:value={assignSelect[s.id]}
										>
											<option value="">{i18n.t('admin.spots.user.default')}</option>
											{#each activeRenters as u (u.id)}
												<option value={u.id}>{`${u.name ?? ''} (${u.licensePlate ?? u.username})`.trim()}</option>
											{/each}
										</select>
										<button class="success-btn icon-sm" title={i18n.t('admin.btn.assign')} onclick={() => assign(s)}>✓</button>
										<button class="secondary icon-sm" title={i18n.t('admin.btn.reserve')} onclick={() => reserve(s)}>⛔</button>
									{:else}
										<button class="secondary icon-sm" title={i18n.t('admin.btn.unassign')} onclick={() => unassign(s)}>👤</button>
									{/if}
									{#if !s.reserved}
										<input
											type="number"
											min="0"
											step="0.01"
											class="rent-inp"
											bind:value={rentInputs[s.id]}
											title={i18n.t('admin.btn.setrent')}
											onblur={() => saveRent(s)}
											onkeydown={(e) => onRentKeydown(e, s)}
										/>
									{/if}
								</div>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.cell-center {
		text-align: center;
		vertical-align: middle;
	}
	.owned-btn {
		background: none;
		border: none;
		font-size: 1rem;
		padding: 0.15rem 0.4rem;
		cursor: pointer;
		line-height: 1;
		min-height: 0;
		min-width: 0;
		color: var(--text-primary);
		border-radius: var(--radius-sm);
	}
	.owned-btn.active {
		color: var(--green);
	}
	.assign-sel {
		width: auto;
		font-size: 0.8rem;
		padding: 0.2rem 0.4rem;
	}
	.rent-inp {
		width: 70px;
		font-size: 0.8rem;
		padding: 0.15rem 0.3rem;
		display: inline-block;
	}
	.icon-sm {
		font-size: 0.85rem;
		padding: 0.2rem 0.45rem;
		min-height: 0;
		min-width: 0;
		line-height: 1;
	}
</style>
