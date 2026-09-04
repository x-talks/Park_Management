<script lang="ts">
	import type { Role } from '$lib/types';

	let {
		name,
		role
	}: {
		name: string;
		role: Role;
	} = $props();

	const initials = $derived(
		name
			.split(/[\s-]/)
			.map((w) => w[0] ?? '')
			.slice(0, 2)
			.join('')
			.toUpperCase()
	);
</script>

<span class="user-chip chip-{role}">
	<span class="user-chip-avatar">{initials}</span>
	<span class="user-chip-label">{name}</span>
</span>

<style>
	.user-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.55rem 0.2rem 0.25rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		white-space: nowrap;
		max-width: 120px;
		overflow: hidden;
	}
	.user-chip-avatar {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.72rem;
		font-weight: 800;
		flex-shrink: 0;
	}
	.user-chip-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chip-renter {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.75);
	}
	.chip-renter .user-chip-avatar {
		background: rgba(255, 255, 255, 0.15);
		color: #fff;
	}
	.chip-admin {
		background: rgba(99, 179, 237, 0.15);
		color: #63b3ed;
	}
	.chip-admin .user-chip-avatar {
		background: rgba(99, 179, 237, 0.25);
		color: #90cdf4;
	}
	.chip-master {
		background: rgba(246, 173, 85, 0.15);
		color: #f6ad55;
	}
	.chip-master .user-chip-avatar {
		background: rgba(246, 173, 85, 0.25);
		color: #fbd38d;
	}
	@media (max-width: 640px) {
		.user-chip-label {
			display: none;
		}
		.user-chip {
			padding: 0;
			background: none;
		}
		.user-chip-avatar {
			width: 1.8rem;
			height: 1.8rem;
			font-size: 0.8rem;
		}
	}
</style>
