<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { logout } from '$lib/api/auth';
	import { Button } from '$lib/components/ui/button';
	import UserChip from './UserChip.svelte';
	import LangSwitcher from './LangSwitcher.svelte';
	import { Sun, Moon } from 'lucide-svelte';

	const links = $derived.by(() => {
		const role = session.user?.role ?? 'renter';
		const all = [
			{ href: base + '/parking', key: 'nav.map' as const },
			{ href: base + '/admin', key: 'nav.admin' as const, minRole: 'admin' as const },
			{ href: base + '/incident', key: 'nav.incidents' as const },
			{ href: base + '/profile', key: 'nav.profile' as const }
		];
		const ROLE_ORDER = { renter: 0, admin: 1, master: 2 };
		return all.filter((l) => !l.minRole || ROLE_ORDER[role] >= ROLE_ORDER[l.minRole]);
	});

	function isActive(href: string) {
		return $page.url.pathname.startsWith(href);
	}
</script>

<header class="site-header">
	<a href="{base}/parking" class="logo-link">
		<span style="font-size:1.4rem">🅿</span>
		<h1>{i18n.t('app.name')}</h1>
	</a>
	<nav class="site-nav">
		<div class="nav-links">
			{#each links as link}
				<a href={link.href} class:active={isActive(link.href)}>{i18n.t(link.key)}</a>
			{/each}
		</div>
		<div class="nav-controls">
			{#if session.user}
				<UserChip name={session.user.name ?? session.user.username} role={session.user.role} />
			{/if}
			<LangSwitcher />
			<Button
				variant="ghost"
				size="icon"
				class="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
				onclick={() => theme.cycle()}
				title="Toggle theme"
			>
				{#if theme.current === 'light'}
					<Sun size={15} />
				{:else}
					<Moon size={15} />
				{/if}
			</Button>
			<Button
				variant="ghost"
				size="sm"
				class="text-white/70 hover:text-white hover:bg-white/10"
				onclick={logout}
			>
				{i18n.t('nav.logout')}
			</Button>
		</div>
	</nav>
</header>
