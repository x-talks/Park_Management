// Toast store — mirrors js/toast.js. Bottom-right stack, auto-dismiss, click to close.
export type ToastType = 'success' | 'error' | 'warn' | 'info';

export interface ToastItem {
	id: number;
	message: string;
	type: ToastType;
	duration: number; // 0 = sticky
}

let nextId = 0;

class ToastStore {
	items = $state<ToastItem[]>([]);

	show(message: string, type: ToastType = 'success', duration = 3500): number {
		const id = nextId++;
		this.items = [...this.items, { id, message, type, duration }];
		if (duration > 0) {
			setTimeout(() => this.dismiss(id), duration);
		}
		return id;
	}

	dismiss(id: number): void {
		this.items = this.items.filter((t) => t.id !== id);
	}
}

export const toasts = new ToastStore();

/** Convenience matching the old global toast(). */
export const toast = (message: string, type: ToastType = 'success', duration = 3500) =>
	toasts.show(message, type, duration);
