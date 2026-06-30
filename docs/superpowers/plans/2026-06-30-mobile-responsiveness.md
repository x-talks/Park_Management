# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the renter-facing pages (parking, incident) fully mobile-friendly with a bottom tab bar, a map that fits on screen with tap-to-show-details, and several small polish fixes.

**Architecture:** CSS-only bottom nav (shown/hidden via media query), SVG map keeps its `width:100%;height:auto` natural scaling with the `overflow-x:auto` wrapper removed on mobile, enlarged transparent hit rects appended in `parking.js` after each visible spot element, inline info panel animated with `max-height` transition. No new files — all changes are additive to existing files.

**Tech Stack:** Vanilla HTML/CSS/JS, SVG DOM API, CSS custom properties, `env(safe-area-inset-bottom)`

---

## File Map

| File | What changes |
|------|-------------|
| `css/style.css` | Bottom nav styles + mobile media query, tap highlight, safe-area padding, info panel transition |
| `parking.html` | Add `<nav class="bottom-nav">` before `</body>`, remove `overflow-x:auto` wrapper div around SVG |
| `incident.html` | Add `<nav class="bottom-nav">` before `</body>` |
| `js/parking.js` | Add transparent hit rects in `makeSpot`, `makeBottomLanePerpSpot`, `makeWedge`; add `data-selected` toggle and info-panel class toggle in `showSpotInfo` |
| `js/i18n/en.js` | `map.info.default` → "Tap a spot to see details." |
| `js/i18n/de.js` | `map.info.default` → "Stellplatz antippen für Details." (already correct — verify) |
| `js/i18n/tr.js` | `map.info.default` → "Detaylar için bir yer seçin." (already correct — verify) |
| `index.html` | Add `viewport-fit=cover` to viewport meta |

---

## Task 1: CSS — tap highlight + safe-area base

**Files:**
- Modify: `css/style.css` (lines ~246–247, `a` and `button` base styles)

- [ ] **Step 1: Open `css/style.css` and find the `a` base rule around line 246:**

```css
a { color: var(--accent); text-decoration: none; }
```

Replace with:

```css
a { color: var(--accent); text-decoration: none; -webkit-tap-highlight-color: transparent; }
```

- [ ] **Step 2: Find the `button` base rule (around line 390–410) and add tap highlight suppression.**

Find:
```css
button {
  display: inline-flex;
```

Add `-webkit-tap-highlight-color: transparent;` inside that rule. The result:

```css
button {
  display: inline-flex;
  -webkit-tap-highlight-color: transparent;
```

- [ ] **Step 3: Verify visually — no other styles break. No test runner for CSS; manual check is sufficient.**

- [ ] **Step 4: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add css/style.css
git commit -m "fix: suppress iOS tap highlight on links and buttons"
```

---

## Task 2: CSS — bottom tab bar styles

**Files:**
- Modify: `css/style.css` (append at end of file)

- [ ] **Step 1: Append the following block to the end of `css/style.css`:**

```css
/* ── Bottom nav (mobile renter pages) ────────────────────────────────────── */
.bottom-nav {
  display: none; /* hidden by default — shown only on mobile */
}

@media (max-width: 640px) {
  /* Hide top nav page links on mobile — keep theme toggle + lang switcher */
  .site-nav a,
  .site-nav .nav-sep {
    display: none;
  }

  /* Show bottom nav */
  .bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    background: rgba(15, 15, 20, 0.97);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .bottom-nav a {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 4px 6px;
    min-height: 52px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.65rem;
    font-weight: 600;
    text-decoration: none;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    transition: color var(--transition);
    -webkit-tap-highlight-color: transparent;
  }

  .bottom-nav a:hover,
  .bottom-nav a.active {
    color: var(--accent);
    text-decoration: none;
  }

  .bottom-nav .bn-icon {
    font-size: 1.3rem;
    line-height: 1;
  }

  /* button inside bottom-nav (logout) — reset button styles, match link style */
  .bottom-nav button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 4px 6px;
    min-height: 52px;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: color var(--transition);
    -webkit-tap-highlight-color: transparent;
    border-radius: 0;
  }

  .bottom-nav button:hover {
    background: none;
    color: var(--accent);
  }

  /* Push page content up so it doesn't hide behind the fixed bar */
  .page-wrap {
    padding-bottom: calc(52px + env(safe-area-inset-bottom) + 1rem);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add css/style.css
git commit -m "feat: add bottom tab bar CSS for mobile (≤640px)"
```

---

## Task 3: HTML — add bottom nav to parking.html

**Files:**
- Modify: `parking.html`

- [ ] **Step 1: Open `parking.html`. Find the closing `</body>` tag (line ~452). Insert the following `<nav>` block immediately before the first `<script>` tag (so it's part of the DOM before scripts run). Place it after the `</div>` that closes `.page-wrap` and before the first `<script src=...>` line:**

```html
<nav class="bottom-nav">
  <a href="parking.html" class="active">
    <span class="bn-icon">🗺</span>
    <span data-i18n="nav.map">Map</span>
  </a>
  <a href="incident.html">
    <span class="bn-icon">⚠️</span>
    <span data-i18n="nav.incidents">Incidents</span>
  </a>
  <button id="bottom-logout-btn">
    <span class="bn-icon">→</span>
    <span data-i18n="nav.logout">Logout</span>
  </button>
</nav>
```

- [ ] **Step 2: Wire the logout button. Find the existing logout handler in `parking.html`:**

```js
document.getElementById('logout-link').addEventListener('click', e => { e.preventDefault(); logout(); });
```

Add one line immediately after it:

```js
document.getElementById('bottom-logout-btn').addEventListener('click', () => logout());
```

- [ ] **Step 3: Remove the `overflow-x:auto` wrapper div around the SVG map. Find:**

```html
    <div style="overflow-x:auto">
      <svg id="parking-svg" viewBox="-60 0 920 760"
           style="width:100%;max-width:980px;height:auto;display:block">
      </svg>
    </div>
```

Replace with (no wrapper div):

```html
      <svg id="parking-svg" viewBox="-60 0 920 760"
           style="width:100%;max-width:980px;height:auto;display:block">
      </svg>
```

- [ ] **Step 4: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add parking.html
git commit -m "feat: add bottom nav to parking.html, remove SVG overflow wrapper"
```

---

## Task 4: HTML — add bottom nav to incident.html

**Files:**
- Modify: `incident.html`

- [ ] **Step 1: Open `incident.html`. Find the `</div>` that closes `.page-wrap` (after the lightbox div, around line 200). Insert the bottom nav immediately after `.page-wrap` closes and before the `<!-- Lightbox -->` comment:**

```html
<nav class="bottom-nav">
  <a href="parking.html">
    <span class="bn-icon">🗺</span>
    <span data-i18n="nav.map">Map</span>
  </a>
  <a href="incident.html" class="active">
    <span class="bn-icon">⚠️</span>
    <span data-i18n="nav.incidents">Incidents</span>
  </a>
  <button id="bottom-logout-btn">
    <span class="bn-icon">→</span>
    <span data-i18n="nav.logout">Logout</span>
  </button>
</nav>
```

- [ ] **Step 2: Wire the logout button. Find the existing logout handler:**

```js
document.getElementById('logout-link').addEventListener('click', e => { e.preventDefault(); logout(); });
```

Add immediately after:

```js
document.getElementById('bottom-logout-btn').addEventListener('click', () => logout());
```

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add incident.html
git commit -m "feat: add bottom nav to incident.html"
```

---

## Task 5: CSS — info panel expand/collapse animation

**Files:**
- Modify: `css/style.css` (find `#info-panel` rule, it is around line 1060+ or search for it)

- [ ] **Step 1: Find the existing `#info-panel` style in `css/style.css`. It currently looks like:**

```css
#info-panel {
```

Add `overflow: hidden; transition: max-height 0.2s ease, padding 0.2s ease;` and a default collapsed state. Replace the full `#info-panel` rule with:

```css
#info-panel {
  margin-top: 0.5rem;
  padding: 0;
  font-size: 0.82rem;
  color: var(--text-secondary);
  line-height: 1.55;
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.2s ease, padding 0.2s ease;
}

#info-panel.has-content {
  max-height: 120px;
  padding: 0.5rem 0.25rem;
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add css/style.css
git commit -m "feat: info panel expand/collapse animation on mobile"
```

---

## Task 6: JS — info panel class toggle in showSpotInfo

**Files:**
- Modify: `js/parking.js` — `showSpotInfo` function (lines 376–416)

- [ ] **Step 1: Open `js/parking.js`. Find `showSpotInfo`. The function currently starts:**

```js
function showSpotInfo(spotData, label, users, currentUser, pendingSpotIds) {
  const panel = document.getElementById('info-panel');
  panel.innerHTML = '';
```

Add `has-content` class toggling. Replace those first 3 lines with:

```js
function showSpotInfo(spotData, label, users, currentUser, pendingSpotIds) {
  const panel = document.getElementById('info-panel');
  panel.innerHTML = '';
  panel.classList.add('has-content');
```

- [ ] **Step 2: Also handle the deselect case — tapping the same spot again should collapse the panel. Find in `buildSVG` where click handlers are attached. There are three places — `makeSpot`, `makeWedge`, `makeBottomLanePerpSpot`. Each has:**

```js
    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser, pendingSpotIds));
    }
```

Replace all three occurrences with this pattern (same in all three):

```js
    if (currentUser) {
      g.addEventListener('click', () => {
        const panel = document.getElementById('info-panel');
        const alreadySelected = svg.querySelector('.spot.selected') === g;
        svg.querySelectorAll('.spot.selected').forEach(el => el.classList.remove('selected'));
        if (alreadySelected) {
          panel.innerHTML = '';
          panel.classList.remove('has-content');
          panel.setAttribute('data-i18n', 'map.info.default');
          panel.textContent = typeof t === 'function' ? t('map.info.default') : 'Tap a spot to see details.';
        } else {
          g.classList.add('selected');
          showSpotInfo(spotData, label, users, currentUser, pendingSpotIds);
        }
      });
    }
```

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add js/parking.js
git commit -m "feat: toggle spot selection and animate info panel expand/collapse"
```

---

## Task 7: JS — enlarged transparent hit rects in makeSpot

**Files:**
- Modify: `js/parking.js` — `makeSpot` function (lines ~106–200)

The diagonal spots use `SPOT_W=76, SPOT_H=32`. We add a transparent hit rect `width+40, height+30` (i.e. 116×62) centered on the same `cx, cy`.

- [ ] **Step 1: In `makeSpot`, find where `rect` is appended to `g` (line ~126):**

```js
    g.appendChild(rect);
```

Immediately after that line, insert:

```js
    // Enlarged transparent hit target for mobile tapping
    const hitRect = document.createElementNS(svgNS, 'rect');
    hitRect.setAttribute('x', cx - (SPOT_W + 40) / 2);
    hitRect.setAttribute('y', cy - (SPOT_H + 30) / 2);
    hitRect.setAttribute('width', SPOT_W + 40);
    hitRect.setAttribute('height', SPOT_H + 30);
    hitRect.setAttribute('fill', 'transparent');
    hitRect.setAttribute('style', 'cursor:pointer');
    g.appendChild(hitRect);
```

- [ ] **Step 2: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add js/parking.js
git commit -m "fix: enlarge SVG spot tap targets in makeSpot for mobile"
```

---

## Task 8: JS — enlarged hit rects in makeBottomLanePerpSpot and makeWedge

**Files:**
- Modify: `js/parking.js` — `makeBottomLanePerpSpot` (lines ~288–352) and `makeWedge` (lines ~217–284)

- [ ] **Step 1: In `makeBottomLanePerpSpot`, find where `rect` is appended to `g` (line ~304):**

```js
    g.appendChild(rect);
```

Immediately after, insert:

```js
    // Enlarged transparent hit target for mobile
    const hitRect = document.createElementNS(svgNS, 'rect');
    hitRect.setAttribute('x', x - 15);
    hitRect.setAttribute('y', y - 15);
    hitRect.setAttribute('width', w + 30);
    hitRect.setAttribute('height', h + 30);
    hitRect.setAttribute('fill', 'transparent');
    hitRect.setAttribute('style', 'cursor:pointer');
    g.appendChild(hitRect);
```

- [ ] **Step 2: In `makeWedge`, find where `poly` is appended to `g` (line ~231):**

```js
    g.appendChild(poly);
```

Immediately after, insert:

```js
    // Enlarged transparent hit target for mobile (bounding box of the polygon)
    const xs = points.map(p => p[0]);
    const ys = points.map(p => p[1]);
    const bx = Math.min(...xs) - 10, by = Math.min(...ys) - 10;
    const bw = Math.max(...xs) - bx + 20, bh = Math.max(...ys) - by + 20;
    const hitRect = document.createElementNS(svgNS, 'rect');
    hitRect.setAttribute('x', bx); hitRect.setAttribute('y', by);
    hitRect.setAttribute('width', bw); hitRect.setAttribute('height', bh);
    hitRect.setAttribute('fill', 'transparent');
    hitRect.setAttribute('style', 'cursor:pointer');
    g.appendChild(hitRect);
```

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add js/parking.js
git commit -m "fix: enlarge SVG tap targets in makeBottomLanePerpSpot and makeWedge"
```

---

## Task 9: i18n — "Tap" wording

**Files:**
- Modify: `js/i18n/en.js`, `js/i18n/de.js`, `js/i18n/tr.js`

- [ ] **Step 1: In `js/i18n/en.js`, find:**

```js
  'map.info.default':    'Click a spot to see details.',
```

Replace with:

```js
  'map.info.default':    'Tap a spot to see details.',
```

- [ ] **Step 2: In `js/i18n/de.js`, verify the current value:**

```js
  'map.info.default':    'Stellplatz antippen für Details.',
```

"antippen" already means "tap" in German — no change needed.

- [ ] **Step 3: In `js/i18n/tr.js`, verify the current value:**

```js
  'map.info.default':    'Detaylar için bir yer seçin.',
```

"seçin" = "select/choose" — acceptable for mobile. No change needed.

- [ ] **Step 4: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add js/i18n/en.js
git commit -m "fix: map info panel default text — click → tap"
```

---

## Task 10: HTML — viewport-fit=cover on index.html

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Open `index.html`. Find the viewport meta tag (line 5):**

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
```

Replace with:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add index.html
git commit -m "fix: add viewport-fit=cover to login page"
```

---

## Task 11: Verify and push

- [ ] **Step 1: Open `parking.html` in a browser at mobile width (375px). Verify:**
  - Top nav links are hidden, bottom tab bar is visible
  - Active tab (Map) is highlighted
  - Full SVG map fits on screen without horizontal scroll
  - Tapping a spot shows the info panel expanding below the map
  - Tapping the same spot again collapses the info panel
  - Tapping a different spot switches selection
  - Logout button in bottom nav calls `logout()`

- [ ] **Step 2: Open `incident.html` at mobile width. Verify:**
  - Bottom tab bar visible, Incidents tab is active
  - Map tab navigates to parking.html
  - Logout works

- [ ] **Step 3: Open `index.html`. Verify no layout issues on iPhone notch (viewport-fit=cover in effect).

- [ ] **Step 4: Resize to desktop (>640px). Verify:**
  - Bottom nav disappears
  - Top nav links reappear
  - Everything looks identical to before on desktop

- [ ] **Step 5: Push**

```bash
cd /Users/D069379/My_X/Park_Management
git push
```
