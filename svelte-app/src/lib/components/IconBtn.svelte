<script lang="ts">
	import type { Snippet } from 'svelte';

	// Square icon button. The accessible label lives in `title` (matches the
	// original iconBtn contract, so E2E selectors like button[title="Unreserve"]
	// keep working). Children render the icon (lucide-svelte or a glyph).
	type Variant = 'secondary' | 'success-btn' | 'danger' | 'warning-btn' | 'accent';

	let {
		title,
		variant = 'secondary',
		onclick,
		disabled = false,
		children
	}: {
		title: string;
		variant?: Variant;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		children: Snippet;
	} = $props();
</script>

<button class="icon-btn {variant}" {title} {onclick} {disabled} aria-label={title}>
	{@render children()}
</button>

<style>
	.icon-btn {
		width: 2rem;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		color: var(--text-primary);
		cursor: pointer;
		font-size: 0.85rem;
		transition: background var(--transition), opacity var(--transition);
	}
	.icon-btn:hover:not(:disabled) {
		background: var(--bg-card-hover);
	}
	.icon-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.success-btn {
		color: var(--green);
		border-color: var(--green);
	}
	.danger {
		color: var(--red);
		border-color: var(--red);
	}
	.warning-btn {
		color: var(--amber);
		border-color: var(--amber);
	}
	.accent {
		color: var(--accent);
		border-color: var(--accent);
	}
</style>
