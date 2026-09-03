// Theme store — light ↔ dark-glass cycle, persisted to localStorage['pm-theme'].
// Mirrors js/theme.js: applying 'light' removes the data-theme attribute.
import { browser } from '$app/environment';

export type Theme = 'light' | 'dark-glass';

const THEMES: Theme[] = ['light', 'dark-glass'];
const STORAGE_KEY = 'pm-theme';

function readInitial(): Theme {
	if (!browser) return 'light';
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw === 'dark-deep') return 'dark-glass'; // migrate legacy
	return raw === 'dark-glass' ? 'dark-glass' : 'light';
}

class ThemeStore {
	current = $state<Theme>(readInitial());

	apply(theme: Theme): void {
		this.current = theme;
		if (!browser) return;
		if (theme === 'light') {
			delete document.documentElement.dataset.theme;
		} else {
			document.documentElement.dataset.theme = theme;
		}
		localStorage.setItem(STORAGE_KEY, theme);
	}

	cycle(): void {
		const idx = THEMES.indexOf(this.current);
		this.apply(THEMES[(idx + 1) % THEMES.length]);
	}
}

export const theme = new ThemeStore();
