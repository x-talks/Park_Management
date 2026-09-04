<script lang="ts">
	import type { Snippet } from 'svelte';

	type Color = 'green' | 'blue' | 'amber' | 'red';

	let {
		label,
		value,
		color = 'blue',
		icon
	}: {
		label: string;
		value: string | number;
		color?: Color;
		icon?: Snippet;
	} = $props();
</script>

<div class="stat-card {color}">
	<div class="stat-card-label">
		{#if icon}{@render icon()}{/if}
		{label}
	</div>
	<div class="stat-card-value">{value}</div>
</div>

<style>
	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-lg);
		padding: 1rem 1.1rem;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		box-shadow: var(--shadow-sm);
		border-left: 3px solid var(--border);
		transition: box-shadow var(--transition-md);
	}
	.stat-card:hover {
		box-shadow: var(--shadow-md);
	}
	.green {
		border-left-color: var(--green);
	}
	.blue {
		border-left-color: var(--blue);
	}
	.amber {
		border-left-color: var(--amber);
	}
	.red {
		border-left-color: var(--red);
	}
	.stat-card-label {
		font-size: 0.72rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary);
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}
	.green .stat-card-label {
		color: var(--green);
	}
	.blue .stat-card-label {
		color: var(--blue);
	}
	.amber .stat-card-label {
		color: var(--amber);
	}
	.red .stat-card-label {
		color: var(--red);
	}
	.stat-card-value {
		font-size: 1.9rem;
		font-weight: 800;
		line-height: 1;
		color: var(--text-primary);
		letter-spacing: -0.03em;
	}
</style>
