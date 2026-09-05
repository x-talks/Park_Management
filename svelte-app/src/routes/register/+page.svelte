<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { getInviteByToken } from '$lib/api/supabase';
	import { submitPendingRegistration } from '$lib/api/endpoints';
	import { getPaymentFraction } from '$lib/utils/payments';
	import { LICENSE_PLATE_RE } from '$lib/utils/spots';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import type { Invite } from '$lib/types';

	type Step = 'loading' | 'error' | 'review' | 'register' | 'done';
	let step = $state<Step>('loading');
	let errorMsg = $state('');
	let invite = $state<Invite | null>(null);

	let plate = $state('');
	let password = $state('');
	let carModel = $state('');
	let carColor = $state('');
	let submitting = $state(false);
	let formError = $state('');

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
		const rent = 80;
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
				token, licensePlate: finalPlate, password,
				carModel: carModel.trim() || undefined, carColor: carColor.trim() || undefined,
				name: invite?.name ?? undefined, lastName: invite?.lastName ?? undefined,
				phone: invite?.phone ?? undefined, address: invite?.address ?? undefined
			});
			savedPlate = finalPlate;
			savedPassword = password;
			step = 'done';
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Error';
		} finally { submitting = false; }
	}

	async function copyCredentials() {
		const text = `${i18n.t('reg.success.credentials.user')} ${savedPlate}\n${i18n.t('reg.success.credentials.pass')} ${savedPassword}`;
		await navigator.clipboard.writeText(text);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="login-wrap">
	<Card.Root class="reg-card">
		{#if step === 'loading'}
			<Card.Content class="py-8 text-center text-sm text-muted-foreground">
				{i18n.t('reg.loading')}
			</Card.Content>
		{:else if step === 'error'}
			<Card.Content class="py-6 space-y-4">
				<p class="text-sm text-destructive">{errorMsg}</p>
				<Button variant="outline" onclick={() => goto(base + '/')}>{i18n.t('reg.btn.login')}</Button>
			</Card.Content>
		{:else if step === 'review'}
			<Card.Header>
				<div class="flex items-center gap-1.5">{@render StepPills({ step })}</div>
				<Card.Title class="mt-3">{i18n.t('reg.title')}</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-4">
				{#if invite?.spotId}
					<div class="rounded-md border border-input bg-muted/30 p-3">
						<strong class="block text-sm">{i18n.t('reg.spot.title')}</strong>
						<span class="text-xl font-black">Spot {invite.spotId}</span>
						<p class="text-xs text-muted-foreground mt-1">{paymentNotice()}</p>
					</div>
				{/if}
				<div class="rounded-md border border-input bg-muted/20 p-3 max-h-60 overflow-y-auto text-sm leading-relaxed">
					<h3 class="font-bold text-sm mb-2">{i18n.t('reg.terms.heading')}</h3>
					<p class="mb-2 text-xs">{i18n.t('reg.terms.intro')}</p>
					<ol class="list-decimal pl-4 space-y-1 text-xs">
						{#each Array.from({length: 8}, (_, i) => i + 1) as n}
							<li>{i18n.t(`reg.terms.${n}` as Parameters<typeof i18n.t>[0])}</li>
						{/each}
						<li><strong>{i18n.t('reg.terms.9.title')}</strong> {i18n.t('reg.terms.9.text')}</li>
					</ol>
					<p class="text-xs text-muted-foreground mt-2">{i18n.t('reg.terms.closing')}</p>
				</div>
				<Button class="w-full" onclick={() => (step = 'register')}>{i18n.t('reg.btn.agree')}</Button>
			</Card.Content>
		{:else if step === 'register'}
			<Card.Header>
				<div class="flex items-center gap-1.5">{@render StepPills({ step })}</div>
				<Card.Title class="mt-3">{i18n.t('reg.account.title')}</Card.Title>
				<Card.Description>{i18n.t('reg.account.note')}</Card.Description>
			</Card.Header>
			<Card.Content>
				<form onsubmit={submit} class="space-y-4">
					<div class="space-y-1.5">
						<Label for="r-plate">{i18n.t('reg.label.plate')}</Label>
						<Input id="r-plate" bind:value={plate} required class="uppercase" placeholder={i18n.t('reg.hint.plate')} readonly={!!invite?.licensePlate} />
						{#if invite?.licensePlate}<p class="text-xs text-muted-foreground">{i18n.t('reg.hint.prefilled')}</p>{/if}
					</div>
					<div class="space-y-1.5">
						<Label for="r-password">{i18n.t('reg.label.password')}</Label>
						<Input id="r-password" type="password" bind:value={password} minlength="8" required autocomplete="new-password" />
					</div>
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-1.5">
							<Label for="r-model">{i18n.t('reg.label.model')}</Label>
							<Input id="r-model" bind:value={carModel} readonly={!!invite?.carModel} placeholder="e.g. VW Golf" />
						</div>
						<div class="space-y-1.5">
							<Label for="r-color">{i18n.t('reg.label.color')}</Label>
							<Input id="r-color" bind:value={carColor} readonly={!!invite?.carColor} placeholder="e.g. blue" />
						</div>
					</div>
					{#if formError}
						<p class="text-sm text-destructive">{formError}</p>
					{/if}
					<Button type="submit" class="w-full" disabled={submitting}>
						{submitting ? i18n.t('reg.btn.loading') : i18n.t('reg.btn.submit')}
					</Button>
				</form>
			</Card.Content>
		{:else if step === 'done'}
			<Card.Header>
				<div class="flex items-center gap-1.5">{@render StepPills({ step })}</div>
				<Card.Title class="mt-3">{i18n.t('reg.success.title')}</Card.Title>
				<Card.Description>{i18n.t('reg.success.text')}</Card.Description>
			</Card.Header>
			<Card.Content class="space-y-4">
				<div class="rounded-md border border-input bg-muted/20 p-3 space-y-2">
					<strong class="text-sm">{i18n.t('reg.success.credentials.title')}</strong>
					<p class="text-xs text-muted-foreground">{i18n.t('reg.success.credentials.note')}</p>
					<div class="flex justify-between items-center text-sm">
						<span>{i18n.t('reg.success.credentials.user')}</span>
						<code class="font-mono bg-background rounded px-2 py-0.5 text-xs">{savedPlate}</code>
					</div>
					<div class="flex justify-between items-center text-sm">
						<span>{i18n.t('reg.success.credentials.pass')}</span>
						<code class="font-mono bg-background rounded px-2 py-0.5 text-xs">{savedPassword}</code>
					</div>
					<Button variant="outline" size="sm" class="w-full" onclick={copyCredentials}>
						{copied ? i18n.t('reg.success.credentials.copied') : i18n.t('reg.success.credentials.copy')}
					</Button>
				</div>
				<Button class="w-full" onclick={() => goto(base + '/')}>{i18n.t('reg.btn.login')}</Button>
			</Card.Content>
		{/if}
	</Card.Root>
</div>

{#snippet StepPills({ step: s }: { step: Step })}
	{#each ([
		{ key: 'review',   label: i18n.t('reg.step.review')   },
		{ key: 'register', label: i18n.t('reg.step.register') },
		{ key: 'done',     label: i18n.t('reg.step.done')     }
	] as const) as pill, idx}
		{#if idx > 0}<span class="text-xs text-muted-foreground">›</span>{/if}
		{@const order = { loading: -1, error: -1, review: 0, register: 1, done: 2 } as Record<Step, number>}
		{@const current = order[s]}
		<span class="rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider
			{idx === current ? 'bg-primary text-primary-foreground' : idx < current ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}">
			{pill.label}
		</span>
	{/each}
{/snippet}

<style>
	.login-wrap {
		min-height: 100dvh;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding: 2rem 1rem;
		background: var(--bg-page);
	}
	.reg-card {
		width: 100%;
		max-width: 480px;
	}
	[data-theme='dark-glass'] .login-wrap {
		background: linear-gradient(135deg, #0a0a18 0%, #0d1130 30%, #0a1a24 60%, #0a0a18 100%);
	}
	[data-theme='dark-glass'] .reg-card {
		background: rgba(255, 255, 255, 0.07);
		border-color: rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
	}
</style>
