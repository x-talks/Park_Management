<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { getSpots, getUsers, getPayments, getInvites, getPendingRegistrations } from '$lib/api/supabase';
	import { requireAuth } from '$lib/utils/auth-guard';
	import { PollStore } from '$lib/stores/poll';
	import type { Spot, User, Payment, Invite, PendingRegistration } from '$lib/types';
	import AdminUsers from './AdminUsers.svelte';
	import AdminSpots from './AdminSpots.svelte';
	import AdminPayments from './AdminPayments.svelte';

	requireAuth('admin');

	type Tab = 'users' | 'spots' | 'payments';
	let activeTab = $state<Tab>('users');

	let spots = $state<Spot[]>([]);
	let users = $state<User[]>([]);
	let payments = $state<Payment[]>([]);
	let invites = $state<Invite[]>([]);
	let pendingRegs = $state<PendingRegistration[]>([]);
	let loading = $state(true);

	const pendingRegsCount = $derived(pendingRegs.length);
	const pendingEditsCount = $derived(users.filter((u) => u.pendingEdits).length);

	async function loadAll() {
		[spots, users, payments, invites, pendingRegs] = await Promise.all([
			getSpots(),
			getUsers(),
			getPayments(),
			getInvites(),
			getPendingRegistrations()
		]);
		loading = false;
	}

	const poll = new PollStore();

	onMount(async () => {
		if (!session.hasRole('admin')) { void goto('/parking'); return; }
		await loadAll();
		poll.start(loadAll);
	});

	onDestroy(() => poll.stop());
</script>

<div class="page-wrap admin-page">
	<div class="tab-bar" id="stat-cards">
		<button
			id="tab-btn-users"
			class="tab-btn"
			class:active={activeTab === 'users'}
			onclick={() => (activeTab = 'users')}
		>
			{i18n.t('nav.users')}
			{#if pendingRegsCount + pendingEditsCount > 0}
				<span class="badge">{pendingRegsCount + pendingEditsCount}</span>
			{/if}
		</button>
		<button
			id="tab-btn-spots"
			class="tab-btn"
			class:active={activeTab === 'spots'}
			onclick={() => (activeTab = 'spots')}
		>
			{i18n.t('nav.spots')}
		</button>
		<button
			id="tab-btn-payments"
			class="tab-btn"
			class:active={activeTab === 'payments'}
			onclick={() => (activeTab = 'payments')}
		>
			{i18n.t('nav.payments')}
		</button>
	</div>

	{#if loading}
		<div class="card"><p class="loading-msg">{i18n.t('app.loading')}</p></div>
	{:else if activeTab === 'users'}
		<AdminUsers {spots} {users} {pendingRegs} onRefresh={loadAll} />
	{:else if activeTab === 'spots'}
		<AdminSpots {spots} {users} onRefresh={loadAll} />
	{:else}
		<AdminPayments {spots} {users} {payments} onRefresh={loadAll} />
	{/if}
</div>

<style>
	.admin-page {
		padding-top: 1rem;
	}
	.tab-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}
	.tab-btn {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.45rem 1rem;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		color: var(--text-secondary);
		position: relative;
		transition: all var(--transition);
	}
	.tab-btn:hover {
		background: var(--bg-card-hover);
		color: var(--text-primary);
	}
	.tab-btn.active {
		background: var(--accent);
		color: var(--accent-text);
		border-color: var(--accent);
	}
	.badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--red);
		color: #fff;
		border-radius: 999px;
		font-size: 0.65rem;
		font-weight: 700;
		min-width: 1.1rem;
		height: 1.1rem;
		padding: 0 0.25rem;
		margin-left: 0.4rem;
		vertical-align: middle;
	}
	.loading-msg {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}
</style>
