# UI Modernization Phase 2: Admin Stat Cards + Modal Dialogs

**Goal:** Elevate the admin dashboard with at-a-glance stat cards and replace all native `alert()`/`confirm()`/`prompt()` browser dialogs with a styled modal component. Also fix legacy `--white`/`--gray-*` variables in `incident.html` that break Dark Glass and Dark Deep themes.

**Architecture:** 
- Stat cards: rendered in `renderUsers()` using live data already fetched; pure DOM, no extra fetch
- Modal: new `js/modal.js` module exporting `modalAlert`, `modalConfirm`, `modalPrompt` — drop-in async replacements; modal HTML injected once into `<body>` on first use
- CSS: stat card and modal styles added to `css/style.css`
- Incident fixes: swap legacy variable references in `incident.html` `<style>` block

**Tech Stack:** Vanilla JS/CSS, no new dependencies

---

## 1. Stat Cards

Four cards shown at the top of the admin Users tab, above "Pending Registrations":

| Card | Value | Color |
|---|---|---|
| Active Renters | count of active users with role=renter | green |
| Occupied Spots | count of spots with assignedUserId | blue |
| Unpaid This Month | count of assigned spots missing rent payment for current month | amber |
| Pending Actions | pendingRegs.length + users with pendingEdits | red (badge style) |

Cards sit in a 4-column responsive grid (2-col on mobile). Each card:
- Icon (Lucide) + label + big number
- Color accent on left border or top strip
- Uses `var(--bg-card)`, `var(--border)`, CSS tokens throughout

## 2. Modal Dialog System (`js/modal.js`)

Three async functions, each returns a Promise:

```js
modalAlert(message, { title? })          → Promise<void>
modalConfirm(message, { title?, danger? }) → Promise<boolean>
modalPrompt(message, { title?, defaultValue?, placeholder? }) → Promise<string|null>
```

Single modal overlay (`<div id="pm-modal">`) injected once. Re-used for all calls. Backdrop click cancels (same as pressing Cancel/×).

Keyboard: `Enter` confirms, `Escape` cancels.

## 3. Incident Page Theme Fix

Replace in `incident.html` `<style>`:
- `var(--white)` → `var(--bg-card)`
- `var(--gray-200)` → `var(--border)`
- `var(--gray-600)` → `var(--text-secondary)`
- `var(--gray-800)` → `var(--text-primary)`

## 4. Files Modified

| File | Change |
|---|---|
| `css/style.css` | Add `.stat-grid`, `.stat-card` styles; add `#pm-modal` styles |
| `js/modal.js` | **New** — `modalAlert`, `modalConfirm`, `modalPrompt` |
| `admin.html` | Add `<script src="js/modal.js">`, add stat cards HTML placeholder, call `renderStatCards()` from `renderUsers()`, replace all `alert()`/`confirm()`/`prompt()` |
| `incident.html` | Fix legacy CSS variable references in `<style>` block |
