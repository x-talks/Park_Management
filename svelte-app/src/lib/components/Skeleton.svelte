<script lang="ts">
	// Shimmer loading placeholder.
	let { width = '100%', height = '1rem' }: { width?: string; height?: string } = $props();
</script>

<span class="skeleton" style="width:{width};height:{height}"></span>

<style>
	.skeleton {
		display: inline-block;
		border-radius: var(--radius-sm);
		background: linear-gradient(
			90deg,
			var(--bg-card-hover) 25%,
			var(--border) 37%,
			var(--bg-card-hover) 63%
		);
		background-size: 400% 100%;
		animation: skeleton-shimmer 1.4s ease infinite;
	}
	@keyframes skeleton-shimmer {
		0% {
			background-position: 100% 50%;
		}
		100% {
			background-position: 0 50%;
		}
	}
</style>
