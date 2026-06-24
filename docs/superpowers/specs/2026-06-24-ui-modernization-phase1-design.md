# UI Modernization — Phase 1: Design System Foundation

**Goal:** Replace the current flat, rigid UI with a modern design system: Inter font, Lucide SVG icons, a unified CSS token architecture, and a 3-theme system (Light Premium, Dark Glass, Dark Deep). This is the foundation all subsequent phases build on.

**Architecture:** A single `css/style.css` rewrite (CSS custom properties, no build step), a new `css/themes.css` for theme switching logic, and a `js/theme.js` module for theme toggle persistence. All HTML pages load the new CSS and the theme JS. No framework — vanilla CSS + JS only. Zero license cost.

**Tech Stack:** Inter (Google Fonts CDN), Lucide (CDN ESM import, MIT), CSS custom properties, `localStorage` for theme persistence.

---

## 1. Design Tokens (CSS Custom Properties)

All visual values are expressed as CSS custom properties on `:root`. Theme switching works by overriding these on `[data-theme="dark-glass"]` and `[data-theme="dark-deep"]`.

### Light Premium (default — no data-theme attribute)

```css
:root {
  /* Surface */
  --bg-page:        #f0f2f5;
  --bg-card:        #ffffff;
  --bg-card-hover:  #f8f9fb;
  --bg-input:       #ffffff;
  --bg-input-focus: #ffffff;

  /* Header */
  --header-bg:      #0f0f14;
  --header-text:    #ffffff;

  /* Text */
  --text-primary:   #0d0d12;
  --text-secondary: #6b7280;
  --text-muted:     #9ca3af;
  --text-inverse:   #ffffff;

  /* Borders */
  --border:         #e5e7eb;
  --border-focus:   #0d0d12;

  /* Brand / accent */
  --accent:         #4f46e5;    /* indigo-600 */
  --accent-hover:   #4338ca;
  --accent-text:    #ffffff;

  /* Semantic */
  --green:          #059669;
  --green-bg:       #d1fae5;
  --red:            #dc2626;
  --red-bg:         #fee2e2;
  --amber:          #d97706;
  --amber-bg:       #fef3c7;
  --blue:           #2563eb;
  --blue-bg:        #eff6ff;

  /* Spots (parking SVG) */
  --spot-free-fill:     #4ade80;
  --spot-free-stroke:   #16a34a;
  --spot-occ-fill:      #f87171;
  --spot-occ-stroke:    #dc2626;
  --spot-res-fill:      #9ca3af;
  --spot-res-stroke:    #6b7280;
  --spot-pend-fill:     #fbbf24;
  --spot-pend-stroke:   #d97706;
  --spot-mine-fill:     #818cf8;
  --spot-mine-stroke:   #4f46e5;

  /* Elevation */
  --shadow-sm:      0 1px 2px rgba(0,0,0,.05);
  --shadow:         0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06);
  --shadow-md:      0 4px 6px rgba(0,0,0,.07), 0 2px 4px rgba(0,0,0,.05);
  --shadow-lg:      0 10px 15px rgba(0,0,0,.08), 0 4px 6px rgba(0,0,0,.05);

  /* Shape */
  --radius-sm:  4px;
  --radius:     8px;
  --radius-lg:  12px;
  --radius-xl:  16px;

  /* Motion */
  --transition:     0.15s ease;
  --transition-md:  0.25s ease;
}
```

### Dark Glass (data-theme="dark-glass")

Glassmorphism aesthetic: semi-transparent frosted surfaces, vivid indigo accent, colored glows.

```css
[data-theme="dark-glass"] {
  --bg-page:        #0a0a12;
  --bg-card:        rgba(255,255,255,0.06);
  --bg-card-hover:  rgba(255,255,255,0.09);
  --bg-input:       rgba(255,255,255,0.08);
  --bg-input-focus: rgba(255,255,255,0.12);

  --header-bg:      rgba(10,10,20,0.85);
  --header-text:    #ffffff;

  --text-primary:   #f0f0ff;
  --text-secondary: #a5b4fc;
  --text-muted:     #6366f1;
  --text-inverse:   #0a0a12;

  --border:         rgba(255,255,255,0.10);
  --border-focus:   #818cf8;

  --accent:         #818cf8;
  --accent-hover:   #a5b4fc;
  --accent-text:    #0a0a12;

  --green:          #34d399;
  --green-bg:       rgba(52,211,153,0.12);
  --red:            #f87171;
  --red-bg:         rgba(248,113,113,0.12);
  --amber:          #fbbf24;
  --amber-bg:       rgba(251,191,36,0.12);
  --blue:           #60a5fa;
  --blue-bg:        rgba(96,165,250,0.12);

  --spot-free-fill:     rgba(74,222,128,0.8);
  --spot-free-stroke:   #4ade80;
  --spot-occ-fill:      rgba(248,113,113,0.8);
  --spot-occ-stroke:    #f87171;
  --spot-res-fill:      rgba(156,163,175,0.5);
  --spot-res-stroke:    #9ca3af;
  --spot-pend-fill:     rgba(251,191,36,0.8);
  --spot-pend-stroke:   #fbbf24;
  --spot-mine-fill:     rgba(129,140,248,0.85);
  --spot-mine-stroke:   #818cf8;

  --shadow-sm:      0 1px 2px rgba(0,0,0,.4);
  --shadow:         0 1px 3px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.05);
  --shadow-md:      0 4px 24px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06);
  --shadow-lg:      0 10px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.07);
}
```

### Dark Deep (data-theme="dark-deep")

Rich, solid dark surfaces — no frosted glass, deep navy tones, warmer accent.

```css
[data-theme="dark-deep"] {
  --bg-page:        #0d1117;
  --bg-card:        #161b22;
  --bg-card-hover:  #1c2128;
  --bg-input:       #1c2128;
  --bg-input-focus: #21262d;

  --header-bg:      #010409;
  --header-text:    #e6edf3;

  --text-primary:   #e6edf3;
  --text-secondary: #8b949e;
  --text-muted:     #484f58;
  --text-inverse:   #0d1117;

  --border:         #30363d;
  --border-focus:   #58a6ff;

  --accent:         #58a6ff;
  --accent-hover:   #79c0ff;
  --accent-text:    #0d1117;

  --green:          #3fb950;
  --green-bg:       rgba(63,185,80,0.10);
  --red:            #f85149;
  --red-bg:         rgba(248,81,73,0.10);
  --amber:          #e3b341;
  --amber-bg:       rgba(227,179,65,0.10);
  --blue:           #58a6ff;
  --blue-bg:        rgba(88,166,255,0.10);

  --spot-free-fill:     #238636;
  --spot-free-stroke:   #3fb950;
  --spot-occ-fill:      #8b1a1a;
  --spot-occ-stroke:    #f85149;
  --spot-res-fill:      #2d333b;
  --spot-res-stroke:    #484f58;
  --spot-pend-fill:     #735c0f;
  --spot-pend-stroke:   #e3b341;
  --spot-mine-fill:     #1a345c;
  --spot-mine-stroke:   #58a6ff;

  --shadow-sm:      0 1px 2px rgba(0,0,0,.6);
  --shadow:         0 1px 3px rgba(0,0,0,.7);
  --shadow-md:      0 4px 12px rgba(0,0,0,.5);
  --shadow-lg:      0 10px 30px rgba(0,0,0,.6);
}
```

---

## 2. Typography

Load Inter from Google Fonts in all HTML pages via `<link>` in `<head>`. No build step.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

In `css/style.css`, change `font-family` on `body` to:

```css
body {
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
}
```

---

## 3. Icons — Lucide (CDN ESM)

Replace all Unicode button symbols (`■`, `▶`, `✓`, `✕`, `🗑`, `💾`, `🔑`, etc.) with Lucide SVG icons. Load via CDN ESM import in each HTML page that needs icons.

```html
<script type="module">
  import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/dist/esm/lucide.js';
  createIcons({ icons });
</script>
```

Icon usage in HTML: `<i data-lucide="trash-2"></i>`, `<i data-lucide="save"></i>`, etc.

In `js/admin.js`, replace the `iconBtn()` helper function with one that produces `<i data-lucide="...">` elements and calls `lucide.createIcons()` after DOM injection.

**Icon mapping:**
| Current symbol | Lucide icon name | Context |
|---|---|---|
| `🗑` / `×` | `trash-2` | Delete |
| `💾` / `✓` | `save` | Save/confirm |
| `✕` | `x` | Cancel/close |
| `▶` | `play` | Activate/enable |
| `■` | `square` | Deactivate |
| `🔑` | `key-round` | Generate password |
| `✂` | `scissors` | Terminate contract |
| `~` | `pencil` | Edit |
| `⛔` | `ban` | Block/deactivate |
| `+` (nav) | `plus` | Add new |
| `€` | `euro` | Payment |
| `▶` (collapse) | `chevron-right` | Expand/collapse |

---

## 4. Card Component

All `.card` elements gain `backdrop-filter: blur(20px)` in Dark Glass theme. Border becomes `1px solid var(--border)`. Hover state lifts with `box-shadow: var(--shadow-md)`.

```css
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.25rem;
  transition: box-shadow var(--transition-md);
}

[data-theme="dark-glass"] .card {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}
```

---

## 5. Header

Header uses `position: sticky; top: 0; z-index: 100` and a subtle blur backdrop so it floats over scrolling content.

```css
.site-header {
  background: var(--header-bg);
  color: var(--header-text);
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0 clamp(0.75rem, 4vw, 1.5rem);
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
```

---

## 6. Theme Toggle

A persistent 3-way theme toggle added to the nav bar on all authenticated pages. The toggle is a small icon button cycling through: **Light → Dark Glass → Dark Deep → Light**.

**`js/theme.js`** — new file:

```js
const THEMES = ['light', 'dark-glass', 'dark-deep'];
const ICONS  = { 'light': 'sun', 'dark-glass': 'sparkles', 'dark-deep': 'moon' };
const KEY = 'pm-theme';

export function initTheme() {
  const saved = localStorage.getItem(KEY) || 'light';
  applyTheme(saved);
}

export function cycleTheme() {
  const current = document.documentElement.dataset.theme || 'light';
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
  applyTheme(next);
  localStorage.setItem(KEY, next);
}

function applyTheme(theme) {
  if (theme === 'light') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  // Update toggle icon if button exists
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const icon = btn.querySelector('i');
    if (icon) { icon.dataset.lucide = ICONS[theme]; lucide?.createIcons(); }
    btn.title = { light: 'Light', 'dark-glass': 'Dark Glass', 'dark-deep': 'Dark Deep' }[theme];
  }
}
```

**HTML snippet** (added to `<nav class="site-nav">` on all authenticated pages):

```html
<button id="theme-toggle" class="icon-btn secondary" title="Light">
  <i data-lucide="sun"></i>
</button>
```

**Script tag** (after Lucide import, before page script):

```html
<script type="module">
  import { initTheme, cycleTheme } from './js/theme.js';
  import { createIcons, icons } from 'https://cdn.jsdelivr.net/npm/lucide@latest/dist/esm/lucide.js';
  window.lucide = { createIcons: () => createIcons({ icons }) };
  initTheme();
  window.lucide.createIcons();
  document.getElementById('theme-toggle')?.addEventListener('click', cycleTheme);
</script>
```

---

## 7. Buttons

Buttons adopt token-based colors and a refined style with cleaner focus rings.

```css
button {
  font-family: 'Inter', inherit;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: var(--radius);
  border: 1px solid var(--border-focus);
  padding: 0.45rem 1rem;
  background: var(--text-primary);
  color: var(--text-inverse);
  cursor: pointer;
  min-height: 2.25rem;
  transition: background var(--transition), box-shadow var(--transition), opacity var(--transition);
  white-space: nowrap;
  letter-spacing: -0.01em;
}
button:hover { opacity: 0.88; box-shadow: var(--shadow); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button.secondary {
  background: var(--bg-card);
  color: var(--text-primary);
  border-color: var(--border);
}
button.danger { background: var(--red); border-color: var(--red); color: #fff; }
button.accent { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
```

---

## 8. Inputs & Forms

```css
input, select, textarea {
  font-family: 'Inter', inherit;
  background: var(--bg-input);
  color: var(--text-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  width: 100%;
  transition: border-color var(--transition), box-shadow var(--transition);
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--border-focus);
  background: var(--bg-input-focus);
  box-shadow: 0 0 0 3px rgba(var(--accent-rgb, 79,70,229), 0.12);
}
```

---

## 9. Files Modified

| File | Change |
|---|---|
| `css/style.css` | Full rewrite using new tokens, new card/button/input/header styles |
| `js/theme.js` | **New file** — theme init, cycle, persist |
| `index.html` | Add Inter font link |
| `parking.html` | Add Inter font link, Lucide import, theme toggle button + script |
| `admin.html` | Add Inter font link, Lucide import, theme toggle button + script; update `iconBtn()` to use `<i data-lucide>` |
| `incident.html` | Add Inter font link, Lucide import, theme toggle button + script |
| `invite.html` | Add Inter font link |
| `register.html` | Add Inter font link |

---

## 10. Out of Scope (deferred to later phases)

- SVG parking map glow effects → Phase 3
- Admin stat cards / modal dialogs → Phase 2
- Login page glassmorphism card → Phase 4
- Micro-animations (stagger, toast) → Phase 5
- PWA, Chart.js, CSV export → Phase 6
- `invite.html` / `register.html` full redesign → Phase 4

---

## 11. Non-Goals

- No build step, no bundler, no Node dependencies
- No removal of i18n system — all `data-i18n` attributes preserved
- No changes to backend (Cloudflare Worker) or auth logic
- No changes to data models (`spots.json`, `users.json`, etc.)
