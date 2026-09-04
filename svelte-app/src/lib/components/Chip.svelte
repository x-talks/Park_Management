<script lang="ts">
	// Pill-style status chip. `variant` maps to a semantic color class.
	export type Variant =
		| 'free'
		| 'occupied'
		| 'reserved'
		| 'pending'
		| 'active'
		| 'inactive'
		| 'paid'
		| 'unpaid'
		| 'partial'
		| 'warn'
		| 'neutral';

	let { variant = 'neutral', text, label }: { variant?: Variant; text?: string; label?: string } = $props();
	const display = $derived(label ?? text ?? '');
</script>

<span class="chip chip-{variant}">{display}</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		border: 1px solid transparent;
	}
	.chip-free,
	.chip-active,
	.chip-paid {
		background: var(--green-bg);
		color: var(--green);
	}
	.chip-occupied,
	.chip-inactive,
	.chip-unpaid {
		background: var(--red-bg);
		color: var(--red);
	}
	.chip-pending,
	.chip-partial,
	.chip-warn {
		background: var(--amber-bg);
		color: var(--amber);
	}
	.chip-reserved,
	.chip-neutral {
		background: var(--gray-100);
		color: var(--text-secondary);
	}
</style>
