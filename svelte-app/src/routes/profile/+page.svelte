<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { getUsers } from '$lib/api/supabase';
	import { patchUser, setPassword } from '$lib/api/endpoints';
	import { toast } from '$lib/stores/toast.svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
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
		if (!Object.keys(changes).length) {
			toast(i18n.t('profile.warn.nochange'), 'warn');
			return;
		}
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

<div class="card" id="profile-card">
	<div class="card-header">
		<h2>{i18n.t('profile.title')}</h2>
	</div>
	{#if hasPending}
		<div class="alert info">{i18n.t('profile.pending')}</div>
	{/if}
	<form onsubmit={submitProfile}>
		<div class="grid-2">
			<div class="form-group">
				<label for="p-plate">{i18n.t('profile.label.plate')}</label>
				<input id="p-plate" value={(me?.licensePlate ?? me?.username ?? '').toUpperCase()} readonly style="opacity:0.6" />
				<small>{i18n.t('profile.readonly')}</small>
			</div>
			<div class="form-group">
				<label for="p-name">{i18n.t('profile.label.name')}</label>
				<input id="p-name" value={me?.name ?? ''} readonly style="opacity:0.6" />
				<small>{i18n.t('profile.readonly')}</small>
			</div>
			<div class="form-group">
				<label for="p-lastname">{i18n.t('profile.label.lastname')}</label>
				<input id="p-lastname" value={me?.lastName ?? ''} readonly style="opacity:0.6" />
			</div>
			<div class="form-group">
				<label for="p-phone">{i18n.t('profile.label.phone')}</label>
				<input id="p-phone" bind:value={phone} disabled={hasPending} />
			</div>
			<div class="form-group">
				<label for="p-address">{i18n.t('profile.label.address')}</label>
				<input id="p-address" bind:value={address} disabled={hasPending} />
			</div>
		</div>
		<h3 class="section-heading">{i18n.t('profile.section.car')}</h3>
		<div class="grid-2">
			<div class="form-group">
				<label for="p-carmodel">{i18n.t('profile.label.carmodel')}</label>
				<input id="p-carmodel" bind:value={carModel} placeholder="e.g. VW Golf" disabled={hasPending} />
			</div>
			<div class="form-group">
				<label for="p-carcolor">{i18n.t('profile.label.carcolor')}</label>
				<input id="p-carcolor" bind:value={carColor} placeholder="e.g. blue" disabled={hasPending} />
			</div>
		</div>
		<div class="btn-row" style="margin-top:0.75rem">
			<button type="submit" disabled={profileLoading || hasPending}>{i18n.t('profile.btn.submit')}</button>
		</div>
		<p class="form-note">{i18n.t('profile.note')}</p>
	</form>
</div>

<div class="card">
	<div class="card-header">
		<h2>{i18n.t('profile.section.password')}</h2>
	</div>
	<form onsubmit={submitPassword}>
		<div class="grid-2">
			<div class="form-group">
				<label for="pw-current">{i18n.t('profile.label.currentpw')}</label>
				<input id="pw-current" type="password" bind:value={pwCurrent} autocomplete="current-password" required />
			</div>
			<div class="form-group">
				<label for="pw-new">{i18n.t('profile.label.newpw')}</label>
				<input id="pw-new" type="password" bind:value={pwNew} autocomplete="new-password" minlength="8" required />
			</div>
			<div class="form-group">
				<label for="pw-confirm">{i18n.t('profile.label.confirmpw')}</label>
				<input id="pw-confirm" type="password" bind:value={pwConfirm} autocomplete="new-password" minlength="8" required />
			</div>
		</div>
		{#if pwError}
			<div class="alert error">{pwError}</div>
		{/if}
		<div class="btn-row">
			<button type="submit" disabled={pwLoading}>{i18n.t('profile.btn.changepw')}</button>
		</div>
	</form>
</div>

<style>
	.section-heading {
		font-size: 0.85rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-secondary);
		margin: 1rem 0 0.5rem;
	}
	.form-note {
		font-size: 0.78rem;
		color: var(--text-secondary);
		margin-top: 0.5rem;
	}
</style>
