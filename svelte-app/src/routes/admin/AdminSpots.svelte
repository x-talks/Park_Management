<script lang="ts">
	import { i18n } from '$lib/stores/i18n.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { modalAlert, modalConfirm } from '$lib/stores/modal.svelte';
	import { patchSpot, assignSpot, releaseSpot } from '$lib/api/endpoints';
	import { sortSpots } from '$lib/utils/spots';
	import Chip, { type Variant as ChipVariant } from '$lib/components/Chip.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import type { Spot, User } from '$lib/types';

	interface Props {
		spots: Spot[];
		users: User[];
		onRefresh: () => Promise<void>;
	}

	let { spots, users, onRefresh }: Props = $props();

	const sortedSpots = $derived(sortSpots(spots));
	const activeRenters = $derived(users.filter((u) => u.active && u.role === 'renter'));

	let assignSelect = $state<Record<string, string>>({});
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

	const canEdit = $derived(session.hasRole('admin'));

	const selectClass = "flex h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";
</script>

<Card.Root id="spot-list">
	<Card.Content class="p-0">
		<div class="overflow-x-auto">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{i18n.t('admin.spots.col.spot')}</Table.Head>
						<Table.Head>{i18n.t('admin.spots.col.owned')}</Table.Head>
						<Table.Head>{i18n.t('admin.spots.col.state')}</Table.Head>
						<Table.Head>{i18n.t('admin.spots.col.user')}</Table.Head>
						<Table.Head>{i18n.t('admin.spots.col.plate')}</Table.Head>
						<Table.Head>{i18n.t('admin.spots.col.rent')}</Table.Head>
						<Table.Head>{i18n.t('admin.spots.col.actions')}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each sortedSpots as s (s.id)}
						{@const renter = renterFor(s)}
						{@const rentVal = getRentDisplay(s)}
						{@const _ = initRentInput(s.id, rentVal)}
						<Table.Row>
							<Table.Cell class="font-bold">{s.label}</Table.Cell>
							<Table.Cell class="text-center">
								{#if canEdit}
									<button
										class="bg-none border-none text-base px-1.5 py-0.5 cursor-pointer rounded leading-none {s.owned ? 'text-green-500' : 'text-muted-foreground'}"
										title={s.owned ? 'Mark as not mine' : 'Mark as mine'}
										onclick={() => toggleOwned(s)}
									>{s.owned ? '★' : '☆'}</button>
								{:else}
									<span class={s.owned ? 'text-green-500' : 'text-muted-foreground'}>{s.owned ? '★' : '☆'}</span>
								{/if}
							</Table.Cell>
							<Table.Cell><Chip label={spotChipLabel(s)} variant={spotChipVariant(s)} /></Table.Cell>
							<Table.Cell class="text-sm">{renter ? `${renter.name ?? ''} ${renter.lastName ?? ''}`.trim() || renter.username : '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{renter ? (renter.licensePlate ?? renter.username) : '—'}</Table.Cell>
							<Table.Cell>€{rentVal}</Table.Cell>
							<Table.Cell>
								{#if canEdit}
									<div class="flex flex-wrap gap-1 items-center">
										{#if s.reserved}
											<Button size="sm" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.unreserve')} onclick={() => unreserve(s)}>▶</Button>
										{:else if !s.assignedUserId}
											<select class={selectClass} bind:value={assignSelect[s.id]}>
												<option value="">{i18n.t('admin.spots.user.default')}</option>
												{#each activeRenters as u (u.id)}
													<option value={u.id}>{`${u.name ?? ''} (${u.licensePlate ?? u.username})`.trim()}</option>
												{/each}
											</select>
											<Button size="sm" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.assign')} onclick={() => assign(s)}>✓</Button>
											<Button size="sm" variant="outline" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.reserve')} onclick={() => reserve(s)}>⛔</Button>
										{:else}
											<Button size="sm" variant="outline" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.unassign')} onclick={() => unassign(s)}>👤</Button>
										{/if}
										{#if !s.reserved}
											<input
												type="number"
												min="0"
												step="0.01"
												class="w-[70px] h-8 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50"
												bind:value={rentInputs[s.id]}
												title={i18n.t('admin.btn.setrent')}
												onblur={() => saveRent(s)}
												onkeydown={(e) => onRentKeydown(e, s)}
											/>
										{/if}
									</div>
								{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</Card.Content>
</Card.Root>
