// Poll store — fires a callback every 30s + on visibility restore.
// Used by parking and admin pages to refresh data reactively.
import { browser } from '$app/environment';

export class PollStore {
	private interval: ReturnType<typeof setInterval> | null = null;
	private handler: (() => void) | null = null;

	start(callback: () => void) {
		if (!browser) return;
		this.stop();
		this.handler = callback;
		this.interval = setInterval(callback, 30_000);
		document.addEventListener('visibilitychange', this.onVisible);
	}

	stop() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		document.removeEventListener('visibilitychange', this.onVisible);
		this.handler = null;
	}

	private onVisible = () => {
		if (document.visibilityState === 'visible') this.handler?.();
	};
}

export const poller = new PollStore();
