<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { session } from '$lib/stores/session.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { login } from '$lib/api/auth';
	import LangSwitcher from '$lib/components/LangSwitcher.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import { Sun, Moon, ParkingCircle } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let plate = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	onMount(() => {
		if (session.user) {
			const dest = session.hasRole('admin') ? base + '/admin' : base + '/parking';
			void goto(dest, { replaceState: true });
		}
	});

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!plate || !password) return;
		loading = true;
		error = '';
		try {
			const data = await login(plate, password);
			const dest = data.user.role === 'admin' || data.user.role === 'master' ? base + '/admin' : base + '/parking';
			void goto(dest, { replaceState: true });
		} catch (err) {
			error = err instanceof Error ? err.message : i18n.t('login.error.failed');
		} finally {
			loading = false;
		}
	}
</script>

<Button
	variant="ghost"
	size="icon"
	class="fixed top-3 right-3 z-10 h-9 w-9"
	onclick={() => theme.cycle()}
	title="Toggle theme"
>
	{#if theme.current === 'light'}
		<Sun size={16} />
	{:else}
		<Moon size={16} />
	{/if}
</Button>

<div class="login-wrap">
	<Card.Root class="login-card">
		<Card.Header class="items-center pb-2">
			<div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
				<ParkingCircle size={36} class="text-primary" />
			</div>
			<Card.Title class="text-2xl font-bold tracking-tight" style="font-family: var(--font-heading)">
				{i18n.t('app.name')}
			</Card.Title>
			<Card.Description>{i18n.t('login.subtitle')}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={submit} class="space-y-4">
				<div class="space-y-1.5">
					<Label for="username">{i18n.t('login.label.plate')}</Label>
					<Input
						id="username"
						type="text"
						autocomplete="username"
						placeholder={i18n.t('login.placeholder.plate')}
						bind:value={plate}
						required
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="password">{i18n.t('login.label.password')}</Label>
					<Input
						id="password"
						type="password"
						autocomplete="current-password"
						bind:value={password}
						required
					/>
				</div>
				{#if error}
					<p class="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
						{error}
					</p>
				{/if}
				<Button type="submit" class="w-full" disabled={loading}>
					{loading ? i18n.t('login.btn.loading') : i18n.t('login.btn')}
				</Button>
			</form>
		</Card.Content>
		<Card.Footer class="justify-center pt-0">
			<LangSwitcher />
		</Card.Footer>
	</Card.Root>
</div>

<style>
	.login-wrap {
		min-height: 100dvh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: var(--bg-page);
	}
	.login-card {
		width: 100%;
		max-width: 380px;
		animation: card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	@keyframes card-in {
		from { opacity: 0; transform: translateY(20px) scale(0.97); }
		to   { opacity: 1; transform: translateY(0) scale(1); }
	}
	[data-theme='dark-glass'] .login-wrap {
		background: linear-gradient(135deg, #0a0a18 0%, #0d1130 30%, #0a1a24 60%, #0a0a18 100%);
		background-size: 400% 400%;
		animation: login-gradient 12s ease infinite, card-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
	}
	[data-theme='dark-glass'] .login-card {
		background: rgba(255, 255, 255, 0.07);
		border-color: rgba(255, 255, 255, 0.12);
		backdrop-filter: blur(24px);
		-webkit-backdrop-filter: blur(24px);
		box-shadow:
			0 8px 40px rgba(0, 0, 0, 0.55),
			0 0 0 1px rgba(255, 255, 255, 0.08),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
	}
	@keyframes login-gradient {
		0%   { background-position: 0% 50%; }
		50%  { background-position: 100% 50%; }
		100% { background-position: 0% 50%; }
	}
</style>
