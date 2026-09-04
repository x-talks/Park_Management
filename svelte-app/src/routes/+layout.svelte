<script lang="ts">
	import '$lib/styles/tokens.css';
	import '$lib/styles/app.css';
	import { page } from '$app/stores';
	import { session } from '$lib/stores/session.svelte';
	import { initAuth } from '$lib/api/auth';
	import { browser } from '$app/environment';
	import Toast from '$lib/components/Toast.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ReauthModal from '$lib/components/ReauthModal.svelte';
	import SiteHeader from '$lib/components/SiteHeader.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';

	let { children } = $props();

	if (browser) {
		initAuth();
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('./sw.js').catch(() => {/* SW optional */});
		}
	}

	const isAuthPage = $derived(
		$page.url.pathname === '/' || $page.url.pathname.startsWith('/register')
	);
	const showChrome = $derived(!isAuthPage && !!session.user);
</script>

{#if showChrome}
	<SiteHeader />
{/if}

<main class="page-wrap">
	{@render children()}
</main>

{#if showChrome}
	<BottomNav />
{/if}

<Toast />
<Modal />
<ReauthModal />
