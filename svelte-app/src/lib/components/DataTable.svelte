<script lang="ts" generics="T extends Record<string, unknown>">
	import type { Snippet } from 'svelte';

	type SortDir = 'asc' | 'desc';

	interface Column<R> {
		key: string;
		label: string;
		sortable?: boolean;
		cell?: Snippet<[R]>;
	}

	let {
		columns,
		rows,
		rowClass,
		emptyText = '—'
	}: {
		columns: Column<T>[];
		rows: T[];
		rowClass?: (row: T) => string;
		emptyText?: string;
	} = $props();

	let sortKey = $state<string | null>(null);
	let sortDir = $state<SortDir>('asc');

	const sorted = $derived.by(() => {
		if (!sortKey) return rows;
		const col = sortKey;
		return [...rows].sort((a, b) => {
			const av = a[col];
			const bv = b[col];
			const cmp =
				typeof av === 'string' && typeof bv === 'string'
					? av.localeCompare(bv)
					: (av as number) < (bv as number)
						? -1
						: (av as number) > (bv as number)
							? 1
							: 0;
			return sortDir === 'asc' ? cmp : -cmp;
		});
	});

	function setSort(key: string) {
		if (sortKey === key) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortKey = key;
			sortDir = 'asc';
		}
	}
</script>

<div class="table-wrap">
	<table>
		<thead>
			<tr>
				{#each columns as col}
					<th
						class:sortable={col.sortable}
						class:sorted={sortKey === col.key}
						onclick={col.sortable ? () => setSort(col.key) : undefined}
					>
						{col.label}
						{#if col.sortable && sortKey === col.key}
							<span class="sort-arrow">{sortDir === 'asc' ? '↑' : '↓'}</span>
						{/if}
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if sorted.length === 0}
				<tr>
					<td colspan={columns.length} class="empty-cell">{emptyText}</td>
				</tr>
			{:else}
				{#each sorted as row}
					<tr class={rowClass?.(row) ?? ''}>
						{#each columns as col}
							<td>
								{#if col.cell}
									{@render col.cell(row)}
								{:else}
									{row[col.key] ?? ''}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
		border-radius: var(--radius);
		border: 1px solid var(--border);
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	th {
		background: var(--bg-page);
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 0.55rem 0.75rem;
		text-align: left;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}
	th.sortable {
		cursor: pointer;
		user-select: none;
	}
	th.sortable:hover {
		color: var(--text-primary);
	}
	th.sorted {
		color: var(--accent);
	}
	.sort-arrow {
		margin-left: 0.25rem;
		font-size: 0.7rem;
	}
	td {
		padding: 0.55rem 0.75rem;
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
		vertical-align: middle;
		color: var(--text-primary);
	}
	tr:last-child td {
		border-bottom: none;
	}
	tr:hover td {
		background: var(--bg-card-hover);
	}
	.empty-cell {
		text-align: center;
		color: var(--text-muted);
		padding: 1.5rem;
	}
</style>
