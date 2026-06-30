# Mobile Responsiveness Design

**Date:** 2026-06-30  
**Scope:** `parking.html`, `incident.html`, `index.html`, `register.html`, `invite.html`, `css/style.css`, `js/i18n/en.js`, `js/i18n/de.js`, `js/i18n/tr.js`  
**Admin pages excluded:** `admin.html` is desktop-only by design.

---

## Context

Renters use the app exclusively on mobile phones. The current nav wraps awkwardly on small screens, the SVG parking map renders at ~300px on a 920px viewBox making spots hard to tap, and several small mobile polish issues exist. Admin only uses desktop so `admin.html` is out of scope.

---

## 1. Bottom Tab Bar (mobile nav)

Replace the current top nav links (Map, Incidents, Logout) with a **bottom tab bar** on mobile screens (≤ 640px). Theme toggle and language switcher stay in the top bar.

**Structure:**
```
Top bar:  [Logo / App name]  [Lang chip]  [Theme toggle]
Bottom:   [🗺 Map]  [⚠️ Incidents]  [→ Logout]
```

**Implementation:**
- Add `.bottom-nav` to `css/style.css` — `position: fixed; bottom: 0; left: 0; right: 0` with `padding-bottom: env(safe-area-inset-bottom)` for iPhone home bar
- Hide `.site-nav a` (page links) and `.nav-sep` on mobile via `@media (max-width: 640px)`
- Show `.bottom-nav` only on mobile, hidden on desktop via CSS
- Active state matches current page (same `class="active"` logic already used)
- Each tab: icon + label, min touch target 44×44px
- `backdrop-filter: blur` + semi-transparent background, `z-index: 200`
- Add `padding-bottom: calc(56px + env(safe-area-inset-bottom))` to `.page-wrap` on mobile so content doesn't hide behind the bar
- Apply to: `parking.html`, `incident.html` (the two renter pages with nav)

**Desktop:** bottom nav hidden, top nav unchanged.

---

## 2. SVG Parking Map — Full-screen fit + tap panel

**Goal:** entire map visible on one screen without scrolling or zooming; tapping a spot shows details inline without hiding the map.

### 2a. Map sizing

The SVG has `viewBox="-60 0 920 760"` and currently `max-width: 980px`. On mobile it already scales via `width: 100%` — but the containing `overflow-x: auto` wrapper allows horizontal scroll instead of forcing fit.

Fix: remove the `overflow-x: auto` wrapper div on mobile. The SVG with `width: 100%; height: auto` will naturally scale to fit the card width, preserving aspect ratio. At 320px card width the map renders at ~320×250px — all spots visible.

### 2b. Enlarged tap targets

Each spot is ~60×40 SVG units → renders ~20×13px at mobile scale. Too small for reliable tapping.

Fix: in `js/parking.js`, after drawing each spot rect, append a transparent `<rect>` with the same center but `width+40, height+30` SVG units, `fill="transparent"`, `cursor="pointer"`, carrying the click handler. The visible spot stays the same size; the hit area is ~33×23px at mobile scale (still below ideal but a major improvement) with the visual area centered inside it.

### 2c. Tap → inline info panel

Current: info panel is a `<div id="info-panel">` below the map with static text.

New behaviour:
- On spot tap, the info panel updates with spot details (same as today)
- On mobile, add CSS `transition: max-height 0.2s ease` to smoothly expand the panel from 0 to its content height when a spot is selected
- Panel sits between the map and the legend — no overlay, no scroll required, map stays fully visible above it
- Deselect (tap elsewhere / tap same spot again) collapses the panel back to the default hint text

No changes to desktop behaviour.

---

## 3. Small Polish Fixes

| # | File | Fix |
|---|------|-----|
| 1 | `index.html` | Add `viewport-fit=cover` to the viewport meta tag |
| 2 | `js/i18n/en.js`, `de.js`, `tr.js` | Change `map.info.default` from "Click a spot…" to "Tap a spot…" (all 3 languages) |
| 3 | `css/style.css` | Add `-webkit-tap-highlight-color: transparent` to `a`, `button` base styles |
| 4 | `css/style.css` | `.bottom-nav` gets `padding-bottom: env(safe-area-inset-bottom)` (already in spec above — listed here for completeness) |

---

## 4. Out of Scope

- Pinch-to-zoom on the SVG map — not needed since the full map fits on screen
- `admin.html` mobile layout — admin is desktop-only
- Any changes to the Worker API (`src/index.js`)
- Test coverage for the Worker (separate concern)

---

## Files Changed

| File | Change |
|------|--------|
| `css/style.css` | Bottom tab bar styles, mobile media query, tap highlight, safe-area padding |
| `parking.html` | Add `.bottom-nav` HTML, remove overflow wrapper on map |
| `incident.html` | Add `.bottom-nav` HTML |
| `js/parking.js` | Enlarged hit rects on spots, info panel expand/collapse animation |
| `js/i18n/en.js` | "Tap" wording |
| `js/i18n/de.js` | "Tap" wording (German) |
| `js/i18n/tr.js` | "Tap" wording (Turkish) |
| `index.html` | viewport-fit=cover |
