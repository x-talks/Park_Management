<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { logout } from '$lib/api/auth';

	const tabs = $derived.by(() => {
		const role = session.user?.role ?? 'renter';
		const ROLE_ORDER = { renter: 0, admin: 1, master: 2 };
		const all = [
			{ href: base + '/parking', icon: '🗺', key: 'nav.map' as const },
			{ href: base + '/admin', icon: '⚙️', key: 'nav.admin' as const, minRole: 'admin' as const },
			{ href: base + '/incident', icon: '⚠️', key: 'nav.incidents' as const },
			{ href: base + '/profile', icon: '👤', key: 'nav.profile' as const }
		];
		return all.filter((t) => !t.minRole || ROLE_ORDER[role] >= ROLE_ORDER[t.minRole]);
	});

	function isActive(href: string) {
		return $page.url.pathname.startsWith(href);
	}
</script>

<nav class="fixed bottom-0 left-0 right-0 z-50 flex h-[60px] items-stretch border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
	{#each tabs as tab}
		<a
			href={tab.href}
			class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors
				{isActive(tab.href)
					? 'text-primary'
					: 'text-muted-foreground hover:text-foreground'}"
		>
			<span class="text-lg leading-none">{tab.icon}</span>
			<span>{i18n.t(tab.key)}</span>
		</a>
	{/each}
	<button
		onclick={logout}
		class="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
	>
		<span class="text-lg leading-none">🚪</span>
		<span>{i18n.t('nav.logout')}</span>
	</button>
</nav>
