<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '$lib/stores/session.svelte';
	import { i18n } from '$lib/stores/i18n.svelte';
	import { getSpots, getIncidents, getUsers, uploadIncidentImage } from '$lib/api/supabase';
	import { createIncident, deleteIncident as apiDeleteIncident } from '$lib/api/endpoints';
	import { toast } from '$lib/stores/toast.svelte';
	import { sortSpots } from '$lib/utils/spots';
	import { modalConfirm } from '$lib/stores/modal.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import * as Select from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import type { Spot, Incident, User } from '$lib/types';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	let spots = $state<Spot[]>([]);
	let incidents = $state<Incident[]>([]);
	let users = $state<User[]>([]);

	let spotId = $state('');
	let plate = $state('');
	let note = $state('');
	let file = $state<File | null>(null);
	let previewUrl = $state('');
	let hasImage = $state(false);
	let submitting = $state(false);

	let lightboxUrl = $state('');
	let lightboxOpen = $state(false);

	onMount(async () => {
		if (!session.user) { void goto(base + '/', { replaceState: true }); return; }
		[spots, incidents, users] = await Promise.all([getSpots(), getIncidents(), getUsers()]);
		spots = sortSpots(spots);
		if (session.user?.role === 'renter') {
			const me = users.find((u) => u.id === session.user?.id);
			if (me?.assignedSpots?.length) spotId = me.assignedSpots[0];
		}
		incidents = [...incidents].sort((a, b) => (b.reportedAt ?? '').localeCompare(a.reportedAt ?? ''));
	});

	const visibleIncidents = $derived.by(() => {
		const uid = session.user?.id;
		const role = session.user?.role;
		if (role === 'admin' || role === 'master') return incidents;
		const me = users.find((u) => u.id === uid);
		const mySpots = me?.assignedSpots ?? [];
		return incidents.filter((i) => mySpots.includes(i.spotId));
	});

	function onFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0] ?? null;
		file = f;
		if (f) { previewUrl = URL.createObjectURL(f); hasImage = true; }
	}

	function resetForm() {
		spotId = ''; plate = ''; note = ''; file = null; previewUrl = ''; hasImage = false;
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!file) { toast(i18n.t('inc.err.nophoto'), 'error'); return; }
		submitting = true;
		try {
			const ext = file.type.includes('png') ? 'png' : 'jpg';
			const ts = new Date().toISOString().replace(/[:.]/g, '-');
			const filePath = `${spotId}/${ts}_${session.user!.id}.${ext}`;
			const imageUrl = await uploadIncidentImage(filePath, file);
			const result = await createIncident({ spotId, observedPlate: plate.toUpperCase() || null, note: note || null, imageUrl, filePath });
			const newInc: Incident = {
				id: result?.id ?? String(Date.now()), spotId,
				reportedByUserId: session.user!.id, observedPlate: plate.toUpperCase() || null,
				note: note || null, imageUrl, filePath, reportedAt: new Date().toISOString()
			};
			incidents = [newInc, ...incidents];
			toast(i18n.t('inc.success'), 'success');
			resetForm();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Error', 'error');
		} finally { submitting = false; }
	}

	async function deleteIncident(inc: Incident) {
		const ok = await modalConfirm(i18n.t('inc.confirm.delete'), { danger: true });
		if (!ok) return;
		try {
			await apiDeleteIncident(inc.id);
			incidents = incidents.filter((i) => i.id !== inc.id);
			toast(i18n.t('inc.deleted'), 'success');
		} catch (err) { toast(err instanceof Error ? err.message : 'Error', 'error'); }
	}

	function formatDate(iso: string | null | undefined) {
		if (!iso) return '—';
		return new Date(iso).toLocaleString();
	}
	function spotLabel(sid: string) {
		const s = spots.find((sp) => sp.id === sid);
		return s ? `Spot ${s.label}` : sid;
	}
	function reporterName(uid: string) {
		const u = users.find((us) => us.id === uid);
		if (!u) return 'Unknown';
		return `${u.name ?? ''} ${u.lastName ?? ''}`.trim() || u.username;
	}
</script>

<div class="space-y-4">
	<Card.Root>
		<Card.Header>
			<Card.Title>{i18n.t('inc.title')}</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4">
			<div class="rounded-md border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-500">
				<strong class="block mb-1">📷 {i18n.t('inc.tips.title')}</strong>
				<ol class="list-decimal pl-4 space-y-0.5 text-xs">
					{#each [1,2,3,4,5] as n}
						<li><strong>{i18n.t(`inc.tip${n}.title` as Parameters<typeof i18n.t>[0])}</strong> — {i18n.t(`inc.tip${n}.desc` as Parameters<typeof i18n.t>[0])}</li>
					{/each}
				</ol>
			</div>

			<form onsubmit={submit} class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="space-y-1.5">
						<Label for="inc-spot">{i18n.t('inc.label.spot')} *</Label>
						<select
							id="inc-spot"
							bind:value={spotId}
							required
							class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring"
						>
							<option value="">{i18n.t('inc.spot.default')}</option>
							{#each spots as s}
								<option value={s.id}>{spotLabel(s.id)}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-1.5">
						<Label for="inc-plate">{i18n.t('inc.label.plate')}</Label>
						<Input id="inc-plate" bind:value={plate} placeholder={i18n.t('inc.placeholder.plate')} class="uppercase" />
					</div>
				</div>
				<div class="space-y-1.5">
					<Label for="inc-note">{i18n.t('inc.label.note')}</Label>
					<Textarea id="inc-note" bind:value={note} rows={2} placeholder={i18n.t('inc.placeholder.note')} />
				</div>
				<div class="space-y-1.5">
					<Label for="inc-photo">{i18n.t('inc.label.photo')} *</Label>
					<div class="camera-zone" class:has-image={hasImage}>
						<input id="inc-photo" type="file" accept="image/*" capture="environment" onchange={onFileChange} required />
						<span class="camera-icon">{hasImage ? '✓' : '📷'}</span>
						<span class="camera-label">{hasImage ? (file?.name ?? '') : i18n.t('inc.camera.label')}</span>
					</div>
					{#if previewUrl}
						<img src={previewUrl} alt="Preview" class="mt-2 max-h-64 max-w-full rounded-md shadow-md" />
					{/if}
				</div>
				<div class="flex gap-2">
					<Button type="submit" disabled={submitting}>
						{submitting ? i18n.t('inc.btn.uploading') : i18n.t('inc.btn.submit')}
					</Button>
					<Button type="button" variant="outline" onclick={resetForm}>{i18n.t('inc.btn.clear')}</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>

	<Card.Root id="incident-log">
		<Card.Header class="flex-row items-center justify-between space-y-0 pb-3">
			<Card.Title>{i18n.t('inc.log.title')}</Card.Title>
			<span class="text-sm text-muted-foreground">{visibleIncidents.length}</span>
		</Card.Header>
		<Card.Content>
			{#if visibleIncidents.length === 0}
				<p class="text-sm text-muted-foreground">{i18n.t('inc.log.empty')}</p>
			{:else}
				<div class="space-y-3">
					{#each visibleIncidents as inc (inc.id)}
						<div class="incident-card">
							{#if inc.imageUrl}
								<button class="img-btn" onclick={() => { lightboxUrl = inc.imageUrl!; lightboxOpen = true; }}>
									<img class="incident-thumb" src={inc.imageUrl} alt="" />
								</button>
							{/if}
							<div class="incident-meta">
								<strong class="block">{spotLabel(inc.spotId)}</strong>
								{#if inc.observedPlate}
									<span class="plate-badge">{inc.observedPlate}</span>
								{/if}
								<div class="text-xs text-muted-foreground">{formatDate(inc.reportedAt)} · {reporterName(inc.reportedByUserId)}</div>
								{#if inc.note}<div class="text-sm mt-0.5">{inc.note}</div>{/if}
							</div>
							{#if session.hasRole('admin')}
								<Button variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onclick={() => deleteIncident(inc)} title={i18n.t('inc.btn.delete')}>✕</Button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

{#if lightboxOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="lightbox" onclick={() => (lightboxOpen = false)}>
		<button class="lightbox-close" onclick={() => (lightboxOpen = false)}>×</button>
		<img src={lightboxUrl} alt="" />
	</div>
{/if}

<style>
	.camera-zone {
		border: 2px dashed var(--border);
		border-radius: var(--radius);
		padding: 1.5rem 1rem;
		text-align: center;
		cursor: pointer;
		transition: border-color var(--transition), background var(--transition);
		position: relative;
	}
	.camera-zone:hover { border-color: var(--text-muted); background: var(--bg-card-hover); }
	.camera-zone.has-image { border-color: var(--green); background: var(--green-bg); }
	.camera-zone input[type='file'] { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
	.camera-icon { font-size: 2.5rem; margin-bottom: 0.5rem; display: block; }
	.camera-label { font-size: 0.85rem; color: var(--text-secondary); font-weight: 600; }
	.incident-card {
		background: var(--bg-card-hover);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}
	.img-btn { background: none; border: none; padding: 0; cursor: pointer; flex-shrink: 0; }
	.incident-thumb { width: 90px; height: 68px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border); }
	.incident-meta { flex: 1; min-width: 0; font-size: 0.82rem; line-height: 1.6; }
	.plate-badge {
		font-size: 0.75rem; font-weight: 700; background: var(--bg-card-hover);
		border-radius: var(--radius-sm); padding: 0.1rem 0.4rem; margin-left: 0.4rem;
	}
	.lightbox {
		display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.88);
		z-index: 999; align-items: center; justify-content: center; padding: 1rem;
	}
	.lightbox img { max-width: 96vw; max-height: 92vh; border-radius: 6px; box-shadow: 0 8px 40px rgba(0,0,0,0.6); }
	.lightbox-close {
		position: absolute; top: 1rem; right: 1.2rem; color: #fff;
		font-size: 2rem; cursor: pointer; background: none; border: none; font-weight: 700;
	}
</style>
