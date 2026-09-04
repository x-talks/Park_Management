<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { getInviteByToken } from '$lib/api/supabase';
	import { submitPendingRegistration } from '$lib/api/endpoints';
	import { getPaymentFraction } from '$lib/utils/payments';
	import { LICENSE_PLATE_RE } from '$lib/utils/spots';
	import type { Invite } from '$lib/types';

	type Step = 'loading' | 'error' | 'review' | 'register' | 'done';
	let step = $state<Step>('loading');
	let errorMsg = $state('');
	let invite = $state<Invite | null>(null);

	// Form fields
	let plate = $state('');
	let password = $state('');
	let carModel = $state('');
	let carColor = $state('');
	let submitting = $state(false);
	let formError = $state('');

	// Success state
	let savedPlate = $state('');
	let savedPassword = $state('');
	let copied = $state(false);

	const token = $derived($page.url.searchParams.get('token') ?? '');

	onMount(async () => {
		if (!token) { errorMsg = i18n.t('err.invite.notfound'); step = 'error'; return; }
		try {
			const inv = await getInviteByToken(token);
			if (!inv) { errorMsg = i18n.t('err.invite.invalid'); step = 'error'; return; }
			invite = inv;
			plate = inv.licensePlate ?? '';
			carModel = inv.carModel ?? '';
			carColor = inv.carColor ?? '';
			step = 'review';
		} catch (err) {
			errorMsg = err instanceof Error ? err.message : 'Error';
			step = 'error';
		}
	});

	function paymentNotice() {
		if (!invite) return '';
		const now = new Date().toISOString();
		const { fraction } = getPaymentFraction(now);
		const rent = 80; // default; invite doesn't carry monthlyRent
		const amount = fraction === 1 ? rent : fraction === 0.5 ? rent / 2 : Math.round(rent / 3);
		const fracLabel = fraction === 1 ? '100%' : fraction === 0.5 ? '50%' : '33%';
		return i18n.t('reg.payment.notice', `€${amount}`, fracLabel, `€${rent}/mo`);
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		formError = '';
		const finalPlate = plate.trim().toUpperCase();
		if (!LICENSE_PLATE_RE.test(finalPlate)) { formError = i18n.t('err.plate.format'); return; }
		if (password.length < 8) { formError = i18n.t('err.password.short'); return; }
		submitting = true;
		try {
			await submitPendingRegistration({
				token,
				licensePlate: finalPlate,
				password,
				carModel: carModel.trim() || undefined,
				carColor: carColor.trim() || undefined,
				name: invite?.name ?? undefined,
				lastName: invite?.lastName ?? undefined,
				phone: invite?.phone ?? undefined,
				address: invite?.address ?? undefined
			});
			savedPlate = finalPlate;
			savedPassword = password;
			step = 'done';
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Error';
		} finally {
			submitting = false;
		}
	}

	async function copyCredentials() {
		const text = `${i18n.t('reg.success.credentials.user')} ${savedPlate}\n${i18n.t('reg.success.credentials.pass')} ${savedPassword}`;
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="login-wrap">
	<div class="login-card reg-card">
		{#if step === 'loading'}
			<p class="subtitle">{i18n.t('reg.loading')}</p>
		{:else if step === 'error'}
			<div class="alert error">{errorMsg}</div>
			<button class="secondary" onclick={() => goto('/')}>{i18n.t('reg.btn.login')}</button>
		{:else if step === 'review'}
			<div class="step-pills">
				<span class="step active">{i18n.t('reg.step.review')}</span>
				<span class="sep">›</span>
				<span class="step">{i18n.t('reg.step.register')}</span>
				<span class="sep">›</span>
				<span class="step">{i18n.t('reg.step.done')}</span>
			</div>

			<h1>{i18n.t('reg.title')}</h1>

			{#if invite?.spotId}
				<div class="spot-info card-sm">
					<strong>{i18n.t('reg.spot.title')}</strong>
					<span class="spot-badge">Spot {invite.spotId}</span>
					<p class="notice">{paymentNotice()}</p>
				</div>
			{/if}

			<div class="terms-box">
				<h3>{i18n.t('reg.terms.heading')}</h3>
				<p>{i18n.t('reg.terms.intro')}</p>
				<ol>
					{#each Array.from({length: 8}, (_, i) => i + 1) as n}
						<li>{i18n.t(`reg.terms.${n}` as Parameters<typeof i18n.t>[0])}</li>
					{/each}
					<li><strong>{i18n.t('reg.terms.9.title')}</strong> {i18n.t('reg.terms.9.text')}</li>
				</ol>
				<p class="closing">{i18n.t('reg.terms.closing')}</p>
			</div>

			<button style="width:100%" onclick={() => (step = 'register')}>
				{i18n.t('reg.btn.agree')}
			</button>
		{:else if step === 'register'}
			<div class="step-pills">
				<span class="step done">{i18n.t('reg.step.review')}</span>
				<span class="sep">›</span>
				<span class="step active">{i18n.t('reg.step.register')}</span>
				<span class="sep">›</span>
				<span class="step">{i18n.t('reg.step.done')}</span>
			</div>

			<h1>{i18n.t('reg.account.title')}</h1>
			<p class="subtitle">{i18n.t('reg.account.note')}</p>

			<form onsubmit={submit}>
				<div class="form-group">
					<label for="r-plate">{i18n.t('reg.label.plate')}</label>
					<input
						id="r-plate"
						bind:value={plate}
						required
						style="text-transform:uppercase"
						placeholder={i18n.t('reg.hint.plate')}
						readonly={!!invite?.licensePlate}
					/>
					{#if invite?.licensePlate}
						<small>{i18n.t('reg.hint.prefilled')}</small>
					{/if}
				</div>
				<div class="form-group">
					<label for="r-password">{i18n.t('reg.label.password')}</label>
					<input id="r-password" type="password" bind:value={password} minlength="8" required autocomplete="new-password" />
				</div>
				<div class="form-group">
					<label for="r-model">{i18n.t('reg.label.model')}</label>
					<input
						id="r-model"
						bind:value={carModel}
						readonly={!!invite?.carModel}
						placeholder="e.g. VW Golf"
					/>
				</div>
				<div class="form-group">
					<label for="r-color">{i18n.t('reg.label.color')}</label>
					<input
						id="r-color"
						bind:value={carColor}
						readonly={!!invite?.carColor}
						placeholder="e.g. blue"
					/>
				</div>
				{#if formError}
					<div class="alert error">{formError}</div>
				{/if}
				<button type="submit" style="width:100%" disabled={submitting}>
					{submitting ? i18n.t('reg.btn.loading') : i18n.t('reg.btn.submit')}
				</button>
			</form>
		{:else if step === 'done'}
			<div class="step-pills">
				<span class="step done">{i18n.t('reg.step.review')}</span>
				<span class="sep">›</span>
				<span class="step done">{i18n.t('reg.step.register')}</span>
				<span class="sep">›</span>
				<span class="step active">{i18n.t('reg.step.done')}</span>
			</div>

			<h1>{i18n.t('reg.success.title')}</h1>
			<p class="subtitle">{i18n.t('reg.success.text')}</p>

			<div class="credentials-box">
				<strong>{i18n.t('reg.success.credentials.title')}</strong>
				<p class="cred-note">{i18n.t('reg.success.credentials.note')}</p>
				<div class="cred-row">
					<span>{i18n.t('reg.success.credentials.user')}</span>
					<code>{savedPlate}</code>
				</div>
				<div class="cred-row">
					<span>{i18n.t('reg.success.credentials.pass')}</span>
					<code>{savedPassword}</code>
				</div>
				<button class="secondary cred-copy" onclick={copyCredentials}>
					{copied ? i18n.t('reg.success.credentials.copied') : i18n.t('reg.success.credentials.copy')}
				</button>
			</div>

			<button style="width:100%;margin-top:1rem" onclick={() => goto('/')}>
				{i18n.t('reg.btn.login')}
			</button>
		{/if}
	</div>
</div>

<style>
	.reg-card {
		max-width: 480px;
	}
	.step-pills {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin-bottom: 1.25rem;
		font-size: 0.75rem;
		font-weight: 700;
	}
	.step {
		padding: 0.2rem 0.7rem;
		border-radius: 999px;
		background: var(--bg-card-hover);
		color: var(--text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.step.active {
		background: var(--accent);
		color: var(--accent-text);
	}
	.step.done {
		background: var(--green-bg);
		color: var(--green);
	}
	.sep {
		color: var(--text-muted);
	}
	.spot-info {
		background: var(--bg-card-hover);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.spot-badge {
		font-size: 1.1rem;
		font-weight: 800;
	}
	.notice {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin: 0;
	}
	.terms-box {
		background: var(--bg-card-hover);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem;
		margin-bottom: 1rem;
		max-height: 240px;
		overflow-y: auto;
		font-size: 0.85rem;
		line-height: 1.7;
	}
	.terms-box h3 {
		font-size: 0.9rem;
		margin: 0 0 0.5rem;
	}
	.terms-box ol {
		margin: 0.5rem 0;
		padding-left: 1.25rem;
	}
	.terms-box li {
		margin-bottom: 0.25rem;
	}
	.closing {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.credentials-box {
		background: var(--bg-card-hover);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem;
		margin: 1rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.cred-note {
		font-size: 0.8rem;
		color: var(--text-secondary);
		margin: 0;
	}
	.cred-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		gap: 0.5rem;
	}
	.cred-row code {
		font-family: monospace;
		font-size: 0.85rem;
		background: var(--bg-page);
		border-radius: var(--radius-sm);
		padding: 0.1rem 0.4rem;
	}
	.cred-copy {
		align-self: flex-end;
		font-size: 0.8rem;
		padding: 0.3rem 0.8rem;
	}
</style>
