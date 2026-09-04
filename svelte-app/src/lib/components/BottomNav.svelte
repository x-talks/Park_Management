<script lang="ts">
	import { page } from '$app/stores';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { logout } from '$lib/api/auth';

	const tabs = $derived.by(() => {
		const role = session.user?.role ?? 'renter';
		const ROLE_ORDER = { renter: 0, admin: 1, master: 2 };
		const all = [
			{ href: '/parking', icon: '🗺', key: 'nav.map' as const },
			{ href: '/admin', icon: '⚙️', key: 'nav.admin' as const, minRole: 'admin' as const },
			{ href: '/incident', icon: '⚠️', key: 'nav.incidents' as const },
			{ href: '/profile', icon: '👤', key: 'nav.profile' as const }
		];
		return all.filter((t) => !t.minRole || ROLE_ORDER[role] >= ROLE_ORDER[t.minRole]);
	});

	function isActive(href: string) {
		return $page.url.pathname.startsWith(href);
	}
</script>

<nav class="bottom-nav">
	{#each tabs as tab}
		<a href={tab.href} class:active={isActive(tab.href)}>
			<span class="bn-icon">{tab.icon}</span>
			<span>{i18n.t(tab.key)}</span>
		</a>
	{/each}
	<button onclick={logout}>
		<span class="bn-icon">🚪</span>
		<span>{i18n.t('nav.logout')}</span>
	</button>
</nav>
