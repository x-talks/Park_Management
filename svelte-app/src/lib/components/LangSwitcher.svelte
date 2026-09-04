<script lang="ts">
	import { i18n, type Lang } from '$lib/stores/i18n.svelte';

	const LANGS: Lang[] = ['en', 'de', 'tr'];

	let open = $state(false);

	function toggle() {
		open = !open;
	}

	function pick(lang: Lang) {
		i18n.setLang(lang);
		open = false;
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class="lang-globe-wrap" class:open>
	<button class="lang-globe-btn secondary" onclick={toggle} aria-haspopup="listbox">
		🌐 {i18n.lang.toUpperCase()}
	</button>
	{#if open}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="lang-backdrop" onclick={() => (open = false)}></div>
		<div class="lang-dropdown" role="listbox">
			{#each LANGS as lang}
				<button
					class="lang-option"
					class:active={lang === i18n.lang}
					role="option"
					aria-selected={lang === i18n.lang}
					data-lang={lang}
					onclick={() => pick(lang)}
				>
					{lang.toUpperCase()}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.lang-globe-wrap {
		position: relative;
	}
	.lang-globe-btn {
		font-size: 0.8rem;
		font-weight: 700;
		padding: 0.3rem 0.7rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-primary);
		cursor: pointer;
		white-space: nowrap;
	}
	.lang-backdrop {
		position: fixed;
		inset: 0;
		z-index: 99;
	}
	.lang-dropdown {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow-md);
		z-index: 100;
		overflow: hidden;
		min-width: 70px;
	}
	.lang-option {
		display: block;
		width: 100%;
		padding: 0.45rem 0.9rem;
		font-size: 0.8rem;
		font-weight: 700;
		text-align: left;
		background: none;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
	}
	.lang-option:hover {
		background: var(--bg-card-hover);
	}
	.lang-option.active {
		color: var(--accent);
	}
</style>
