<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { session } from '$lib/stores/session.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { login } from '$lib/api/auth';
	import LangSwitcher from '$lib/components/LangSwitcher.svelte';
	import { Sun } from 'lucide-svelte';
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

<button
	class="icon-btn login-theme-toggle"
	title="Toggle theme"
	onclick={() => theme.cycle()}
>
	<Sun size={16} />
</button>

<div class="login-wrap">
	<div class="login-card">
		<div class="login-logo">
			<img src="logo.png" alt="Logo" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
		</div>
		<h1>{i18n.t('app.name')}</h1>
		<p class="subtitle">{i18n.t('login.subtitle')}</p>
		<form onsubmit={submit}>
			<div class="form-group">
				<label for="username">{i18n.t('login.label.plate')}</label>
				<input
					id="username"
					type="text"
					autocomplete="username"
					placeholder={i18n.t('login.placeholder.plate')}
					bind:value={plate}
					required
				/>
			</div>
			<div class="form-group">
				<label for="password">{i18n.t('login.label.password')}</label>
				<input
					id="password"
					type="password"
					autocomplete="current-password"
					bind:value={password}
					required
				/>
			</div>
			{#if error}
				<div class="alert error">{error}</div>
			{/if}
			<button type="submit" style="width:100%" disabled={loading}>
				{loading ? i18n.t('login.btn.loading') : i18n.t('login.btn')}
			</button>
		</form>
		<div class="login-lang">
			<LangSwitcher />
		</div>
	</div>
</div>

<style>
	.login-logo {
		text-align: center;
		margin-bottom: 1.25rem;
	}
	.login-logo img {
		height: 72px;
		width: auto;
		object-fit: contain;
	}
	.login-lang {
		margin-top: 1.25rem;
		text-align: center;
	}
</style>
