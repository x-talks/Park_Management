<script lang="ts">
	import type { Spot, User, PendingRegistration } from '$lib/types';

	interface SpotGeom {
		facePts?: string;
		rect?: { x: number; y: number; w: number; h: number };
		textX: number;
		textY: number;
	}

	interface Props {
		spots: Spot[];
		users: User[];
		currentUserId: string | null;
		pendingSpotIds: Set<string>;
		selectedSpotId: string | null;
		onSpotClick: (spotId: string) => void;
	}

	let { spots, users, currentUserId, pendingSpotIds, selectedSpotId, onSpotClick }: Props = $props();

	// Geometry constants — locked, do not change
	// wall=27 span=67 step=34 gap=7; equal 7px margins
	const LEFT_SPOTS  = ['20','19','18','17','16','15','14','13','12','11'];
	const RIGHT_SPOTS = ['10','9','8','7','6','5','4','3','2','1'];

	const V40_DEFS = `
  <linearGradient id="gFree" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4ade80"/><stop offset="100%" stop-color="#15803d"/></linearGradient>
  <linearGradient id="gOcc"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f87171"/><stop offset="100%" stop-color="#b91c1c"/></linearGradient>
  <linearGradient id="gRes"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9ca3af"/><stop offset="100%" stop-color="#4b5563"/></linearGradient>
  <linearGradient id="gMine" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c4b5fd"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient>
  <linearGradient id="gPend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#b45309"/></linearGradient>
  <linearGradient id="gLane" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#131c2e"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#131c2e"/></linearGradient>
  <filter id="myGlow" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur stdDeviation="5" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="round" x="-5%" y="-5%" width="110%" height="110%">
    <feMorphology in="SourceGraphic" operator="erode" radius="2" result="eroded"/>
    <feMorphology in="eroded" operator="dilate" radius="2" result="rounded"/>
    <feComposite in="rounded" in2="SourceGraphic" operator="in"/>
  </filter>`;

	const V40_STATUS_GRADIENT: Record<string, string> = {
		free: 'gFree', occupied: 'gOcc', reserved: 'gRes', pending: 'gPend', mine: 'gMine'
	};

	function spotIdFromLabel(label: string): string {
		return label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
	}

	function getSpotData(label: string): Spot {
		const sid = spotIdFromLabel(label);
		return spots.find((s) => s.id === sid) ?? { id: sid, state: 'free', assignedUserId: null, reserved: false, owned: false, monthlyRent: 80, rentHistory: null, label };
	}

	// My spots: spots assigned to current user
	const mySpotIds = $derived.by(() => {
		if (!currentUserId) return new Set<string>();
		const me = users.find((u) => u.id === currentUserId);
		return new Set<string>(me?.assignedSpots ?? []);
	});

	function classifySpot(spotData: Spot): string {
		if (mySpotIds.has(spotData.id)) return 'mine';
		if (spotData.reserved) return 'reserved';
		if (pendingSpotIds.has(spotData.id)) return 'pending';
		return spotData.state === 'occupied' ? 'occupied' : 'free';
	}

	function textFill(kind: string): string {
		if (kind === 'occupied' || kind === 'mine' || kind === 'reserved') return '#fff';
		return '#000';
	}

	function laneGeom(rank: number, side: 'left' | 'right'): SpotGeom {
		const y0 = 456 - (rank - 1) * 34;
		const shift = rank * 2;
		const y = y0 - shift;
		if (side === 'left') {
			return { facePts: `25,${y} 95,${y - 67} 95,${y - 40} 25,${y + 27}`, textX: 60, textY: y - 20 };
		}
		return { facePts: `205,${y - 67} 275,${y} 275,${y + 27} 205,${y - 40}`, textX: 240, textY: y - 20 };
	}

	interface RenderedSpot {
		label: string;
		spotId: string;
		kind: string;
		grad: string;
		fill: string;
		isMine: boolean;
		geom: SpotGeom;
	}

	function makeRenderedSpot(label: string, geom: SpotGeom): RenderedSpot {
		const spotData = getSpotData(label);
		const kind = classifySpot(spotData);
		return {
			label, spotId: spotData.id,
			kind, grad: V40_STATUS_GRADIENT[kind] ?? 'gFree',
			fill: textFill(kind), isMine: kind === 'mine', geom
		};
	}

	// Derived rendered spots list — recomputed when spots/users/pendingSpotIds change
	const renderedSpots = $derived.by((): RenderedSpot[] => {
		const list: RenderedSpot[] = [];
		LEFT_SPOTS.forEach((lbl, i) => list.push(makeRenderedSpot(lbl, laneGeom(10 - i, 'left'))));
		RIGHT_SPOTS.forEach((lbl, i) => list.push(makeRenderedSpot(lbl, laneGeom(10 - i, 'right'))));
		list.push(makeRenderedSpot('22', { rect: { x: 107, y: 423, w: 36, h: 67 }, textX: 125, textY: 456 }));
		list.push(makeRenderedSpot('21', { rect: { x: 157, y: 423, w: 36, h: 67 }, textX: 175, textY: 456 }));
		list.push(makeRenderedSpot('B', { facePts: '95,423 25,490 95,490', textX: 72, textY: 468 }));
		list.push(makeRenderedSpot('A', { facePts: '205,423 275,490 205,490', textX: 228, textY: 468 }));
		return list;
	});

	// dm grid lines
	const gxStep = 10.142857;
	const gyStep = 5.342222;
	const vertLines = Array.from({ length: 29 }, (_, n) => {
		const x = +(8 + n * gxStep).toFixed(2);
		if (Math.abs(x - 150) < 0.5) return null;
		const stroke = (n === 0 || n === 28) ? 'rgba(255,255,255,0.08)' : n % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)';
		const dash = n % 2 !== 0 && n !== 0 && n !== 28 ? '2,3' : undefined;
		return { x, stroke, dash };
	}).filter(Boolean) as { x: number; stroke: string; dash?: string }[];

	const horizLines = Array.from({ length: 89 }, (_, n) => {
		const y = +(22 + n * gyStep).toFixed(2);
		const stroke = (n === 0 || n === 88) ? 'rgba(255,255,255,0.08)' : n % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)';
		const dash = n % 2 !== 0 && n !== 0 && n !== 88 ? '2,3' : undefined;
		return { y, stroke, dash };
	});

	const xAxisLabels: { dm: number; x: number }[] = [
		{ dm: -70, x: 8 }, { dm: -60, x: 28.29 }, { dm: -50, x: 48.57 }, { dm: -40, x: 68.86 },
		{ dm: -30, x: 89.14 }, { dm: -20, x: 109.43 }, { dm: -10, x: 129.71 }, { dm: 0, x: 150 },
		{ dm: 10, x: 170.29 }, { dm: 20, x: 190.57 }, { dm: 30, x: 210.86 }, { dm: 40, x: 231.14 },
		{ dm: 50, x: 251.43 }, { dm: 60, x: 271.71 }, { dm: 70, x: 292 }
	];
</script>

<svg
	id="parking-svg"
	viewBox="-60 -20 380 540"
	xmlns="http://www.w3.org/2000/svg"
	class="parking-svg"
	aria-label="Parking map"
>
	<!-- defs: gradients + filters -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	{@html `<defs>${V40_DEFS}</defs>`}

	<!-- dm grid -->
	<g pointer-events="none">
		{#each vertLines as l}
			<line x1={l.x} y1={22} x2={l.x} y2={492} stroke={l.stroke} stroke-width="0.5" stroke-dasharray={l.dash ?? ''} />
		{/each}
		<!-- center X highlight -->
		<line x1={150} y1={22} x2={150} y2={492} stroke="rgba(255,255,255,0.35)" stroke-width="1" />
		{#each horizLines as l}
			<line x1={8} y1={l.y} x2={292} y2={l.y} stroke={l.stroke} stroke-width="0.5" stroke-dasharray={l.dash ?? ''} />
		{/each}
	</g>

	<!-- axis labels -->
	<g pointer-events="none" font-family="system-ui">
		{#each xAxisLabels as { dm, x }}
			<text
				{x} y={14} text-anchor="middle"
				fill={dm === 0 ? 'rgba(100,100,100,1)' : (dm % 20 === 0 ? 'rgba(120,120,120,0.9)' : 'rgba(150,150,150,0.6)')}
				font-size={dm === 0 ? '7' : (dm % 20 === 0 ? '5.5' : '5')}
				font-weight={dm === 0 ? 'bold' : 'normal'}
			>{Math.abs(dm)}</text>
		{/each}
		{#each Array.from({ length: 45 }, (_, i) => i * 10) as dm}
			{@const y = +(22 + dm * 1.06818).toFixed(1)}
			{@const strong = dm % 20 === 0}
			{@const fill = strong ? 'rgba(100,100,100,0.9)' : 'rgba(150,150,150,0.6)'}
			{@const fs = strong ? '5.5' : '5'}
			<text x={3} {y} text-anchor="end" {fill} font-size={fs}>{dm}</text>
			<text x={297} {y} text-anchor="start" {fill} font-size={fs}>{dm}</text>
		{/each}
	</g>

	<!-- card background -->
	<rect x={8} y={22} width={284} height={480} rx={12} fill="#0d1117" stroke="rgba(255,255,255,0.07)" stroke-width="1.5" />
	<!-- driving lane -->
	<rect x={105} y={30} width={90} height={462} rx={5} fill="url(#gLane)" stroke="rgba(255,255,255,0.04)" stroke-width="1" />
	<!-- center dashed line -->
	<line x1={150} y1={50} x2={150} y2={483} stroke="rgba(255,255,255,0.11)" stroke-width="1.5" stroke-dasharray="13,9" />
	<!-- ENTRANCE label + arrow -->
	<text x={150} y={37} text-anchor="middle" fill="rgba(255,255,255,0.28)" font-size="6.5" font-weight="700" letter-spacing="2" font-family="system-ui">ENTRANCE</text>
	<polygon points="144,44 156,44 150,56" fill="rgba(255,255,255,0.35)" />

	<!-- spots -->
	{#each renderedSpots as s (s.spotId)}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<g
			data-id={s.spotId}
			class="spot spot-group {s.kind}"
			class:selected={selectedSpotId === s.spotId}
			style="cursor:pointer"
			onclick={() => onSpotClick(s.spotId)}
		>
			{#if s.isMine}
				<g filter="url(#myGlow)">
					{#if s.geom.rect}
						<rect x={s.geom.rect.x} y={s.geom.rect.y} width={s.geom.rect.w} height={s.geom.rect.h} rx={3} fill="url(#{s.grad})" filter="url(#round)" />
					{:else if s.geom.facePts}
						<polygon points={s.geom.facePts} fill="url(#{s.grad})" filter="url(#round)" />
					{/if}
				</g>
			{:else if s.geom.rect}
				<rect x={s.geom.rect.x} y={s.geom.rect.y} width={s.geom.rect.w} height={s.geom.rect.h} rx={3} fill="url(#{s.grad})" filter="url(#round)" />
			{:else if s.geom.facePts}
				<polygon points={s.geom.facePts} fill="url(#{s.grad})" filter="url(#round)" />
			{/if}
			<text
				x={s.geom.textX} y={s.geom.textY}
				text-anchor="middle" dominant-baseline="middle"
				fill={s.fill} font-size="9" font-weight="800" font-family="system-ui"
				pointer-events="none"
			>{s.label}</text>
		</g>
	{/each}
</svg>

<style>
	.parking-svg {
		width: 100%;
		max-width: 400px;
		display: block;
		margin: 0 auto;
		overflow: visible;
	}
	:global(.spot.selected) rect,
	:global(.spot.selected) polygon {
		stroke: #fff;
		stroke-width: 2;
	}
</style>
