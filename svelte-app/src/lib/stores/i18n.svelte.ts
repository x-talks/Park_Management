// i18n store — reactive t() with positional interpolation and English fallback.
// Mirrors js/i18n.js: locale persisted under localStorage['lang'] (NOT 'pm_lang').
import { browser } from '$app/environment';
import en from '$lib/i18n/en';
import de from '$lib/i18n/de';
import tr from '$lib/i18n/tr';

export type Lang = 'en' | 'de' | 'tr';

const SUPPORTED: Lang[] = ['en', 'de', 'tr'];
const STORAGE_KEY = 'lang';
const DICTS: Record<Lang, Record<string, string>> = { en, de, tr };

function readInitial(): Lang {
	if (!browser) return 'en';
	const raw = localStorage.getItem(STORAGE_KEY);
	return SUPPORTED.includes(raw as Lang) ? (raw as Lang) : 'en';
}

class I18nStore {
	lang = $state<Lang>(readInitial());

	/** Translate a key with positional {0},{1},… interpolation. Falls back to en, then the raw key. */
	t(key: string, ...args: (string | number)[]): string {
		const dict = DICTS[this.lang];
		let str = dict[key] ?? DICTS.en[key] ?? key;
		for (let i = 0; i < args.length; i++) {
			str = str.replaceAll(`{${i}}`, String(args[i]));
		}
		return str;
	}

	setLang(lang: Lang): void {
		if (!SUPPORTED.includes(lang)) return;
		this.lang = lang;
		if (browser) {
			localStorage.setItem(STORAGE_KEY, lang);
			document.documentElement.lang = lang;
		}
	}

	get supported(): Lang[] {
		return SUPPORTED;
	}
}

export const i18n = new I18nStore();

/** Convenience: reactive translate bound to the store. Use as `t('key', arg0)` in components. */
export function t(key: string, ...args: (string | number)[]): string {
	return i18n.t(key, ...args);
}
