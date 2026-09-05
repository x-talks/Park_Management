<script lang="ts">
	import { i18n } from '$lib/stores/i18n.svelte';
	import { session } from '$lib/stores/session.svelte';
	import { toast } from '$lib/stores/toast.svelte';
	import { modalAlert, modalConfirm, modalPrompt } from '$lib/stores/modal.svelte';
	import {
		patchUser, deleteUser, setPassword, migrateUser,
		createInvite, createUser as apiCreateUser
	} from '$lib/api/endpoints';
	import { approvePending, rejectPending } from '$lib/api/endpoints';
	import { sortSpots } from '$lib/utils/spots';
	import Chip from '$lib/components/Chip.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Table from '$lib/components/ui/table';
	import { Badge } from '$lib/components/ui/badge';
	import type { Spot, User, PendingRegistration } from '$lib/types';
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';

	interface Props {
		spots: Spot[];
		users: User[];
		pendingRegs: PendingRegistration[];
		onRefresh: () => Promise<void>;
	}

	let { spots, users, pendingRegs, onRefresh }: Props = $props();

	const now = new Date();

	const activeRenters = $derived(users.filter((u) => u.active && u.role === 'renter'));
	const occupiedOwned = $derived(spots.filter((s) => s.assignedUserId && s.owned));
	const pendingEditsCount = $derived(users.filter((u) => u.pendingEdits).length);
	const pendingActionsCount = $derived(pendingRegs.length + pendingEditsCount);

	let expandedEdit = $state<string | null>(null);
	let editFields = $state<Record<string, Record<string, string>>>({});

	function initEditFields(u: User) {
		if (!editFields[u.id]) {
			editFields[u.id] = {
				name: u.name ?? '',
				lastName: u.lastName ?? '',
				phone: u.phone ?? '',
				address: u.address ?? '',
				licensePlate: u.licensePlate ?? u.username,
				carModel: u.carModel ?? '',
				carColor: u.carColor ?? ''
			};
		}
	}

	function toggleEdit(uid: string) {
		expandedEdit = expandedEdit === uid ? null : uid;
	}

	let inviteName = $state('');
	let inviteLastName = $state('');
	let invitePhone = $state('');
	let inviteAddress = $state('');
	let inviteSpotId = $state('');
	let inviteRent = $state('80');
	let invitePlate = $state('');
	let inviteModel = $state('');
	let inviteColor = $state('');
	let inviteLoading = $state(false);
	let inviteResult = $state<{ url: string; waLink: string } | null>(null);

	let dcName = $state('');
	let dcLastName = $state('');
	let dcPhone = $state('');
	let dcAddress = $state('');
	let dcPlate = $state('');
	let dcPassword = $state('');
	let dcSpotId = $state('');
	let dcRent = $state('80');
	let dcModel = $state('');
	let dcColor = $state('');
	let dcLoading = $state(false);
	let dcResult = $state<string | null>(null);

	const freeSpots = $derived(sortSpots(spots).filter((s) => !s.assignedUserId && !s.reserved));

	function onInviteSpotChange() {
		const s = freeSpots.find((sp) => sp.id === inviteSpotId);
		if (s) inviteRent = String(s.monthlyRent ?? 80);
	}

	function onDcSpotChange() {
		const s = freeSpots.find((sp) => sp.id === dcSpotId);
		if (s) dcRent = String(s.monthlyRent ?? 80);
	}

	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let chartInstance: Chart | null = null;

	$effect(() => {
		if (!chartCanvas) return;
		const total = spots.length;
		const occupied = spots.filter((s) => s.state === 'occupied').length;
		const reserved = spots.filter((s) => s.reserved).length;
		const free = total - occupied - reserved;

		if (chartInstance) chartInstance.destroy();
		chartInstance = new Chart(chartCanvas, {
			type: 'doughnut',
			data: {
				labels: ['Occupied', 'Reserved', 'Free'],
				datasets: [{
					data: [occupied, reserved, free],
					backgroundColor: ['#22c55e', '#f59e0b', '#64748b'],
					borderWidth: 0
				}]
			},
			options: {
				responsive: false,
				plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } }
			}
		});
		return () => { chartInstance?.destroy(); chartInstance = null; };
	});

	function spotLabelFor(spotId: string) {
		const s = spots.find((sp) => sp.id === spotId);
		return s ? `Spot ${s.label}` : spotId;
	}

	async function toggleActive(u: User) {
		try {
			await patchUser(u.id, { active: !u.active });
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doResetPw(u: User) {
		const pw = await modalPrompt(i18n.t('admin.prompt.resetpw', u.licensePlate ?? u.username), { placeholder: 'new password' });
		if (!pw) return;
		try {
			await setPassword(u.id, pw);
			toast('Password reset.', 'success');
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doSetTermination(u: User) {
		const d = await modalPrompt(
			i18n.t('admin.prompt.termination', u.licensePlate ?? u.username),
			{ defaultValue: u.terminationDate ?? '', placeholder: 'YYYY-MM-DD or leave empty' }
		);
		if (d === null) return;
		try {
			await patchUser(u.id, { terminationDate: d.trim() || null });
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doApprovePendingEdit(u: User) {
		if (!u.pendingEdits) return;
		const ok = await modalConfirm(i18n.t('admin.confirm.approve', u.licensePlate ?? u.username));
		if (!ok) return;
		try {
			await patchUser(u.id, { ...u.pendingEdits, pendingEdits: null });
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doRejectPendingEdit(u: User) {
		try {
			await patchUser(u.id, { pendingEdits: null });
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doMigrateUser(u: User) {
		try {
			const res = await migrateUser(u.id);
			await modalAlert(`Auth created.\nEmail: ${res?.email ?? ''}\nTemp password: ${res?.tempPassword ?? ''}`);
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doDeleteUser(u: User) {
		const ok = await modalConfirm(i18n.t('admin.confirm.delete', u.licensePlate ?? u.username), { danger: true });
		if (!ok) return;
		try {
			await deleteUser(u.id);
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function saveEditRow(u: User) {
		const f = editFields[u.id];
		if (!f) return;
		try {
			await patchUser(u.id, { ...f });
			expandedEdit = null;
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doApprovePending(pr: PendingRegistration) {
		try {
			await approvePending(pr.id);
			toast(i18n.t('admin.pr.approve') + ' ✓', 'success');
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	async function doRejectPending(pr: PendingRegistration) {
		const ok = await modalConfirm(i18n.t('admin.pr.confirm.reject'), { danger: true });
		if (!ok) return;
		try {
			await rejectPending(pr.id);
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	const WORKER_URL = import.meta.env.VITE_WORKER_URL as string;
	const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
	const BASE = import.meta.env.BASE_URL ?? '';

	async function submitInvite(e: SubmitEvent) {
		e.preventDefault();
		inviteLoading = true;
		inviteResult = null;
		try {
			const res = await createInvite({
				name: inviteName, lastName: inviteLastName, phone: invitePhone,
				address: inviteAddress, spotId: inviteSpotId,
				licensePlate: invitePlate || null, carModel: inviteModel || null,
				carColor: inviteColor || null, monthlyRent: parseFloat(inviteRent) || 80
			});
			if (!res) throw new Error('No response');
			const url = `${ORIGIN}${BASE}register?token=${res.token}`;
			const waText = encodeURIComponent(
				`Hallo ${inviteName},\n\nHier ist dein Einladungslink zur Parkplatzverwaltung:\n${url}\n\nBitte registriere dich innerhalb von 7 Tagen.`
			);
			inviteResult = { url, waLink: `https://wa.me/?text=${waText}` };
			toast(i18n.t('admin.create.success'), 'success');
			inviteName = ''; inviteLastName = ''; invitePhone = ''; inviteAddress = '';
			inviteSpotId = ''; inviteRent = '80'; invitePlate = ''; inviteModel = ''; inviteColor = '';
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
		finally { inviteLoading = false; }
	}

	async function submitDirect(e: SubmitEvent) {
		e.preventDefault();
		dcLoading = true;
		dcResult = null;
		const plate = dcPlate.trim().toUpperCase();
		try {
			await apiCreateUser({
				name: dcName, lastName: dcLastName, phone: dcPhone, address: dcAddress,
				licensePlate: plate, password: dcPassword,
				spotId: dcSpotId || undefined, monthlyRent: parseFloat(dcRent) || 80,
				carModel: dcModel || undefined, carColor: dcColor || undefined
			});
			dcResult = `✓ User created. Username: ${plate} · Password: ${dcPassword}`;
			dcName = ''; dcLastName = ''; dcPhone = ''; dcAddress = ''; dcPlate = '';
			dcPassword = ''; dcSpotId = ''; dcRent = '80'; dcModel = ''; dcColor = '';
			await onRefresh();
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
		finally { dcLoading = false; }
	}

	const lastUpdated = $derived(i18n.t('admin.users.updated', new Date().toLocaleTimeString()));

	const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring";
</script>

<!-- Stat cards -->
<div class="grid grid-cols-3 gap-3 mb-4">
	<StatCard label={i18n.t('admin.stat.renters')} value={String(activeRenters.length)} color="blue" />
	<StatCard label={i18n.t('admin.stat.occupied')} value={`${occupiedOwned.length}/${spots.filter(s=>s.owned).length}`} color="green" />
	<StatCard label={i18n.t('admin.stat.pending')} value={String(pendingActionsCount)} color={pendingActionsCount > 0 ? 'red' : 'green'} />
</div>

<!-- Occupancy chart -->
<Card.Root class="mb-4 max-w-xs">
	<Card.Header class="pb-2">
		<Card.Title class="text-xs uppercase tracking-widest text-muted-foreground">{i18n.t('admin.chart.title')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<canvas bind:this={chartCanvas} height={160} style="max-width:100%"></canvas>
	</Card.Content>
</Card.Root>

<!-- Pending registrations -->
{#if pendingRegs.length > 0}
<Card.Root id="pending-reg-list" class="mb-4">
	<Card.Header class="flex-row items-center justify-between space-y-0 pb-3">
		<Card.Title>{i18n.t('admin.pr.title')}</Card.Title>
		<Badge variant="destructive">{pendingRegs.length}</Badge>
	</Card.Header>
	<Card.Content class="p-0">
		<div class="overflow-x-auto">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{i18n.t('admin.pr.col.submitted')}</Table.Head>
						<Table.Head>{i18n.t('admin.pr.col.name')}</Table.Head>
						<Table.Head>{i18n.t('admin.pr.col.plate')}</Table.Head>
						<Table.Head>{i18n.t('admin.pr.col.spot')}</Table.Head>
						<Table.Head>{i18n.t('admin.pr.col.car')}</Table.Head>
						<Table.Head>{i18n.t('admin.pr.col.actions')}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each pendingRegs as pr (pr.id)}
						<Table.Row>
							<Table.Cell class="text-xs">{new Date(pr.submittedAt).toLocaleString()}</Table.Cell>
							<Table.Cell>{`${pr.name ?? ''} ${pr.lastName ?? ''}`.trim() || '—'}</Table.Cell>
							<Table.Cell>{pr.licensePlate ?? '—'}</Table.Cell>
							<Table.Cell>{spotLabelFor(pr.spotId)}</Table.Cell>
							<Table.Cell class="text-xs">{pr.carModel ? `${pr.carModel} / ${pr.carColor ?? '?'}` : '—'}</Table.Cell>
							<Table.Cell>
								<div class="flex gap-1">
									<Button size="sm" class="h-7 px-2 text-xs" onclick={() => doApprovePending(pr)}>✓</Button>
									<Button size="sm" variant="outline" class="h-7 px-2 text-xs" onclick={() => doRejectPending(pr)}>✕</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</Card.Content>
</Card.Root>
{/if}

<!-- User list -->
<Card.Root id="user-list" class="mb-4">
	<Card.Header class="flex-row items-center justify-between space-y-0 pb-3">
		<Card.Title>{i18n.t('admin.users.title')}</Card.Title>
		<span class="text-xs text-muted-foreground">{lastUpdated}</span>
	</Card.Header>
	<Card.Content class="p-0">
		<div class="overflow-x-auto">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{i18n.t('admin.users.col.plate')}</Table.Head>
						<Table.Head>{i18n.t('admin.users.col.name')}</Table.Head>
						<Table.Head>{i18n.t('admin.users.col.phone')}</Table.Head>
						<Table.Head>{i18n.t('admin.users.col.spots')}</Table.Head>
						<Table.Head>{i18n.t('admin.users.col.car')}</Table.Head>
						<Table.Head>{i18n.t('admin.users.col.pw')}</Table.Head>
						<Table.Head>{i18n.t('admin.users.col.status')}</Table.Head>
						<Table.Head>{i18n.t('admin.users.col.actions')}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each users as u (u.id)}
						{@const isMaster = u.role === 'master'}
						{@const spotLabels = (u.assignedSpots ?? []).map(sid => {
							const s = spots.find(x => x.id === sid);
							return s ? s.label : sid;
						}).join(', ') || '—'}
						<Table.Row class={u.pendingEdits ? 'bg-amber-500/5' : ''}>
							<Table.Cell class="font-mono text-xs">{u.licensePlate ?? u.username}</Table.Cell>
							<Table.Cell>{`${u.name ?? ''} ${u.lastName ?? ''}`.trim() || '—'}</Table.Cell>
							<Table.Cell class="text-xs">{u.phone ?? '—'}</Table.Cell>
							<Table.Cell class="text-xs">{spotLabels}</Table.Cell>
							<Table.Cell class="text-xs">{u.carModel ? `${u.carModel} / ${u.carColor ?? '?'}` : '—'}</Table.Cell>
							<Table.Cell class="font-mono text-xs">{u.lastPassword ?? '—'}</Table.Cell>
							<Table.Cell>
								<div class="flex flex-wrap gap-1">
									<Chip label={u.active ? i18n.t('admin.users.chip.active') : i18n.t('admin.users.chip.inactive')} variant={u.active ? 'active' : 'inactive'} />
									{#if u.terminationDate}
										<span class="termination-chip" title="Contract ends: {u.terminationDate}">
											{i18n.t('admin.users.termination.chip', u.terminationDate)}
										</span>
									{/if}
									{#if u.pendingEdits}
										<Chip label={i18n.t('admin.users.chip.pending')} variant="warn" />
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell>
								{#if !isMaster}
									<div class="flex flex-wrap gap-1">
										<Button variant="outline" size="sm" class="h-7 px-2 text-xs" title={u.active ? i18n.t('admin.btn.deactivate') : i18n.t('admin.btn.activate')} onclick={() => toggleActive(u)}>
											{u.active ? '■' : '▶'}
										</Button>
										<Button variant="outline" size="sm" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.edit')} onclick={() => { initEditFields(u); toggleEdit(u.id); }}>~</Button>
										<Button variant="outline" size="sm" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.resetpw')} onclick={() => doResetPw(u)}>🔑</Button>
										<Button variant="outline" size="sm" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.termination')} onclick={() => doSetTermination(u)}>✂</Button>
										{#if u.pendingEdits}
											{@const { requestedAt: _r, ...changes } = u.pendingEdits}
											<div class="w-full text-xs text-amber-500 my-1">
												{Object.entries(changes).map(([k, v]) => `${k}: ${(u as unknown as Record<string,unknown>)[k] ?? '—'} → ${v}`).join(' · ')}
											</div>
											<Button size="sm" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.approve')} onclick={() => doApprovePendingEdit(u)}>✓</Button>
											<Button variant="outline" size="sm" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.reject')} onclick={() => doRejectPendingEdit(u)}>✕</Button>
										{/if}
										{#if !u.authId}
											<Button variant="outline" size="sm" class="h-7 px-2 text-xs text-amber-500" title="Fix Auth" onclick={() => doMigrateUser(u)}>⚠</Button>
										{/if}
										<Button variant="destructive" size="sm" class="h-7 px-2 text-xs" title={i18n.t('admin.btn.delete')} onclick={() => doDeleteUser(u)}>🗑</Button>
									</div>
								{/if}
							</Table.Cell>
						</Table.Row>
						{#if expandedEdit === u.id && !isMaster}
							{@const f = editFields[u.id]}
							<Table.Row>
								<Table.Cell colspan={8} class="bg-muted/30 p-4">
									<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-3">
										{#each [['First Name','name'],['Last Name','lastName'],['Phone','phone'],['Address','address'],['License Plate','licensePlate'],['Car Model','carModel'],['Car Color','carColor']] as [lbl, key]}
											<div class="space-y-1">
												<Label for="ef-{u.id}-{key}" class="text-xs">{lbl}</Label>
												<Input id="ef-{u.id}-{key}" bind:value={f[key]} class="h-8 text-sm" />
											</div>
										{/each}
									</div>
									<div class="flex gap-2">
										<Button size="sm" onclick={() => saveEditRow(u)}>{i18n.t('admin.btn.save')}</Button>
										<Button size="sm" variant="outline" onclick={() => (expandedEdit = null)}>{i18n.t('admin.btn.cancel')}</Button>
									</div>
								</Table.Cell>
							</Table.Row>
						{/if}
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</Card.Content>
</Card.Root>

<!-- Invite form -->
<Card.Root class="mb-4">
	<Card.Header>
		<Card.Title>{i18n.t('admin.create.title')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<form onsubmit={submitInvite} class="space-y-4">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="space-y-1.5">
					<Label for="cu-fname">{i18n.t('admin.create.label.fname')}</Label>
					<Input id="cu-fname" bind:value={inviteName} required />
				</div>
				<div class="space-y-1.5">
					<Label for="cu-lname">{i18n.t('admin.create.label.lname')}</Label>
					<Input id="cu-lname" bind:value={inviteLastName} required />
				</div>
				<div class="space-y-1.5">
					<Label for="cu-phone">{i18n.t('admin.create.label.phone')}</Label>
					<Input id="cu-phone" bind:value={invitePhone} required />
				</div>
				<div class="space-y-1.5">
					<Label for="cu-address">{i18n.t('admin.create.label.address')}</Label>
					<Input id="cu-address" bind:value={inviteAddress} required />
				</div>
				<div class="space-y-1.5">
					<Label for="cu-spot">{i18n.t('admin.create.label.spot')} <span class="text-xs text-muted-foreground">{i18n.t('admin.create.spot.hint')}</span></Label>
					<select id="cu-spot" bind:value={inviteSpotId} onchange={onInviteSpotChange} required class={selectClass}>
						<option value="">{i18n.t('admin.create.spot.default')}</option>
						{#each freeSpots as s (s.id)}
							<option value={s.id}>Spot {s.label}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5">
					<Label for="cu-rent">{i18n.t('admin.create.label.rent')} <span class="text-xs text-muted-foreground">{i18n.t('admin.create.rent.hint')}</span></Label>
					<Input id="cu-rent" type="number" min="1" step="0.01" bind:value={inviteRent} />
				</div>
			</div>
			<p class="text-xs text-muted-foreground">{i18n.t('admin.create.car.note')}</p>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<div class="space-y-1.5">
					<Label for="cu-plate">{i18n.t('admin.create.label.plate')}</Label>
					<Input id="cu-plate" bind:value={invitePlate} class="uppercase" />
				</div>
				<div class="space-y-1.5">
					<Label for="cu-model">{i18n.t('admin.create.label.model')}</Label>
					<Input id="cu-model" bind:value={inviteModel} />
				</div>
				<div class="space-y-1.5">
					<Label for="cu-color">{i18n.t('admin.create.label.color')}</Label>
					<Input id="cu-color" bind:value={inviteColor} />
				</div>
			</div>
			<Button type="submit" disabled={inviteLoading}>
				{inviteLoading ? i18n.t('admin.create.btn.loading') : i18n.t('admin.create.btn')}
			</Button>
		</form>
		{#if inviteResult}
			<div class="mt-4 rounded-md border border-green-500/30 bg-green-500/10 p-3 space-y-2">
				<strong class="text-sm">{i18n.t('admin.invite.label')}</strong>
				<code class="block font-mono text-xs break-all bg-background rounded px-2 py-1">{inviteResult.url}</code>
				<a href={inviteResult.waLink} target="_blank" rel="noopener">
					<Button variant="outline" size="sm">{i18n.t('admin.invite.wa')}</Button>
				</a>
			</div>
		{/if}
	</Card.Content>
</Card.Root>

<!-- Direct create form -->
<Card.Root id="direct-create-section">
	<Card.Header>
		<Card.Title>{i18n.t('admin.direct.title')}</Card.Title>
		<p class="text-xs text-muted-foreground">{i18n.t('admin.direct.note')}</p>
	</Card.Header>
	<Card.Content>
		<form onsubmit={submitDirect} class="space-y-4">
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div class="space-y-1.5">
					<Label for="dc-fname">{i18n.t('admin.create.label.fname')}</Label>
					<Input id="dc-fname" bind:value={dcName} required />
				</div>
				<div class="space-y-1.5">
					<Label for="dc-lname">{i18n.t('admin.create.label.lname')}</Label>
					<Input id="dc-lname" bind:value={dcLastName} required />
				</div>
				<div class="space-y-1.5">
					<Label for="dc-phone">{i18n.t('admin.create.label.phone')}</Label>
					<Input id="dc-phone" bind:value={dcPhone} required />
				</div>
				<div class="space-y-1.5">
					<Label for="dc-address">{i18n.t('admin.create.label.address')}</Label>
					<Input id="dc-address" bind:value={dcAddress} required />
				</div>
				<div class="space-y-1.5">
					<Label for="dc-plate">License Plate *</Label>
					<Input id="dc-plate" bind:value={dcPlate} class="uppercase" required />
				</div>
				<div class="space-y-1.5">
					<Label for="dc-password">{i18n.t('admin.create.label.password')}</Label>
					<Input id="dc-password" type="password" bind:value={dcPassword} minlength="8" required autocomplete="new-password" />
				</div>
				<div class="space-y-1.5">
					<Label for="dc-spot">Spot (optional)</Label>
					<select id="dc-spot" bind:value={dcSpotId} onchange={onDcSpotChange} class={selectClass}>
						<option value="">{i18n.t('admin.direct.spot.optional')}</option>
						{#each freeSpots as s (s.id)}
							<option value={s.id}>Spot {s.label}</option>
						{/each}
					</select>
				</div>
				<div class="space-y-1.5">
					<Label for="dc-rent">{i18n.t('admin.create.label.rent')}</Label>
					<Input id="dc-rent" type="number" min="1" step="0.01" bind:value={dcRent} />
				</div>
			</div>
			<Button type="submit" disabled={dcLoading}>
				{dcLoading ? i18n.t('admin.create.btn.loading') : i18n.t('admin.direct.btn')}
			</Button>
		</form>
		{#if dcResult}
			<div class="mt-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm">{dcResult}</div>
		{/if}
	</Card.Content>
</Card.Root>

<style>
	.termination-chip {
		display: inline-block;
		font-size: 0.65rem;
		background: color-mix(in srgb, var(--amber) 15%, transparent);
		color: var(--amber);
		border-radius: var(--radius-sm);
		padding: 0.1rem 0.4rem;
		margin-left: 0.25rem;
	}
</style>
