<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { getSpots, getUsers, getPayments, getInvites, getPendingRegistrations } from '$lib/api/supabase';
	import { PollStore } from '$lib/stores/poll';
	import * as Tabs from '$lib/components/ui/tabs';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import type { Spot, User, Payment, Invite, PendingRegistration } from '$lib/types';
	import AdminUsers from './AdminUsers.svelte';
	import AdminSpots from './AdminSpots.svelte';
	import AdminPayments from './AdminPayments.svelte';

	let spots = $state<Spot[]>([]);
	let users = $state<User[]>([]);
	let payments = $state<Payment[]>([]);
	let invites = $state<Invite[]>([]);
	let pendingRegs = $state<PendingRegistration[]>([]);
	let loading = $state(true);

	const pendingRegsCount = $derived(pendingRegs.length);
	const pendingEditsCount = $derived(users.filter((u) => u.pendingEdits).length);
	const totalPending = $derived(pendingRegsCount + pendingEditsCount);

	async function loadAll() {
		[spots, users, payments, invites, pendingRegs] = await Promise.all([
			getSpots(), getUsers(), getPayments(), getInvites(), getPendingRegistrations()
		]);
		loading = false;
	}

	const poll = new PollStore();

	onMount(async () => {
		if (!session.hasRole('admin')) { void goto(base + '/parking'); return; }
		await loadAll();
		poll.start(loadAll);
	});

	onDestroy(() => poll.stop());
</script>

<div class="pt-2">
	<Tabs.Root defaultValue="users">
		<Tabs.List class="mb-5">
			<Tabs.Trigger value="users" id="tab-btn-users" class="relative">
				{i18n.t('nav.users')}
				{#if totalPending > 0}
					<Badge variant="destructive" class="ml-1.5 h-4 px-1.5 text-[10px]">{totalPending}</Badge>
				{/if}
			</Tabs.Trigger>
			<Tabs.Trigger value="spots" id="tab-btn-spots">{i18n.t('nav.spots')}</Tabs.Trigger>
			<Tabs.Trigger value="payments" id="tab-btn-payments">{i18n.t('nav.payments')}</Tabs.Trigger>
		</Tabs.List>

		{#if loading}
			<Card.Root>
				<Card.Content class="py-8 text-center text-sm text-muted-foreground">
					{i18n.t('app.loading')}
				</Card.Content>
			</Card.Root>
		{:else}
			<Tabs.Content value="users">
				<AdminUsers {spots} {users} {pendingRegs} onRefresh={loadAll} />
			</Tabs.Content>
			<Tabs.Content value="spots">
				<AdminSpots {spots} {users} onRefresh={loadAll} />
			</Tabs.Content>
			<Tabs.Content value="payments">
				<AdminPayments {spots} {users} {payments} onRefresh={loadAll} />
			</Tabs.Content>
		{/if}
	</Tabs.Root>
</div>
