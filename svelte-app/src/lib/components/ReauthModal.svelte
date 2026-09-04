<script lang="ts">
	import { onMount } from 'svelte';
	import { registerReauthModal, resolveReauth } from '$lib/api/auth';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { fade, scale } from 'svelte/transition';

	let visible = $state(false);
	let password = $state('');

	onMount(() => {
		registerReauthModal(() => {
			visible = true;
			password = '';
		});
	});

	async function submit() {
		if (!password) return;
		resolveReauth(password);
		visible = false;
		password = '';
	}

	function cancel() {
		resolveReauth(null);
		visible = false;
	}

	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') cancel();
		else if (e.key === 'Enter') void submit();
	}
</script>

{#if visible}
	<div
		class="reauth-overlay"
		id="reauth-overlay"
		transition:fade={{ duration: 120 }}
		onkeydown={onKey}
		role="presentation"
	>
		<div class="reauth-card" id="reauth-card" transition:scale={{ start: 0.95, duration: 150 }}>
			<p class="reauth-title">{i18n.t('app.name')}</p>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				id="reauth-password"
				type="password"
				autocomplete="current-password"
				placeholder={i18n.t('login.label.password')}
				bind:value={password}
				autofocus
			/>
			<button class="accent" id="reauth-submit" onclick={submit}>
				{i18n.t('login.btn')}
			</button>
		</div>
	</div>
{/if}

<style>
	.reauth-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 4000;
		padding: 1rem;
	}
	.reauth-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-lg);
		padding: 1.5rem;
		max-width: 360px;
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.reauth-title {
		margin: 0;
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--text-primary);
	}
	input {
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-input);
		color: var(--text-primary);
		font-size: 0.95rem;
		width: 100%;
	}
	button.accent {
		background: var(--accent);
		color: var(--accent-text);
		border: none;
		border-radius: var(--radius);
		padding: 0.55rem 1.2rem;
		font-weight: 700;
		font-size: 0.9rem;
		cursor: pointer;
		align-self: flex-end;
	}
</style>
