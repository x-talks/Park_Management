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

	// ── Stat cards ────────────────────────────────────────────────────────────
	const now = new Date();
	const curMonth = now.getMonth() + 1;
	const curYear = now.getFullYear();

	const activeRenters = $derived(users.filter((u) => u.active && u.role === 'renter'));
	const occupiedOwned = $derived(spots.filter((s) => s.assignedUserId && s.owned));
	const pendingEditsCount = $derived(users.filter((u) => u.pendingEdits).length);
	const pendingActionsCount = $derived(pendingRegs.length + pendingEditsCount);

	// ── Inline edit expansion ─────────────────────────────────────────────────
	let expandedEdit = $state<string | null>(null);

	// editFields[userId][fieldKey] = value
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

	// ── Invite form ───────────────────────────────────────────────────────────
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

	// ── Direct-create form ────────────────────────────────────────────────────
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

	// Update rent when spot changes
	function onInviteSpotChange() {
		const s = freeSpots.find((sp) => sp.id === inviteSpotId);
		if (s) inviteRent = String(s.monthlyRent ?? 80);
	}

	function onDcSpotChange() {
		const s = freeSpots.find((sp) => sp.id === dcSpotId);
		if (s) dcRent = String(s.monthlyRent ?? 80);
	}

	// ── Chart ──────────────────────────────────────────────────────────────────
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

	// ── Pending-reg helpers ────────────────────────────────────────────────────
	function spotLabelFor(spotId: string) {
		const s = spots.find((sp) => sp.id === spotId);
		return s ? `Spot ${s.label}` : spotId;
	}

	// ── User action helpers ────────────────────────────────────────────────────
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

	// ── Pending regs ───────────────────────────────────────────────────────────
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

	// ── Invite submit ──────────────────────────────────────────────────────────
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

	// ── Direct create submit ──────────────────────────────────────────────────
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
</script>

<!-- Stat cards -->
<div class="stat-grid">
	<StatCard label={i18n.t('admin.stat.renters')} value={String(activeRenters.length)} color="blue" />
	<StatCard label={i18n.t('admin.stat.occupied')} value={`${occupiedOwned.length}/${spots.filter(s=>s.owned).length}`} color="green" />
	<StatCard label={i18n.t('admin.stat.pending')} value={String(pendingActionsCount)} color={pendingActionsCount > 0 ? 'red' : 'green'} />
</div>

<!-- Occupancy chart -->
<div class="card chart-card">
	<h3 class="card-title">{i18n.t('admin.chart.title')}</h3>
	<canvas bind:this={chartCanvas} height={160} style="max-width:100%"></canvas>
</div>

<!-- Pending registrations -->
{#if pendingRegs.length > 0}
<div class="card">
	<div class="card-header">
		<h2>{i18n.t('admin.pr.title')}</h2>
		<span class="badge badge-warn">{pendingRegs.length}</span>
	</div>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>{i18n.t('admin.pr.col.submitted')}</th>
					<th>{i18n.t('admin.pr.col.name')}</th>
					<th>{i18n.t('admin.pr.col.plate')}</th>
					<th>{i18n.t('admin.pr.col.spot')}</th>
					<th>{i18n.t('admin.pr.col.car')}</th>
					<th>{i18n.t('admin.pr.col.actions')}</th>
				</tr>
			</thead>
			<tbody>
				{#each pendingRegs as pr (pr.id)}
					<tr>
						<td>{new Date(pr.submittedAt).toLocaleString()}</td>
						<td>{`${pr.name ?? ''} ${pr.lastName ?? ''}`.trim() || '—'}</td>
						<td>{pr.licensePlate ?? '—'}</td>
						<td>{spotLabelFor(pr.spotId)}</td>
						<td>{pr.carModel ? `${pr.carModel} / ${pr.carColor ?? '?'}` : '—'}</td>
						<td>
							<div class="btn-row">
								<button class="success-btn icon-sm" title={i18n.t('admin.pr.approve')} onclick={() => doApprovePending(pr)}>✓</button>
								<button class="secondary icon-sm" title={i18n.t('admin.pr.reject')} onclick={() => doRejectPending(pr)}>✕</button>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
{/if}

<!-- User list -->
<div class="card">
	<div class="card-header">
		<h2>{i18n.t('admin.users.title')}</h2>
		<span class="last-refresh">{lastUpdated}</span>
	</div>
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>{i18n.t('admin.users.col.plate')}</th>
					<th>{i18n.t('admin.users.col.name')}</th>
					<th>{i18n.t('admin.users.col.phone')}</th>
					<th>{i18n.t('admin.users.col.spots')}</th>
					<th>{i18n.t('admin.users.col.car')}</th>
					<th>{i18n.t('admin.users.col.pw')}</th>
					<th>{i18n.t('admin.users.col.status')}</th>
					<th>{i18n.t('admin.users.col.actions')}</th>
				</tr>
			</thead>
			<tbody>
				{#each users as u (u.id)}
					{@const isMaster = u.role === 'master'}
					{@const spotLabels = (u.assignedSpots ?? []).map(sid => {
						const s = spots.find(x => x.id === sid);
						return s ? s.label : sid;
					}).join(', ') || '—'}
					<tr class:pending-row={u.pendingEdits}>
						<td>{u.licensePlate ?? u.username}</td>
						<td>{`${u.name ?? ''} ${u.lastName ?? ''}`.trim() || '—'}</td>
						<td>{u.phone ?? '—'}</td>
						<td>{spotLabels}</td>
						<td>{u.carModel ? `${u.carModel} / ${u.carColor ?? '?'}` : '—'}</td>
						<td class="pw-cell">{u.lastPassword ?? '—'}</td>
						<td>
							<Chip label={u.active ? i18n.t('admin.users.chip.active') : i18n.t('admin.users.chip.inactive')} variant={u.active ? 'active' : 'inactive'} />
							{#if u.terminationDate}
								<span class="termination-chip" title="Contract ends: {u.terminationDate}">
									{i18n.t('admin.users.termination.chip', u.terminationDate)}
								</span>
							{/if}
							{#if u.pendingEdits}
								<Chip label={i18n.t('admin.users.chip.pending')} variant="warn" />
							{/if}
						</td>
						<td>
							{#if !isMaster}
								<div class="btn-row action-wrap">
									<button class="secondary icon-sm" title={u.active ? i18n.t('admin.btn.deactivate') : i18n.t('admin.btn.activate')} onclick={() => toggleActive(u)}>
										{u.active ? '■' : '▶'}
									</button>
									<button class="secondary icon-sm" title={i18n.t('admin.btn.edit')} onclick={() => { initEditFields(u); toggleEdit(u.id); }}>~</button>
									<button class="secondary icon-sm" title={i18n.t('admin.btn.resetpw')} onclick={() => doResetPw(u)}>🔑</button>
									<button class="secondary icon-sm" title={i18n.t('admin.btn.termination')} onclick={() => doSetTermination(u)}>✂</button>
									{#if u.pendingEdits}
										{@const { requestedAt: _r, ...changes } = u.pendingEdits}
										<div class="pending-diff">
											{Object.entries(changes).map(([k, v]) => `${k}: ${(u as unknown as Record<string,unknown>)[k] ?? '—'} → ${v}`).join(' · ')}
										</div>
										<button class="success-btn icon-sm" title={i18n.t('admin.btn.approve')} onclick={() => doApprovePendingEdit(u)}>✓</button>
										<button class="secondary icon-sm" title={i18n.t('admin.btn.reject')} onclick={() => doRejectPendingEdit(u)}>✕</button>
									{/if}
									{#if !u.authId}
										<button class="warning-btn icon-sm" title="Fix Auth" onclick={() => doMigrateUser(u)}>⚠</button>
									{/if}
									<button class="danger icon-sm" title={i18n.t('admin.btn.delete')} onclick={() => doDeleteUser(u)}>🗑</button>
								</div>
							{/if}
						</td>
					</tr>
					<!-- Inline edit row -->
					{#if expandedEdit === u.id && !isMaster}
						{@const f = editFields[u.id]}
						<tr class="edit-row">
							<td colspan="8">
								<div class="edit-row-inner">
									<div class="edit-grid">
										{#each [['First Name','name'],['Last Name','lastName'],['Phone','phone'],['Address','address'],['License Plate','licensePlate'],['Car Model','carModel'],['Car Color','carColor']] as [lbl, key]}
											<div class="form-group">
												<label for="ef-{u.id}-{key}">{lbl}</label>
												<input id="ef-{u.id}-{key}" bind:value={f[key]} />
											</div>
										{/each}
									</div>
									<div class="btn-row" style="margin-top:0.5rem">
										<button class="success-btn" onclick={() => saveEditRow(u)}>{i18n.t('admin.btn.save')}</button>
										<button class="secondary" onclick={() => (expandedEdit = null)}>{i18n.t('admin.btn.cancel')}</button>
									</div>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
</div>

<!-- Invite form -->
<div class="card">
	<div class="card-header"><h2>{i18n.t('admin.create.title')}</h2></div>
	<form onsubmit={submitInvite}>
		<div class="grid-2">
			<div class="form-group">
				<label for="cu-fname">{i18n.t('admin.create.label.fname')}</label>
				<input id="cu-fname" bind:value={inviteName} required />
			</div>
			<div class="form-group">
				<label for="cu-lname">{i18n.t('admin.create.label.lname')}</label>
				<input id="cu-lname" bind:value={inviteLastName} required />
			</div>
			<div class="form-group">
				<label for="cu-phone">{i18n.t('admin.create.label.phone')}</label>
				<input id="cu-phone" bind:value={invitePhone} required />
			</div>
			<div class="form-group">
				<label for="cu-address">{i18n.t('admin.create.label.address')}</label>
				<input id="cu-address" bind:value={inviteAddress} required />
			</div>
			<div class="form-group">
				<label for="cu-spot">{i18n.t('admin.create.label.spot')} <small class="hint">{i18n.t('admin.create.spot.hint')}</small></label>
				<select id="cu-spot" bind:value={inviteSpotId} onchange={onInviteSpotChange} required>
					<option value="">{i18n.t('admin.create.spot.default')}</option>
					{#each freeSpots as s (s.id)}
						<option value={s.id}>Spot {s.label}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="cu-rent">{i18n.t('admin.create.label.rent')} <small class="hint">{i18n.t('admin.create.rent.hint')}</small></label>
				<input id="cu-rent" type="number" min="1" step="0.01" bind:value={inviteRent} />
			</div>
		</div>
		<p class="form-note">{i18n.t('admin.create.car.note')}</p>
		<div class="grid-2">
			<div class="form-group">
				<label for="cu-plate">{i18n.t('admin.create.label.plate')}</label>
				<input id="cu-plate" bind:value={invitePlate} style="text-transform:uppercase" />
			</div>
			<div class="form-group">
				<label for="cu-model">{i18n.t('admin.create.label.model')}</label>
				<input id="cu-model" bind:value={inviteModel} />
			</div>
			<div class="form-group">
				<label for="cu-color">{i18n.t('admin.create.label.color')}</label>
				<input id="cu-color" bind:value={inviteColor} />
			</div>
		</div>
		<button type="submit" disabled={inviteLoading}>
			{inviteLoading ? i18n.t('admin.create.btn.loading') : i18n.t('admin.create.btn')}
		</button>
	</form>
	{#if inviteResult}
		<div class="invite-result-box">
			<strong>{i18n.t('admin.invite.label')}</strong>
			<code class="invite-url">{inviteResult.url}</code>
			<div class="btn-row" style="margin-top:0.5rem">
				<a href={inviteResult.waLink} target="_blank" rel="noopener" class="button secondary">{i18n.t('admin.invite.wa')}</a>
			</div>
		</div>
	{/if}
</div>

<!-- Direct create form -->
<div class="card">
	<div class="card-header"><h2>{i18n.t('admin.direct.title')}</h2></div>
	<p class="form-note">{i18n.t('admin.direct.note')}</p>
	<form onsubmit={submitDirect}>
		<div class="grid-2">
			<div class="form-group">
				<label for="dc-fname">{i18n.t('admin.create.label.fname')}</label>
				<input id="dc-fname" bind:value={dcName} required />
			</div>
			<div class="form-group">
				<label for="dc-lname">{i18n.t('admin.create.label.lname')}</label>
				<input id="dc-lname" bind:value={dcLastName} required />
			</div>
			<div class="form-group">
				<label for="dc-phone">{i18n.t('admin.create.label.phone')}</label>
				<input id="dc-phone" bind:value={dcPhone} required />
			</div>
			<div class="form-group">
				<label for="dc-address">{i18n.t('admin.create.label.address')}</label>
				<input id="dc-address" bind:value={dcAddress} required />
			</div>
			<div class="form-group">
				<label for="dc-plate">License Plate *</label>
				<input id="dc-plate" bind:value={dcPlate} style="text-transform:uppercase" required />
			</div>
			<div class="form-group">
				<label for="dc-password">{i18n.t('admin.create.label.password')}</label>
				<input id="dc-password" type="password" bind:value={dcPassword} minlength="8" required autocomplete="new-password" />
			</div>
			<div class="form-group">
				<label for="dc-spot">Spot (optional)</label>
				<select id="dc-spot" bind:value={dcSpotId} onchange={onDcSpotChange}>
					<option value="">{i18n.t('admin.direct.spot.optional')}</option>
					{#each freeSpots as s (s.id)}
						<option value={s.id}>Spot {s.label}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="dc-rent">{i18n.t('admin.create.label.rent')}</label>
				<input id="dc-rent" type="number" min="1" step="0.01" bind:value={dcRent} />
			</div>
		</div>
		<button type="submit" disabled={dcLoading}>
			{dcLoading ? i18n.t('admin.create.btn.loading') : i18n.t('admin.direct.btn')}
		</button>
	</form>
	{#if dcResult}
		<div class="invite-result-box">{dcResult}</div>
	{/if}
</div>

<style>
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.chart-card {
		max-width: 340px;
	}
	.card-title {
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin: 0 0 0.75rem;
	}
	.badge-warn {
		background: var(--amber);
		color: #000;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
	}
	.last-refresh {
		font-size: 0.75rem;
		color: var(--text-muted);
	}
	.pw-cell {
		font-family: monospace;
		font-size: 0.8rem;
	}
	.termination-chip {
		display: inline-block;
		font-size: 0.7rem;
		background: var(--amber-bg);
		color: var(--amber);
		border-radius: var(--radius-sm);
		padding: 0.1rem 0.4rem;
		margin-left: 0.25rem;
	}
	.pending-row {
		background: color-mix(in srgb, var(--amber-bg) 30%, transparent);
	}
	.pending-diff {
		font-size: 0.7rem;
		color: var(--amber);
		margin: 0.2rem 0;
		width: 100%;
	}
	.action-wrap {
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.icon-sm {
		font-size: 0.85rem;
		padding: 0.2rem 0.45rem;
		min-height: 0;
		min-width: 0;
		line-height: 1;
	}
	.edit-row td {
		padding: 0.5rem 1rem;
		background: var(--bg-card-hover);
	}
	.edit-row-inner {
		padding: 0.25rem 0;
	}
	.edit-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 0.5rem 1rem;
	}
	.hint {
		color: var(--text-muted);
		font-weight: 400;
	}
	.invite-result-box {
		background: var(--bg-card-hover);
		border: 1px solid var(--green);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin-top: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		font-size: 0.85rem;
	}
	.invite-url {
		font-family: monospace;
		font-size: 0.8rem;
		word-break: break-all;
		background: var(--bg-page);
		border-radius: var(--radius-sm);
		padding: 0.2rem 0.4rem;
	}
</style>
