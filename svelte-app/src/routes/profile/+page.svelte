<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { getUsers } from '$lib/api/supabase';
	import { patchUser, setPassword } from '$lib/api/endpoints';
	import { toast } from '$lib/stores/toast.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import type { User } from '$lib/types';

	let me = $state<User | null>(null);
	let phone = $state('');
	let address = $state('');
	let carModel = $state('');
	let carColor = $state('');
	let hasPending = $state(false);
	let profileLoading = $state(false);

	let pwCurrent = $state('');
	let pwNew = $state('');
	let pwConfirm = $state('');
	let pwError = $state('');
	let pwLoading = $state(false);

	onMount(async () => {
		const uid = session.user?.id;
		if (!uid) { void goto(base + '/', { replaceState: true }); return; }
		const users = await getUsers();
		const found = users.find((u) => u.id === uid) ?? null;
		me = found;
		if (found) {
			phone = found.phone ?? '';
			address = found.address ?? '';
			carModel = found.carModel ?? '';
			carColor = found.carColor ?? '';
			hasPending = !!found.pendingEdits;
		}
	});

	async function submitProfile(e: SubmitEvent) {
		e.preventDefault();
		if (!me) return;
		const changes: Record<string, string> = {};
		if (phone !== (me.phone ?? '')) changes.phone = phone;
		if (address !== (me.address ?? '')) changes.address = address;
		if (carModel !== (me.carModel ?? '')) changes.carModel = carModel;
		if (carColor !== (me.carColor ?? '')) changes.carColor = carColor;
		if (!Object.keys(changes).length) { toast(i18n.t('profile.warn.nochange'), 'warn'); return; }
		profileLoading = true;
		try {
			await patchUser(me.id, { pendingEdits: { ...changes, requestedAt: new Date().toISOString() } });
			toast(i18n.t('profile.success'), 'success');
			hasPending = true;
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Error', 'error');
		} finally {
			profileLoading = false;
		}
	}

	async function submitPassword(e: SubmitEvent) {
		e.preventDefault();
		pwError = '';
		if (pwNew.length < 8) { pwError = i18n.t('profile.pw.short'); return; }
		if (pwNew !== pwConfirm) { pwError = i18n.t('profile.pw.mismatch'); return; }
		pwLoading = true;
		try {
			await setPassword(session.user!.id, pwNew, pwCurrent);
			toast(i18n.t('profile.pw.success'), 'success');
			pwCurrent = ''; pwNew = ''; pwConfirm = '';
		} catch (err) {
			pwError = err instanceof Error ? err.message : 'Error';
		} finally {
			pwLoading = false;
		}
	}
</script>

<div class="space-y-4">
	<Card.Root>
		<Card.Header>
			<Card.Title>{i18n.t('profile.title')}</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if hasPending}
				<p class="mb-4 rounded-md border border-blue-300/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-400">
					{i18n.t('profile.pending')}
				</p>
			{/if}
			<form onsubmit={submitProfile} class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<Label for="p-plate">{i18n.t('profile.label.plate')}</Label>
						<Input id="p-plate" value={(me?.licensePlate ?? me?.username ?? '').toUpperCase()} readonly class="opacity-60" />
						<p class="text-xs text-muted-foreground">{i18n.t('profile.readonly')}</p>
					</div>
					<div class="space-y-1.5">
						<Label for="p-name">{i18n.t('profile.label.name')}</Label>
						<Input id="p-name" value={me?.name ?? ''} readonly class="opacity-60" />
						<p class="text-xs text-muted-foreground">{i18n.t('profile.readonly')}</p>
					</div>
					<div class="space-y-1.5">
						<Label for="p-lastname">{i18n.t('profile.label.lastname')}</Label>
						<Input id="p-lastname" value={me?.lastName ?? ''} readonly class="opacity-60" />
					</div>
					<div class="space-y-1.5">
						<Label for="p-phone">{i18n.t('profile.label.phone')}</Label>
						<Input id="p-phone" bind:value={phone} disabled={hasPending} />
					</div>
					<div class="space-y-1.5">
						<Label for="p-address">{i18n.t('profile.label.address')}</Label>
						<Input id="p-address" bind:value={address} disabled={hasPending} />
					</div>
				</div>
				<p class="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-2">
					{i18n.t('profile.section.car')}
				</p>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<Label for="p-carmodel">{i18n.t('profile.label.carmodel')}</Label>
						<Input id="p-carmodel" bind:value={carModel} placeholder="e.g. VW Golf" disabled={hasPending} />
					</div>
					<div class="space-y-1.5">
						<Label for="p-carcolor">{i18n.t('profile.label.carcolor')}</Label>
						<Input id="p-carcolor" bind:value={carColor} placeholder="e.g. blue" disabled={hasPending} />
					</div>
				</div>
				<Button type="submit" disabled={profileLoading || hasPending}>
					{i18n.t('profile.btn.submit')}
				</Button>
				<p class="text-xs text-muted-foreground">{i18n.t('profile.note')}</p>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root>
		<Card.Header>
			<Card.Title>{i18n.t('profile.section.password')}</Card.Title>
		</Card.Header>
		<Card.Content>
			<form onsubmit={submitPassword} class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<Label for="pw-current">{i18n.t('profile.label.currentpw')}</Label>
						<Input id="pw-current" type="password" bind:value={pwCurrent} autocomplete="current-password" required />
					</div>
					<div class="space-y-1.5">
						<Label for="pw-new">{i18n.t('profile.label.newpw')}</Label>
						<Input id="pw-new" type="password" bind:value={pwNew} autocomplete="new-password" minlength="8" required />
					</div>
					<div class="space-y-1.5">
						<Label for="pw-confirm">{i18n.t('profile.label.confirmpw')}</Label>
						<Input id="pw-confirm" type="password" bind:value={pwConfirm} autocomplete="new-password" minlength="8" required />
					</div>
				</div>
				{#if pwError}
					<p class="text-sm text-destructive">{pwError}</p>
				{/if}
				<Button type="submit" disabled={pwLoading}>
					{i18n.t('profile.btn.changepw')}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
