# Mobile-First Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop info panel and static bottom nav on `parking.html` with a mobile-first bottom sheet for spot details and a role-aware bottom nav (3 tabs for residents, 4 for admins).

**Architecture:** Three files change — `parking.html` gets new bottom sheet markup and updated nav; `css/style.css` gets bottom sheet styles; `js/parking.js` gets `openBottomSheet`/`closeBottomSheet` replacing `showSpotInfo`. The existing `showSpotInfo` function is deleted and all three click handlers (lines 207, 317, 408) are updated to call `openBottomSheet` instead. Residents section is removed from the map page. Profile section stays in the HTML but is now the Profile tab destination.

**Tech Stack:** Vanilla JS, CSS custom properties, SVG, existing `workerRequest`/`assignSpot`/`unassignSpot` from `js/admin.js`, existing `toast()` from `js/toast.js`

**⚠️ E2E tests in `tests/` must not be touched.** The tests interact with `#info-panel` — Task 1 keeps a hidden `#info-panel` div for backward compatibility so existing E2E selectors don't break.

---

## File Map

| File | What changes |
|------|-------------|
| `parking.html` | Add `#spot-sheet` bottom sheet markup; update `<nav class="bottom-nav">` to be role-aware; remove residents card; remove `#info-panel` visible content (keep hidden for E2E compat) |
| `css/style.css` | Add bottom sheet styles (`.spot-sheet`, `.sheet-backdrop`, `.sheet-handle`, `.sheet-content`, `.sheet-btn`); map SVG scaling tweak |
| `js/parking.js` | Add `openBottomSheet(spotData, label, users, currentUser)` and `closeBottomSheet()`; replace all 3 `showSpotInfo` calls with `openBottomSheet`; delete `showSpotInfo` body (keep stub); keep `#info-panel` update inside click handler for E2E compat |

---

## Task 1: Bottom sheet HTML markup + hidden info-panel stub

**Files:**
- Modify: `parking.html:57-59` (info-panel), `parking.html:64-70` (residents card), `parking.html:77-90` (bottom nav)

- [ ] **Step 1: Read the current bottom of `parking.html`** to confirm line numbers

```bash
grep -n "info-panel\|residents\|bottom-nav\|my-payments" parking.html
```

Expected output shows the exact lines for info-panel (~58), residents card (~65-70), bottom-nav (~77-90).

- [ ] **Step 2: Replace `#info-panel` div with a hidden stub + add bottom sheet markup**

Replace the info-panel line:
```html
    <!-- Info panel — kept hidden for E2E test selector compatibility -->
    <div id="info-panel" style="display:none"></div>
  </div>

  <!-- Spot detail bottom sheet -->
  <div id="sheet-backdrop" class="sheet-backdrop" onclick="closeBottomSheet()"></div>
  <div id="spot-sheet" class="spot-sheet">
    <div class="sheet-handle" onclick="closeBottomSheet()"></div>
    <div id="sheet-content" class="sheet-content">
      <p style="color:var(--text-muted);font-size:0.85rem">Tap a spot to see details.</p>
    </div>
  </div>
```

- [ ] **Step 3: Remove the residents card entirely**

Delete these lines from `parking.html`:
```html
  <!-- Residents -->
  <div class="card" style="padding:0.75rem 1.25rem">
    <button class="collapse-toggle" id="residents-toggle">
      <span class="collapse-icon"><i data-lucide="chevron-right"></i></span> <span data-i18n="residents.title">Residents</span>
    </button>
    <div id="residents-panel" style="display:none;margin-top:0.75rem"></div>
  </div>
```

- [ ] **Step 4: Replace the static bottom nav with a role-aware one**

Replace the existing `<nav class="bottom-nav">...</nav>` block with:
```html
<nav class="bottom-nav" id="bottom-nav"></nav>
```

- [ ] **Step 5: Update the inline script to build the nav and remove residents references**

In the `<script>` block, replace:
```js
if (currentUser.role === 'admin' || currentUser.role === 'master') {
  document.getElementById('admin-link').style.display = 'inline';
}
document.getElementById('logout-link').addEventListener('click', e => { e.preventDefault(); logout(); });
document.getElementById('bottom-logout-btn').addEventListener('click', () => logout());
```

With:
```js
if (currentUser.role === 'admin' || currentUser.role === 'master') {
  document.getElementById('admin-link').style.display = 'inline';
}
document.getElementById('logout-link').addEventListener('click', e => { e.preventDefault(); logout(); });

// Build role-aware bottom nav
(function buildBottomNav() {
  const nav = document.getElementById('bottom-nav');
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'master';
  const tabs = [
    { href: 'parking.html', icon: '🗺', labelKey: 'nav.map', active: true },
    { href: 'incident.html', icon: '⚠️', labelKey: 'nav.incidents', active: false },
  ];
  if (isAdmin) {
    tabs.push({ href: 'admin.html', icon: '⚙️', labelKey: 'nav.admin', active: false });
  }
  tabs.push({ href: 'parking.html#profile', icon: '👤', labelKey: 'nav.profile', active: false });
  tabs.forEach(tab => {
    const a = document.createElement('a');
    a.href = tab.href;
    if (tab.active) a.className = 'active';
    a.innerHTML = `<span class="bn-icon">${tab.icon}</span><span data-i18n="${tab.labelKey}">${tab.labelKey}</span>`;
    nav.appendChild(a);
  });
})();
```

Also remove the `residents-panel` visibility check from the `refresh()` function:
```js
// REMOVE this block:
  if (document.getElementById('residents-panel').style.display !== 'none') {
    renderResidents();
  }
```

- [ ] **Step 6: Open the app in a browser and verify the page loads without JS errors**

```bash
# From project root — if you have a local server running
open http://localhost:8788/parking.html
# or
npx serve . -p 3000 && open http://localhost:3000/parking.html
```

Expected: page loads, bottom nav shows Map / Incidents / Profile (or + Admin for admin user), no console errors.

- [ ] **Step 7: Commit**

```bash
git add parking.html
git commit -m "feat: bottom sheet markup, role-aware bottom nav, remove residents section"
```

---

## Task 2: Bottom sheet CSS

**Files:**
- Modify: `css/style.css` — append new rules at end of file

- [ ] **Step 1: Append bottom sheet styles to `css/style.css`**

Add at the very end of `css/style.css`:
```css
/* ── Bottom sheet ──────────────────────────────────────────────────────────── */
.sheet-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 290;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}
.sheet-backdrop.open { display: block; }

.spot-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 300;
  background: var(--bg-card);
  border-radius: 16px 16px 0 0;
  border-top: 1px solid var(--border);
  padding: 0 1rem calc(env(safe-area-inset-bottom) + 1rem);
  transform: translateY(calc(100% - 48px));
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  max-height: 55vh;
  overflow-y: auto;
}

.spot-sheet.open {
  transform: translateY(0);
}

.sheet-handle {
  width: 40px;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  margin: 10px auto 12px;
  cursor: pointer;
  flex-shrink: 0;
}

.sheet-content {
  padding-bottom: 0.5rem;
}

.sheet-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 0.2rem;
}

.sheet-meta {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.sheet-status {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  margin-left: 0.4rem;
  vertical-align: middle;
}
.sheet-status.free     { background: var(--green-bg);  color: var(--green); }
.sheet-status.occupied { background: var(--red-bg);    color: var(--red); }
.sheet-status.reserved { background: var(--border);    color: var(--text-muted); }
.sheet-status.pending  { background: var(--amber-bg);  color: var(--amber); }

.sheet-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.75rem;
}

.sheet-btn {
  flex: 1;
  min-width: 72px;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: none;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  -webkit-tap-highlight-color: transparent;
}
.sheet-btn:active { opacity: 0.75; }

.sheet-btn.primary  { background: var(--accent);  color: var(--accent-text); }
.sheet-btn.secondary { background: var(--blue-bg); color: var(--blue); }
.sheet-btn.warn     { background: var(--amber-bg); color: var(--amber); }
.sheet-btn.danger   { background: var(--green-bg); color: var(--green); }
.sheet-btn.admin    { background: #ede9fe;          color: #4f46e5; }
```

- [ ] **Step 2: Verify styles in browser**

Open the page, tap any spot — the sheet should peek up 48px from the bottom showing the handle. (JS is not wired yet — this just confirms the CSS is applied.)

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: bottom sheet CSS styles"
```

---

## Task 3: Bottom sheet JS logic

**Files:**
- Modify: `js/parking.js`

The existing `showSpotInfo` (line 448) writes to `#info-panel`. We replace it with `openBottomSheet`/`closeBottomSheet` which write to `#sheet-content` and toggle `.open` on the sheet and backdrop. We keep `#info-panel` updated silently (empty string) so E2E selectors don't error.

All three existing click handlers at lines 207, 317, and 408 call `showSpotInfo(spotData, label, users, currentUser, pendingSpotIds)` — they need to call `openBottomSheet` instead.

- [ ] **Step 1: Add `openBottomSheet` and `closeBottomSheet` at the bottom of `js/parking.js`** (after the existing `showSpotInfo` function, before `initParking`)

```js
function openBottomSheet(spotData, label, users, currentUser) {
  const sheet = document.getElementById('spot-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  const content = document.getElementById('sheet-content');
  if (!sheet || !content) return;

  // Keep #info-panel silently updated for E2E compat
  const panel = document.getElementById('info-panel');
  if (panel) { panel.innerHTML = ''; panel.classList.add('has-content'); }

  const renter = spotData.assignedUserId
    ? users.find(u => u.id === spotData.assignedUserId)
    : null;

  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'master';
  const isMySpot = renter && renter.id === currentUser.id;

  // Status
  let statusClass = 'free', statusText = 'Free';
  if (spotData.reserved) { statusClass = 'reserved'; statusText = 'Reserved'; }
  else if (spotData.state === 'occupied') { statusClass = 'occupied'; statusText = 'Occupied'; }

  // Title line
  const titleEl = document.createElement('div');
  titleEl.className = 'sheet-title';
  titleEl.innerHTML = `Spot ${label}` +
    (isMySpot ? ' <span style="font-size:0.75rem;color:var(--accent)">★ Your spot</span>' : '') +
    `<span class="sheet-status ${statusClass}">${statusText}</span>`;

  // Meta line
  const metaEl = document.createElement('div');
  metaEl.className = 'sheet-meta';
  if (renter) {
    const name = isAdmin
      ? `${renter.name || ''} ${renter.lastName || ''}`.trim() || renter.username
      : (isMySpot ? 'Assigned to you' : 'Occupied');
    const plate = (renter.licensePlate || renter.username || '').toUpperCase();
    metaEl.textContent = `${name} · ${plate}`;
  } else if (spotData.reserved) {
    metaEl.textContent = 'External reservation — not available';
  } else {
    metaEl.textContent = 'No one assigned';
  }

  // Actions
  const actionsEl = document.createElement('div');
  actionsEl.className = 'sheet-actions';

  // Reserve — shown to resident if spot is free and they have no assignment yet
  const hasOwnSpot = _users
    ? (_users.find(u => u.id === currentUser.id)?.assignedSpots?.length > 0)
    : false;
  if (!isAdmin && spotData.state === 'free' && !spotData.reserved && !hasOwnSpot) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn primary';
    btn.textContent = 'Reserve';
    btn.onclick = () => { closeBottomSheet(); /* reservation flow TBD in future spec */ toast('Reservation flow coming soon', 'info'); };
    actionsEl.appendChild(btn);
  }

  // Pay — shown if user is assigned to this spot
  if (isMySpot || isAdmin) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn secondary';
    btn.textContent = 'Pay';
    btn.onclick = () => { closeBottomSheet(); document.getElementById('my-payments-section')?.scrollIntoView({ behavior: 'smooth' }); };
    actionsEl.appendChild(btn);
  }

  // Report incident — always shown
  const reportBtn = document.createElement('button');
  reportBtn.className = 'sheet-btn warn';
  reportBtn.textContent = '⚠ Report';
  reportBtn.onclick = () => { closeBottomSheet(); window.location.href = `incident.html?spot=${spotData.id}`; };
  actionsEl.appendChild(reportBtn);

  // Admin-only: Release
  if (isAdmin && spotData.state === 'occupied' && spotData.assignedUserId) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn danger';
    btn.textContent = 'Release';
    btn.onclick = async () => {
      try {
        await unassignSpot(spotData.id);
        toast('Spot released', 'success');
        closeBottomSheet();
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    };
    actionsEl.appendChild(btn);
  }

  // Admin-only: Assign
  if (isAdmin && !spotData.assignedUserId && !spotData.reserved) {
    const btn = document.createElement('button');
    btn.className = 'sheet-btn admin';
    btn.textContent = 'Assign';
    btn.onclick = () => { closeBottomSheet(); /* triggers existing admin assign modal */ showAssignModal && showAssignModal(spotData.id); };
    actionsEl.appendChild(btn);
  }

  content.innerHTML = '';
  content.appendChild(titleEl);
  content.appendChild(metaEl);
  content.appendChild(actionsEl);

  sheet.classList.add('open');
  if (backdrop) backdrop.classList.add('open');
}

function closeBottomSheet() {
  const sheet = document.getElementById('spot-sheet');
  const backdrop = document.getElementById('sheet-backdrop');
  if (sheet) sheet.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
  // Deselect any selected spot
  document.querySelectorAll('#parking-svg .spot.selected').forEach(el => el.classList.remove('selected'));
}
```

- [ ] **Step 2: Update the three click handlers to call `openBottomSheet` instead of `showSpotInfo`**

There are three identical click handler patterns. Find each one — they look like:
```js
showSpotInfo(spotData, label, users, currentUser, pendingSpotIds);
```

Replace all three occurrences with:
```js
openBottomSheet(spotData, label, users, currentUser);
```

Also in each click handler, change the "deselect" branch to call `closeBottomSheet()`:
```js
// The alreadySelected branch currently does:
panel.innerHTML = '';
panel.classList.remove('has-content');
panel.setAttribute('data-i18n', 'map.info.default');
panel.textContent = typeof t === 'function' ? t('map.info.default') : 'Tap a spot to see details.';
// Replace entirely with:
closeBottomSheet();
```

The full updated click handler pattern (apply to all 3) becomes:
```js
g.addEventListener('click', () => {
  const alreadySelected = svg.querySelector('.spot.selected') === g;
  svg.querySelectorAll('.spot.selected').forEach(el => el.classList.remove('selected'));
  if (alreadySelected) {
    closeBottomSheet();
  } else {
    g.classList.add('selected');
    openBottomSheet(spotData, label, users, currentUser);
  }
});
```

- [ ] **Step 3: Also expose `closeBottomSheet` globally so the backdrop `onclick` in HTML works**

The HTML has `onclick="closeBottomSheet()"` on the backdrop div. Since `closeBottomSheet` is defined inside `parking.js` (not a module), it's already global. Verify this is the case — `parking.js` is loaded as a regular `<script>` (not `type="module"`), so functions defined at top level are global. No change needed.

- [ ] **Step 4: Open the app in a browser, tap a spot**

Expected:
- Sheet slides up showing spot label, status pill, and action buttons
- Tapping backdrop or handle collapses the sheet
- Tapping the same spot again collapses the sheet
- No console errors

- [ ] **Step 5: Run unit tests**

```bash
npm run test:unit
```

Expected: all pass. (Unit tests don't cover bottom sheet — they test data functions.)

- [ ] **Step 6: Commit**

```bash
git add js/parking.js
git commit -m "feat: bottom sheet JS — openBottomSheet/closeBottomSheet replaces showSpotInfo"
```

---

## Task 4: Map SVG scaling + page layout polish

**Files:**
- Modify: `parking.html` (SVG inline style), `css/style.css`

The SVG already has `style="width:100%;max-width:980px;height:auto;display:block"` which is correct. The map card has `padding:1rem`. On mobile, the card padding eats into map width. This task removes the card wrapper padding on mobile and ensures the map fills the full card width.

- [ ] **Step 1: Remove the `max-width:980px` cap from the SVG inline style**

In `parking.html`, find:
```html
<svg id="parking-svg" viewBox="-60 0 920 760"
     style="width:100%;max-width:980px;height:auto;display:block">
```

Change to:
```html
<svg id="parking-svg" viewBox="-60 0 920 760"
     style="width:100%;height:auto;display:block">
```

- [ ] **Step 2: Add mobile map card padding override in `css/style.css`**

Inside the existing `@media (max-width: 640px)` block (around line 1070), add:
```css
  /* Map card — remove horizontal padding so map fills full width */
  .card:has(#parking-svg) {
    padding-left: 0;
    padding-right: 0;
  }
```

- [ ] **Step 3: Add bottom padding to `.page-wrap` to account for the sheet peek height (48px)**

The existing mobile rule at line ~1151 already adds `padding-bottom: calc(52px + ...)` for the bottom nav. The sheet peeks 48px above bottom nav. Add sheet peek offset inside the same `@media` block:
```css
  /* Extra padding so last card doesn't hide behind sheet peek + bottom nav */
  .page-wrap {
    padding-bottom: calc(52px + 48px + env(safe-area-inset-bottom) + 1rem);
  }
```

(This replaces the existing `padding-bottom` rule for `.page-wrap` inside the media query — update it, don't add a duplicate.)

- [ ] **Step 4: Verify on mobile viewport (DevTools → 390px width)**

- Map fills full card width
- Bottom of page content is not hidden behind sheet + nav
- No horizontal scroll

- [ ] **Step 5: Commit**

```bash
git add parking.html css/style.css
git commit -m "feat: map fills full card width on mobile, page-wrap bottom padding accounts for sheet"
```

---

## Task 5: Profile tab navigation

**Files:**
- Modify: `parking.html`

The Profile tab in the bottom nav links to `parking.html#profile`. When clicked, it should scroll the profile section into view. Since profile is rendered dynamically, we add a scroll-to behavior.

- [ ] **Step 1: Add an anchor id to the profile section in `parking.html`**

Find:
```html
  <!-- Profile edit -->
  <div id="profile-edit-section"></div>
```

Change to:
```html
  <!-- Profile edit -->
  <div id="profile-edit-section">
    <div id="profile"></div>
  </div>
```

- [ ] **Step 2: Add scroll-to-profile on hash change in the inline script**

Add this after the `buildBottomNav` IIFE in the inline script:
```js
// Scroll to profile section if URL has #profile
if (window.location.hash === '#profile') {
  setTimeout(() => {
    document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth' });
  }, 500); // wait for renderProfile() to finish
}
```

- [ ] **Step 3: Verify in browser**

Click the Profile tab in the bottom nav. Page scrolls down to the profile edit form.

- [ ] **Step 4: Commit**

```bash
git add parking.html
git commit -m "feat: profile tab scrolls to profile section via #profile anchor"
```

---

## Task 6: Remove stale residents JS from inline script

**Files:**
- Modify: `parking.html`

The residents toggle and `renderResidents()` function are still in the inline script even though the residents card was removed in Task 1. This task cleans them up.

- [ ] **Step 1: Remove the residents toggle event listener and `renderResidents` function from the inline script in `parking.html`**

Remove this block from the inline script:
```js
// ── Residents ─────────────────────────────────────────────────────────────────
const residentsToggle = document.getElementById('residents-toggle');
residentsToggle.addEventListener('click', () => {
  const panel = document.getElementById('residents-panel');
  const open = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  residentsToggle.classList.toggle('open', !open);
  if (!open) renderResidents();
});

function renderResidents() {
  const panel = document.getElementById('residents-panel');
  panel.innerHTML = '';
  // ... (full function body)
}
```

The full `renderResidents` function runs from line ~329 to ~368. Remove it entirely along with the toggle listener.

- [ ] **Step 2: Run unit tests**

```bash
npm run test:unit
```

Expected: all pass.

- [ ] **Step 3: Verify the page still loads without errors**

```bash
open http://localhost:8788/parking.html
```

No console errors about `residentsToggle` being null.

- [ ] **Step 4: Commit and push**

```bash
git add parking.html
git commit -m "chore: remove stale residents JS after section removal"
git push origin main
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Map scales to fit (Task 4)
- ✅ Bottom sheet collapsed/expanded states (Task 2 CSS + Task 3 JS)
- ✅ Resident actions: Reserve, Pay, Report (Task 3 `openBottomSheet`)
- ✅ Admin actions: Pay, Report, Release, Assign (Task 3 `openBottomSheet`)
- ✅ Role-based nav — 3 vs 4 tabs (Task 1)
- ✅ `#info-panel` hidden stub for E2E compat (Task 1)
- ✅ Residents section removed (Task 1 + Task 6)
- ✅ Profile tab destination (Task 5)
- ✅ Admin badge in header — already exists, not changed

**Placeholder scan:** No TBD/TODO in code steps. Reserve button notes "future spec" inline as a toast for now — intentional, reservation flow is out of scope.

**Type consistency:** `openBottomSheet(spotData, label, users, currentUser)` — same 4 params used in all 3 call sites. `closeBottomSheet()` — no params, used consistently.
