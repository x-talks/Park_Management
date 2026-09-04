<script lang="ts">
	import { toasts } from '$lib/stores/toast.svelte';
	import { fly } from 'svelte/transition';

	const ICON: Record<string, string> = { success: '✓', error: '✕', warn: '⚠', info: 'ℹ' };
</script>

<div class="pm-toast-container" id="pm-toast-container">
	{#each toasts.items as t (t.id)}
		<div
			class="pm-toast pm-toast-{t.type}"
			role="button"
			tabindex="0"
			transition:fly={{ y: 20, duration: 220 }}
			onclick={() => toasts.dismiss(t.id)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') toasts.dismiss(t.id);
			}}
		>
			<span class="pm-toast-icon">{ICON[t.type]}</span>
			<span class="pm-toast-msg">{t.message}</span>
		</div>
	{/each}
</div>

<style>
	.pm-toast-container {
		position: fixed;
		bottom: 1rem;
		right: 1rem;
		display: flex;
		flex-direction: column-reverse;
		gap: 0.5rem;
		z-index: 2000;
		pointer-events: none;
	}
	.pm-toast {
		pointer-events: auto;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--bg-card);
		color: var(--text-primary);
		border: 1px solid var(--border);
		border-left: 4px solid var(--text-muted);
		border-radius: var(--radius);
		box-shadow: var(--shadow-lg);
		padding: 0.7rem 1rem;
		font-size: 0.9rem;
		font-weight: 500;
		max-width: 340px;
		cursor: pointer;
	}
	.pm-toast-success {
		border-left-color: var(--green);
	}
	.pm-toast-error {
		border-left-color: var(--red);
	}
	.pm-toast-warn {
		border-left-color: var(--amber);
	}
	.pm-toast-info {
		border-left-color: var(--blue);
	}
	.pm-toast-icon {
		font-weight: 800;
	}
	.pm-toast-success .pm-toast-icon {
		color: var(--green);
	}
	.pm-toast-error .pm-toast-icon {
		color: var(--red);
	}
	.pm-toast-warn .pm-toast-icon {
		color: var(--amber);
	}
	.pm-toast-info .pm-toast-icon {
		color: var(--blue);
	}
</style>
