<script lang="ts">
	import { modal } from '$lib/stores/modal.svelte';
	import { scale, fade } from 'svelte/transition';

	let inputValue = $state('');

	// Sync the input default whenever a prompt opens.
	$effect(() => {
		if (modal.state.open && modal.state.kind === 'prompt') {
			inputValue = modal.state.defaultValue;
		}
	});

	function confirm() {
		if (modal.state.kind === 'prompt') modal.resolve(inputValue);
		else modal.resolve(true);
	}
	function cancel() {
		modal.resolve(modal.state.kind === 'prompt' ? null : false);
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'Escape') cancel();
		else if (e.key === 'Enter') confirm();
	}
</script>

{#if modal.state.open}
	<div
		class="pm-modal-overlay open"
		id="pm-modal-overlay"
		transition:fade={{ duration: 120 }}
		onclick={(e) => {
			if (e.target === e.currentTarget) cancel();
		}}
		onkeydown={onKey}
		role="presentation"
	>
		<div class="pm-modal" id="pm-modal" transition:scale={{ start: 0.95, duration: 150 }}>
			<p class="pm-modal-msg">{modal.state.message}</p>
			{#if modal.state.kind === 'prompt'}
				<!-- svelte-ignore a11y_autofocus -->
				<input
					class="pm-modal-input"
					bind:value={inputValue}
					placeholder={modal.state.placeholder}
					autofocus
				/>
			{/if}
			<div class="pm-modal-actions">
				{#if modal.state.kind !== 'alert'}
					<button class="secondary" onclick={cancel}>{modal.state.cancelLabel}</button>
				{/if}
				<button
					id="pm-modal-confirm"
					class={modal.state.danger ? 'danger' : 'accent'}
					onclick={confirm}
				>
					{modal.state.confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.pm-modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(3px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 3000;
		padding: 1rem;
	}
	.pm-modal {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-xl);
		box-shadow: var(--shadow-lg);
		padding: 1.5rem;
		max-width: 400px;
		width: 100%;
	}
	.pm-modal-msg {
		margin: 0 0 1rem;
		color: var(--text-primary);
		font-size: 0.95rem;
		line-height: 1.5;
	}
	.pm-modal-input {
		width: 100%;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-input);
		color: var(--text-primary);
		margin-bottom: 1rem;
		font-size: 0.95rem;
	}
	.pm-modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
	.pm-modal-actions button {
		padding: 0.5rem 1.1rem;
		border-radius: var(--radius);
		border: none;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
	}
	.pm-modal-actions .accent {
		background: var(--accent);
		color: var(--accent-text);
	}
	.pm-modal-actions .danger {
		background: var(--red);
		color: #fff;
	}
	.pm-modal-actions .secondary {
		background: var(--bg-card-hover);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}
</style>
