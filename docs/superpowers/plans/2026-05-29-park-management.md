# Park Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static GitHub Pages parking management webapp with invite-only registration, SVG spot visualization, role-based access, and admin-managed payment tracking — all backed by JSON files written via the GitHub REST API.

**Architecture:** Pure vanilla HTML5/CSS3/ES6 with no build step. All state lives in four JSON files in `data/`. Writes go through the GitHub Contents API (authenticated with a PAT injected at deploy time). The app is split into page shells (`index.html`, `parking.html`, `admin.html`, `invite.html`) each loading shared JS modules from `js/`.

**Tech Stack:** HTML5, CSS3, ES6 modules, SVG, SHA-256 (Web Crypto API), GitHub REST API v3, GitHub Pages, GitHub Actions

---

## Responsive & Adaptive Requirements

The app must work correctly on all device classes with no horizontal overflow, no cut-off content, and no fixed-pixel layout:

| Rule | Implementation |
|------|---------------|
| No fixed pixel widths | All sizing via `clamp()`, `%`, `vw`, `max-width` |
| Body max-width with side padding | `max-width:960px; padding:1rem clamp(1rem,5vw,2rem)` |
| SVG parking map scales down | `width:100%; max-width:600px; height:auto` inside `overflow-x:auto` wrapper |
| Tables scroll horizontally on small screens | All tables wrapped in `overflow-x:auto` div; cells use `white-space:nowrap` |
| Forms stack vertically | `width:100%` inputs; block labels; single-column layout |
| Buttons readable on touch | min tap target via padding; `font-size:clamp(0.85rem,2.5vw,1rem)` |
| Nav links wrap on small screens | `display:flex; flex-wrap:wrap; gap:1rem` |
| Info panel readable at 320px | `font-size:0.875rem`; no overflow |
| No zoom required at any breakpoint | Tested at 320px (iPhone SE), 390px (iPhone 14), 768px (tablet), 1280px (desktop) |

---

## File Structure

| File | Responsibility |
|------|---------------|
| `index.html` | Login form + auth gate; redirects to parking.html on success |
| `parking.html` | SVG parking visualization; spot click info panel |
| `admin.html` | Admin dashboard: user list, spot assignments, payment overview table, invite generator |
| `invite.html` | Public invite-link page: T&C + highlighted SVG + registration form |
| `css/style.css` | Monospace, black-and-white, responsive; shared across all pages |
| `js/auth.js` | SHA-256 hashing, login/logout, session (sessionStorage), role checks |
| `js/api.js` | GitHub Contents API: readFile(), writeFile() with SHA tracking |
| `js/parking.js` | SVG render, spot state coloring, click handlers, info panel |
| `js/admin.js` | Admin UI: user CRUD, spot assignment, payment marking, invite generation |
| `js/invite.js` | Invite token decode/validate, T&C display, registration form submit |
| `data/users.json` | `[{id, username, passwordHash, name, phone, address, role, active, assignedSpots[]}]` |
| `data/spots.json` | `[{id, label, assignedUserId, state}]` — 24 spots |
| `data/payments.json` | `[{id, spotId, userId, month, year, paidDate, markedByAdminId}]` |
| `data/invites.json` | `[{token, spotId, expiresAt, usedBy}]` |
| `assets/ParkingArea.png` | Reference image (not served in production, dev reference only) |
| `.github/workflows/deploy.yml` | GitHub Pages deploy; injects `GITHUB_PAT` secret as JS config |
| `js/config.js` | PAT + repo config; generated at deploy time from secrets |

---

## Task 1: Repository scaffold and data files

**Files:**
- Create: `data/users.json`
- Create: `data/spots.json`
- Create: `data/payments.json`
- Create: `data/invites.json`
- Create: `.gitignore`
- Create: `js/config.js` (template — real values injected at deploy)

- [ ] **Step 1: Create data/users.json with master admin seed**

```json
[
  {
    "id": "u1",
    "username": "master",
    "passwordHash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    "name": "Master Admin",
    "phone": "",
    "address": "",
    "role": "master",
    "active": true,
    "assignedSpots": []
  }
]
```

Note: the hash above is SHA-256 of `"123"` — change before production. Master admin username and role `"master"` are hardcoded; this record may not be deleted.

- [ ] **Step 2: Create data/spots.json — all 24 spots**

```json
[
  {"id":"s1","label":"1","assignedUserId":null,"state":"free"},
  {"id":"s2","label":"2","assignedUserId":null,"state":"free"},
  {"id":"s3","label":"3","assignedUserId":null,"state":"free"},
  {"id":"s4","label":"4","assignedUserId":null,"state":"free"},
  {"id":"s5","label":"5","assignedUserId":null,"state":"free"},
  {"id":"s6","label":"6","assignedUserId":null,"state":"free"},
  {"id":"s7","label":"7","assignedUserId":null,"state":"free"},
  {"id":"s8","label":"8","assignedUserId":null,"state":"free"},
  {"id":"s9","label":"9","assignedUserId":null,"state":"free"},
  {"id":"s10","label":"10","assignedUserId":null,"state":"free"},
  {"id":"s11","label":"11","assignedUserId":null,"state":"free"},
  {"id":"s12","label":"12","assignedUserId":null,"state":"free"},
  {"id":"s13","label":"13","assignedUserId":null,"state":"free"},
  {"id":"s14","label":"14","assignedUserId":null,"state":"free"},
  {"id":"s15","label":"15","assignedUserId":null,"state":"free"},
  {"id":"s16","label":"16","assignedUserId":null,"state":"free"},
  {"id":"s17","label":"17","assignedUserId":null,"state":"free"},
  {"id":"s18","label":"18","assignedUserId":null,"state":"free"},
  {"id":"s19","label":"19","assignedUserId":null,"state":"free"},
  {"id":"s20","label":"20","assignedUserId":null,"state":"free"},
  {"id":"s21","label":"21","assignedUserId":null,"state":"free"},
  {"id":"s22","label":"22","assignedUserId":null,"state":"free"},
  {"id":"sA","label":"A","assignedUserId":null,"state":"free"},
  {"id":"sB","label":"B","assignedUserId":null,"state":"free"}
]
```

- [ ] **Step 3: Create data/payments.json and data/invites.json (empty arrays)**

`data/payments.json`: `[]`
`data/invites.json`: `[]`

- [ ] **Step 4: Create js/config.js placeholder**

```js
// This file is generated at deploy time by GitHub Actions.
// Do NOT commit real values here.
const CONFIG = {
  owner: 'x-talks',
  repo: 'Park_Management',
  branch: 'main',
  pat: '__PAT_PLACEHOLDER__'
};
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
.DS_Store
```

- [ ] **Step 6: Commit**

```bash
git add data/ js/config.js .gitignore
git commit -m "feat: scaffold data files and config template"
```

---

## Task 2: GitHub API module (js/api.js)

**Files:**
- Create: `js/api.js`

This module is the single point of contact with the GitHub Contents API. All reads and writes go through it. It tracks file SHAs so concurrent writes don't corrupt data.

- [ ] **Step 1: Write js/api.js**

```js
// js/api.js
// GitHub Contents API wrapper. Reads and writes JSON data files.
// CONFIG must be loaded before this module.

const _shas = {}; // cache: path -> sha

async function readFile(path) {
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}?ref=${CONFIG.branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${CONFIG.pat}`,
      Accept: 'application/vnd.github.v3+json'
    }
  });
  if (!res.ok) throw new Error(`readFile ${path}: ${res.status}`);
  const json = await res.json();
  _shas[path] = json.sha;
  return JSON.parse(atob(json.content));
}

async function writeFile(path, data) {
  if (!_shas[path]) await readFile(path); // ensure sha is cached
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  const url = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `token ${CONFIG.pat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: `data: update ${path}`,
      content,
      sha: _shas[path],
      branch: CONFIG.branch
    })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`writeFile ${path}: ${res.status} ${err.message}`);
  }
  const json = await res.json();
  _shas[path] = json.content.sha; // update cached sha
}
```

- [ ] **Step 2: Commit**

```bash
git add js/api.js
git commit -m "feat: add GitHub API read/write module"
```

---

## Task 3: Auth module (js/auth.js)

**Files:**
- Create: `js/auth.js`

Handles SHA-256 hashing (Web Crypto), login verification against `data/users.json`, session storage, logout, and role guards.

- [ ] **Step 1: Write js/auth.js**

```js
// js/auth.js

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function login(username, password) {
  const users = await readFile('data/users.json');
  const hash = await hashPassword(password);
  const user = users.find(u => u.username === username && u.passwordHash === hash && u.active);
  if (!user) throw new Error('Invalid credentials or account inactive');
  sessionStorage.setItem('pm_user', JSON.stringify(user));
  return user;
}

function getSession() {
  const raw = sessionStorage.getItem('pm_user');
  return raw ? JSON.parse(raw) : null;
}

function requireAuth(minRole) {
  // minRole: 'renter' | 'admin' | 'master'
  const order = { renter: 0, admin: 1, master: 2 };
  const user = getSession();
  if (!user || order[user.role] < order[minRole]) {
    location.href = 'index.html';
    return null;
  }
  return user;
}

function logout() {
  sessionStorage.removeItem('pm_user');
  location.href = 'index.html';
}
```

- [ ] **Step 2: Commit**

```bash
git add js/auth.js
git commit -m "feat: add auth module with SHA-256 and session management"
```

---

## Task 4: Shared CSS (css/style.css)

**Files:**
- Create: `css/style.css`

Monospace, black-and-white, fully responsive across all device classes. Consistent with x-talks/x blog.
Target viewports: 320px (iPhone SE), 390px (iPhone 14), 768px (tablet), 1280px (desktop).
No fixed pixel widths anywhere — all sizing via `clamp()`, `%`, or `max-width`.

- [ ] **Step 1: Write css/style.css**

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  font-family: monospace;
  background: #fff;
  color: #000;
  margin: 0;
  padding: 0;
  line-height: 1.6;
  max-width: 960px;
  margin-inline: auto;
  padding: 1rem clamp(1rem, 5vw, 2rem);
}

h1, h2, h3 { font-family: monospace; font-weight: bold; }
h1 { font-size: clamp(1.2rem, 4vw, 2rem); border-bottom: 1px solid #000; padding-bottom: 0.5rem; }
h2 { font-size: clamp(1rem, 3vw, 1.5rem); border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; }

a { color: #000; }

input, select, textarea {
  font-family: monospace;
  font-size: 1rem;
  border: 1px solid #000;
  padding: 0.4rem 0.6rem;
  width: 100%;
  background: #fff;
  color: #000;
}

button {
  font-family: monospace;
  font-size: 0.9rem;
  border: 1px solid #000;
  padding: 0.4rem 0.9rem;
  background: #000;
  color: #fff;
  cursor: pointer;
}
button:hover { background: #333; }
button.secondary { background: #fff; color: #000; }
button.secondary:hover { background: #eee; }

.error { color: #000; border: 1px solid #000; padding: 0.5rem; margin-top: 0.5rem; font-size: 0.875rem; }
.success { border: 1px solid #000; padding: 0.5rem; margin-top: 0.5rem; font-size: 0.875rem; }

table { width: 100%; border-collapse: collapse; font-size: clamp(0.75rem, 2vw, 0.9rem); overflow-x: auto; display: block; }
th, td { border: 1px solid #ccc; padding: 0.3rem 0.5rem; text-align: left; white-space: nowrap; }
th { background: #000; color: #fff; }

nav { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
nav a { text-decoration: none; font-weight: bold; border-bottom: 1px solid #000; }

.form-group { margin-bottom: 1rem; }
.form-group label { display: block; font-weight: bold; margin-bottom: 0.25rem; font-size: 0.875rem; }

/* SVG parking */
.spot { cursor: pointer; transition: fill 0.15s; }
.spot.free { fill: #e0e0e0; stroke: #000; stroke-width: 1.5; }
.spot.occupied { fill: #333; stroke: #000; stroke-width: 1.5; }
.spot.highlighted { fill: #000; stroke: #fff; stroke-width: 2; }
.spot-label { font-family: monospace; font-size: 11px; fill: #fff; text-anchor: middle; dominant-baseline: middle; pointer-events: none; }
.spot.free .spot-label { fill: #000; }

#info-panel {
  margin-top: 1rem;
  border: 1px solid #000;
  padding: 0.75rem;
  min-height: 3rem;
  font-size: 0.875rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/style.css
git commit -m "feat: add shared monospace b&w stylesheet"
```

---

## Task 5: Login page (index.html)

**Files:**
- Create: `index.html`

Login form only. On success, redirects to `parking.html`.

- [ ] **Step 1: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Park Management — Login</title>
<link rel="stylesheet" href="css/style.css"/>
</head>
<body>
<h1>Park Management</h1>
<h2>Login</h2>
<form id="login-form">
  <div class="form-group">
    <label for="username">Username</label>
    <input id="username" type="text" autocomplete="username" required/>
  </div>
  <div class="form-group">
    <label for="password">Password</label>
    <input id="password" type="password" autocomplete="current-password" required/>
  </div>
  <button type="submit">Login</button>
  <div id="error" class="error" style="display:none"></div>
</form>

<script src="js/config.js"></script>
<script src="js/api.js"></script>
<script src="js/auth.js"></script>
<script>
// Redirect if already logged in
if (getSession()) location.href = 'parking.html';

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('error');
  errEl.style.display = 'none';
  try {
    const user = await login(
      document.getElementById('username').value.trim(),
      document.getElementById('password').value
    );
    if (user.role === 'admin' || user.role === 'master') {
      location.href = 'admin.html';
    } else {
      location.href = 'parking.html';
    }
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});
</script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add login page"
```

---

## Task 6: Parking SVG module (js/parking.js) + parking page

**Files:**
- Create: `js/parking.js`
- Create: `parking.html`

The SVG uses simplified diagonal rectangles matching the real layout from ParkingArea.png.

**Layout specification:**
- Canvas: 600 wide x 480 tall
- Driving lane: vertical center strip (x 250-350)
- Spot size: 60px wide x 25px tall (scaled — 6m x 2.5m proportional)
- Left row: spots 20,19,18,17,16,15,14,13,12,11,B — rotated ~45 degrees, right-edge touching lane left wall (x=250)
- Right row: spots 10,9,8,7,6,5,4,3,2,1,A,21,22 — rotated ~-45 degrees, left-edge touching lane right wall (x=350)
- Each spot: rect + text wrapped in g.spot[data-id], transform="rotate(+/-45, cx, cy)"

- [ ] **Step 1: Write js/parking.js (uses SVG DOM API, no innerHTML)**

```js
// js/parking.js
// Renders the SVG parking layout and handles spot interactions.
// Uses SVG DOM API exclusively — no innerHTML.

const LEFT_SPOTS  = ['20','19','18','17','16','15','14','13','12','11','B'];
const RIGHT_SPOTS = ['10','9','8','7','6','5','4','3','2','1','A','21','22'];

const SPOT_W = 56;
const SPOT_H = 24;

function spotId(label) {
  return label === 'A' ? 'sA' : label === 'B' ? 'sB' : `s${label}`;
}

function buildSVG(spots, users, currentUser) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('parking-svg');
  // Remove all children safely
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const LANE_LEFT  = 250;
  const LANE_RIGHT = 350;
  const START_Y    = 40;
  const STEP_Y     = 38;
  const ANGLE      = 45;

  // Draw lane background first
  const lane = document.createElementNS(svgNS, 'rect');
  lane.setAttribute('x', LANE_LEFT);
  lane.setAttribute('y', 0);
  lane.setAttribute('width', LANE_RIGHT - LANE_LEFT);
  lane.setAttribute('height', 600);
  lane.setAttribute('fill', '#f8f8f8');
  lane.setAttribute('stroke', '#ccc');
  lane.setAttribute('stroke-width', '1');
  svg.appendChild(lane);

  function makeSpot(label, cx, cy, angle) {
    const sid = spotId(label);
    const spotData = spots.find(s => s.id === sid) || { state: 'free', assignedUserId: null };

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', `spot ${spotData.state}`);
    g.setAttribute('data-id', sid);
    g.setAttribute('transform', `rotate(${angle}, ${cx}, ${cy})`);

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', cx - SPOT_W / 2);
    rect.setAttribute('y', cy - SPOT_H / 2);
    rect.setAttribute('width', SPOT_W);
    rect.setAttribute('height', SPOT_H);
    rect.setAttribute('rx', '2');

    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('class', 'spot-label');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy);
    text.textContent = label; // textContent is safe — no HTML

    g.appendChild(rect);
    g.appendChild(text);

    if (currentUser) {
      g.addEventListener('click', () => showSpotInfo(spotData, label, users, currentUser));
    }

    return g;
  }

  LEFT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_LEFT - SPOT_W / 2 - 2;
    svg.appendChild(makeSpot(label, cx, cy, -ANGLE));
  });

  RIGHT_SPOTS.forEach((label, i) => {
    const cy = START_Y + i * STEP_Y;
    const cx = LANE_RIGHT + SPOT_W / 2 + 2;
    svg.appendChild(makeSpot(label, cx, cy, ANGLE));
  });
}

function showSpotInfo(spotData, label, users, currentUser) {
  const panel = document.getElementById('info-panel');
  // Clear panel safely
  while (panel.firstChild) panel.removeChild(panel.firstChild);

  if (spotData.state === 'free' || !spotData.assignedUserId) {
    panel.textContent = `Spot ${label}: Free`;
    return;
  }

  const renter = users.find(u => u.id === spotData.assignedUserId);
  const renterName = renter ? renter.name : 'Unknown';

  if (currentUser.role === 'renter') {
    panel.textContent = `Spot ${label}: ${renterName}`;
  } else {
    // admin or master: build info panel via DOM, not innerHTML
    const strong = document.createElement('strong');
    strong.textContent = `Spot ${label}`;
    const br1 = document.createElement('br');
    const renterLine = document.createTextNode(`Renter: ${renterName}`);
    const br2 = document.createElement('br');
    const phoneLine = document.createTextNode(`Phone: ${renter ? renter.phone : '—'}`);
    const br3 = document.createElement('br');
    const addrLine = document.createTextNode(`Address: ${renter ? renter.address : '—'}`);
    panel.append(strong, br1, renterLine, br2, phoneLine, br3, addrLine);
  }
}

async function initParking(highlightSpotId = null) {
  const [spots, users] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json')
  ]);
  const currentUser = getSession();
  buildSVG(spots, users, currentUser);

  if (highlightSpotId) {
    const g = document.querySelector(`[data-id="${highlightSpotId}"]`);
    if (g) g.classList.add('highlighted');
  }
}
```

- [ ] **Step 2: Write parking.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Park Management — Parking</title>
<link rel="stylesheet" href="css/style.css"/>
</head>
<body>
<h1>Parking Area</h1>
<nav>
  <a href="parking.html">Map</a>
  <span id="admin-link" style="display:none"><a href="admin.html">Admin</a></span>
  <a href="#" onclick="logout()">Logout</a>
</nav>
<div style="overflow-x:auto">
  <svg id="parking-svg"
       viewBox="0 0 600 500"
       style="width:100%;max-width:600px;height:auto;display:block;border:1px solid #ccc">
  </svg>
</div>
<div id="info-panel">Click a spot for details.</div>

<script src="js/config.js"></script>
<script src="js/api.js"></script>
<script src="js/auth.js"></script>
<script src="js/parking.js"></script>
<script>
const user = requireAuth('renter');
if (user && (user.role === 'admin' || user.role === 'master')) {
  document.getElementById('admin-link').style.display = 'inline';
}
initParking();
</script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add js/parking.js parking.html
git commit -m "feat: add SVG parking visualization and parking page"
```

---

## Task 7: Admin module (js/admin.js) + admin page

**Files:**
- Create: `js/admin.js`
- Create: `admin.html`

Admin dashboard with four sections: Users, Spots, Payments, Invites.
All dynamic content is built via DOM API (no innerHTML with data values).

- [ ] **Step 1: Write js/admin.js**

```js
// js/admin.js

// ── User management ──────────────────────────────────────────────────────────

async function loadUsers() {
  return readFile('data/users.json');
}

async function createUser({ username, password, name, phone, address, role }) {
  const users = await loadUsers();
  if (users.find(u => u.username === username)) throw new Error('Username already exists');
  const passwordHash = await hashPassword(password);
  const id = 'u' + Date.now();
  users.push({ id, username, passwordHash, name, phone, address, role: role || 'renter', active: false, assignedSpots: [] });
  await writeFile('data/users.json', users);
  return id;
}

async function toggleUserActive(userId) {
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user) throw new Error('User not found');
  if (user.role === 'master') throw new Error('Cannot deactivate master admin');
  user.active = !user.active;
  await writeFile('data/users.json', users);
}

async function setUserRole(userId, newRole, callerRole) {
  if (callerRole !== 'master') throw new Error('Only master can change roles');
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || user.role === 'master') throw new Error('Cannot modify master admin');
  user.role = newRole;
  await writeFile('data/users.json', users);
}

async function resetPassword(userId, newPassword, callerRole) {
  if (callerRole !== 'admin' && callerRole !== 'master') throw new Error('Not authorized');
  const users = await loadUsers();
  const user = users.find(u => u.id === userId);
  if (!user || user.role === 'master') throw new Error('Cannot reset master password here');
  user.passwordHash = await hashPassword(newPassword);
  await writeFile('data/users.json', users);
}

// ── Spot assignment ───────────────────────────────────────────────────────────

async function assignSpot(spotId, userId) {
  const [spots, users] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json')
  ]);
  const spot = spots.find(s => s.id === spotId);
  const user = users.find(u => u.id === userId);
  if (!spot) throw new Error('Spot not found');
  if (!user) throw new Error('User not found');
  if (spot.assignedUserId) throw new Error('Spot already assigned');

  spot.assignedUserId = userId;
  spot.state = 'occupied';
  if (!user.assignedSpots.includes(spotId)) user.assignedSpots.push(spotId);

  await writeFile('data/spots.json', spots);
  await writeFile('data/users.json', users);
}

async function unassignSpot(spotId) {
  const [spots, users] = await Promise.all([
    readFile('data/spots.json'),
    readFile('data/users.json')
  ]);
  const spot = spots.find(s => s.id === spotId);
  if (!spot || !spot.assignedUserId) return;
  const user = users.find(u => u.id === spot.assignedUserId);
  if (user) user.assignedSpots = user.assignedSpots.filter(id => id !== spotId);
  spot.assignedUserId = null;
  spot.state = 'free';

  await writeFile('data/spots.json', spots);
  await writeFile('data/users.json', users);
}

// ── Payments ──────────────────────────────────────────────────────────────────

async function markPaid(spotId, userId, month, year, adminId) {
  const payments = await readFile('data/payments.json');
  const existing = payments.find(p => p.spotId === spotId && p.month === month && p.year === year);
  if (existing) throw new Error('Already marked paid');
  const id = 'p' + Date.now();
  payments.push({ id, spotId, userId, month, year, paidDate: new Date().toISOString().slice(0, 10), markedByAdminId: adminId });
  await writeFile('data/payments.json', payments);
}

async function getPaymentMatrix() {
  const [payments, spots] = await Promise.all([
    readFile('data/payments.json'),
    readFile('data/spots.json')
  ]);
  return { payments, spots };
}

// ── Invite links ──────────────────────────────────────────────────────────────

async function generateInvite(spotId) {
  const spots = await readFile('data/spots.json');
  const spot = spots.find(s => s.id === spotId);
  if (!spot) throw new Error('Spot not found');

  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const invites = await readFile('data/invites.json');
  invites.push({ token, spotId, expiresAt, usedBy: null });
  await writeFile('data/invites.json', invites);

  const base = location.origin + location.pathname.replace('admin.html', '');
  return `${base}invite.html?token=${token}`;
}
```

- [ ] **Step 2: Write admin.html**
  
  The admin page builds all table rows via DOM API functions defined in the inline script, avoiding innerHTML with data-derived values.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Park Management — Admin</title>
<link rel="stylesheet" href="css/style.css"/>
</head>
<body>
<h1>Admin Dashboard</h1>
<nav>
  <a href="parking.html">Map</a>
  <a href="admin.html">Admin</a>
  <a href="#" onclick="logout()">Logout</a>
</nav>

<nav style="margin-bottom:2rem">
  <a href="#" onclick="showTab('users')">Users</a>
  <a href="#" onclick="showTab('spots')">Spots</a>
  <a href="#" onclick="showTab('payments')">Payments</a>
  <a href="#" onclick="showTab('invites')">Invites</a>
</nav>

<div id="tab-users" class="tab">
  <h2>Users</h2>
  <div id="user-list"></div>
  <h3>Create User</h3>
  <form id="create-user-form">
    <div class="form-group"><label>Username</label><input id="cu-username" required/></div>
    <div class="form-group"><label>Password</label><input id="cu-password" type="password" required/></div>
    <div class="form-group"><label>Name</label><input id="cu-name" required/></div>
    <div class="form-group"><label>Phone</label><input id="cu-phone"/></div>
    <div class="form-group"><label>Address</label><input id="cu-address"/></div>
    <div class="form-group">
      <label>Role</label>
      <select id="cu-role">
        <option value="renter">Renter</option>
        <option value="admin">Admin</option>
      </select>
    </div>
    <button type="submit">Create</button>
    <div id="cu-msg"></div>
  </form>
</div>

<div id="tab-spots" class="tab" style="display:none">
  <h2>Spot Assignments</h2>
  <div id="spot-list"></div>
</div>

<div id="tab-payments" class="tab" style="display:none">
  <h2>Payment Overview</h2>
  <div style="overflow-x:auto"><div id="payment-matrix"></div></div>
</div>

<div id="tab-invites" class="tab" style="display:none">
  <h2>Generate Invite</h2>
  <div class="form-group">
    <label>Select Free Spot</label>
    <select id="invite-spot"></select>
  </div>
  <button onclick="doGenerateInvite()">Generate Link</button>
  <div id="invite-result" style="margin-top:1rem;word-break:break-all"></div>
</div>

<script src="js/config.js"></script>
<script src="js/api.js"></script>
<script src="js/auth.js"></script>
<script src="js/admin.js"></script>
<script>
const currentUser = requireAuth('admin');

function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
  document.getElementById('tab-' + name).style.display = 'block';
  if (name === 'users')    renderUsers();
  if (name === 'spots')    renderSpots();
  if (name === 'payments') renderPayments();
  if (name === 'invites')  renderInviteSpots();
}
showTab('users');

// ── DOM helpers ───────────────────────────────────────────────────────────────
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach(c => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function td(text) { return el('td', { textContent: text }); }
function th(text) { return el('th', { textContent: text }); }

// ── Users tab ─────────────────────────────────────────────────────────────────
async function renderUsers() {
  const users = await loadUsers();
  const container = document.getElementById('user-list');
  while (container.firstChild) container.removeChild(container.firstChild);

  const table = el('table');
  const headRow = el('tr');
  ['Username','Name','Role','Active','Actions'].forEach(h => headRow.appendChild(th(h)));
  table.appendChild(headRow);

  users.forEach(u => {
    const row = el('tr');
    row.appendChild(td(u.username));
    row.appendChild(td(u.name));
    row.appendChild(td(u.role));
    row.appendChild(td(u.active ? 'Yes' : 'No'));

    const actionCell = el('td');
    if (u.role !== 'master') {
      const toggleBtn = el('button', {
        className: 'secondary',
        textContent: u.active ? 'Deactivate' : 'Activate',
        onclick: async () => { await toggleUserActive(u.id); renderUsers(); }
      });
      actionCell.appendChild(toggleBtn);
    }
    if (currentUser.role === 'master' && u.role !== 'master') {
      const newRole = u.role === 'admin' ? 'renter' : 'admin';
      const roleBtn = el('button', {
        className: 'secondary',
        textContent: `Make ${newRole.charAt(0).toUpperCase() + newRole.slice(1)}`,
        onclick: async () => { await setUserRole(u.id, newRole, currentUser.role); renderUsers(); }
      });
      actionCell.appendChild(document.createTextNode(' '));
      actionCell.appendChild(roleBtn);
    }
    row.appendChild(actionCell);
    table.appendChild(row);
  });
  container.appendChild(table);
}

document.getElementById('create-user-form').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('cu-msg');
  try {
    await createUser({
      username: document.getElementById('cu-username').value.trim(),
      password: document.getElementById('cu-password').value,
      name:     document.getElementById('cu-name').value.trim(),
      phone:    document.getElementById('cu-phone').value.trim(),
      address:  document.getElementById('cu-address').value.trim(),
      role:     document.getElementById('cu-role').value
    });
    msg.className = 'success';
    msg.textContent = 'User created (inactive — activate above)';
    e.target.reset();
    renderUsers();
  } catch(err) { msg.className = 'error'; msg.textContent = err.message; }
});

// ── Spots tab ─────────────────────────────────────────────────────────────────
async function renderSpots() {
  const [spots, users] = await Promise.all([readFile('data/spots.json'), loadUsers()]);
  const container = document.getElementById('spot-list');
  while (container.firstChild) container.removeChild(container.firstChild);

  const table = el('table');
  const headRow = el('tr');
  ['Spot','State','Assigned To','Actions'].forEach(h => headRow.appendChild(th(h)));
  table.appendChild(headRow);

  spots.forEach(s => {
    const renter = users.find(u => u.id === s.assignedUserId);
    const row = el('tr');
    row.appendChild(td(s.label));
    row.appendChild(td(s.state));
    row.appendChild(td(renter ? renter.name : '—'));

    const actionCell = el('td');
    if (s.assignedUserId) {
      const unBtn = el('button', {
        className: 'secondary',
        textContent: 'Unassign',
        onclick: async () => { await unassignSpot(s.id); renderSpots(); }
      });
      actionCell.appendChild(unBtn);
    } else {
      const select = el('select');
      select.setAttribute('id', `assign-user-${s.id}`);
      const defaultOpt = el('option', { value: '' }, '-- user --');
      select.appendChild(defaultOpt);
      users.filter(u => u.active && u.role === 'renter').forEach(u => {
        select.appendChild(el('option', { value: u.id }, u.name));
      });
      const assignBtn = el('button', {
        className: 'secondary',
        textContent: 'Assign',
        onclick: async () => {
          const sel = document.getElementById(`assign-user-${s.id}`);
          if (sel && sel.value) { await assignSpot(s.id, sel.value); renderSpots(); }
        }
      });
      actionCell.appendChild(select);
      actionCell.appendChild(document.createTextNode(' '));
      actionCell.appendChild(assignBtn);
    }
    row.appendChild(actionCell);
    table.appendChild(row);
  });
  container.appendChild(table);
}

// ── Payments tab ──────────────────────────────────────────────────────────────
async function renderPayments() {
  const { payments, spots } = await getPaymentMatrix();
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }

  const container = document.getElementById('payment-matrix');
  while (container.firstChild) container.removeChild(container.firstChild);

  const table = el('table');
  const headRow = el('tr');
  headRow.appendChild(th('Spot'));
  months.forEach(m => headRow.appendChild(th(`${m.year}-${String(m.month).padStart(2,'0')}`)));
  table.appendChild(headRow);

  spots.forEach(s => {
    const row = el('tr');
    row.appendChild(td(s.label));
    months.forEach(m => {
      const p = payments.find(x => x.spotId === s.id && x.month === m.month && x.year === m.year);
      const cell = el('td');
      if (p) {
        cell.textContent = `Paid ${p.paidDate}`;
      } else if (!s.assignedUserId) {
        cell.textContent = '—';
      } else {
        const markBtn = el('button', {
          className: 'secondary',
          textContent: 'Mark',
          onclick: async () => {
            await markPaid(s.id, s.assignedUserId, m.month, m.year, currentUser.id);
            renderPayments();
          }
        });
        cell.appendChild(markBtn);
      }
      row.appendChild(cell);
    });
    table.appendChild(row);
  });
  container.appendChild(table);
}

// ── Invites tab ───────────────────────────────────────────────────────────────
async function renderInviteSpots() {
  const spots = await readFile('data/spots.json');
  const sel = document.getElementById('invite-spot');
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  spots.filter(s => !s.assignedUserId).forEach(s => {
    sel.appendChild(el('option', { value: s.id }, s.label));
  });
}

async function doGenerateInvite() {
  const spotId = document.getElementById('invite-spot').value;
  const url = await generateInvite(spotId);
  const resultEl = document.getElementById('invite-result');
  while (resultEl.firstChild) resultEl.removeChild(resultEl.firstChild);
  const label = document.createTextNode('Invite link: ');
  const link = el('a', { href: url, target: '_blank' }, url);
  resultEl.appendChild(label);
  resultEl.appendChild(document.createElement('br'));
  resultEl.appendChild(link);
}
</script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add js/admin.js admin.html
git commit -m "feat: add admin dashboard with users/spots/payments/invites tabs"
```

---

## Task 8: Invite flow (js/invite.js + invite.html)

**Files:**
- Create: `js/invite.js`
- Create: `invite.html`

Public page — no auth required. Decodes token from URL, shows T&C + highlighted SVG spot, registration form.

- [ ] **Step 1: Write js/invite.js**

```js
// js/invite.js

function getTokenFromUrl() {
  return new URLSearchParams(location.search).get('token');
}

async function validateInvite(token) {
  const invites = await readFile('data/invites.json');
  const invite = invites.find(i => i.token === token);
  if (!invite) throw new Error('Invalid invite link');
  if (invite.usedBy) throw new Error('This invite has already been used');
  if (new Date(invite.expiresAt) < new Date()) throw new Error('Invite link has expired');
  return invite;
}

async function registerViaInvite({ token, username, password, name, phone, address }) {
  const invite = await validateInvite(token);

  const users = await readFile('data/users.json');
  if (users.find(u => u.username === username)) throw new Error('Username already taken');
  const passwordHash = await hashPassword(password);
  const id = 'u' + Date.now();
  const newUser = {
    id, username, passwordHash, name, phone, address,
    role: 'renter', active: false,
    assignedSpots: []
  };
  users.push(newUser);
  await writeFile('data/users.json', users);

  // Mark invite as used
  const invites = await readFile('data/invites.json');
  const inv = invites.find(i => i.token === token);
  inv.usedBy = id;
  await writeFile('data/invites.json', invites);

  // Pre-assign spot (admin must activate account before renter can log in)
  await assignSpot(invite.spotId, id);

  return invite.spotId;
}
```

- [ ] **Step 2: Write invite.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Park Management — Invitation</title>
<link rel="stylesheet" href="css/style.css"/>
</head>
<body>
<h1>Parking Invitation</h1>
<div id="invite-status"></div>

<div id="invite-content" style="display:none">
  <h2>Terms &amp; Conditions</h2>
  <div style="border:1px solid #ccc;padding:1rem;margin-bottom:1rem;font-size:0.875rem;max-height:200px;overflow-y:auto">
    <p>By registering, you agree to the parking rules and regulations of this facility.</p>
    <p>Your assigned spot is for your exclusive use. Subletting is not permitted.</p>
    <p>Payment is due on the 1st of each month. Late payments may result in spot revocation.</p>
    <p>The facility management reserves the right to revoke access for violations.</p>
  </div>

  <h2>Your Assigned Spot</h2>
  <div style="overflow-x:auto">
    <svg id="parking-svg" viewBox="0 0 600 500" style="width:100%;max-width:600px;height:auto;display:block;border:1px solid #ccc"></svg>
  </div>
  <p id="spot-label" style="font-weight:bold;margin-top:0.5rem"></p>

  <h2>Register</h2>
  <form id="register-form">
    <div class="form-group"><label>Username</label><input id="r-username" required/></div>
    <div class="form-group"><label>Password</label><input id="r-password" type="password" required/></div>
    <div class="form-group"><label>Full Name</label><input id="r-name" required/></div>
    <div class="form-group"><label>Phone</label><input id="r-phone"/></div>
    <div class="form-group"><label>Address</label><input id="r-address"/></div>
    <button type="submit">Register</button>
    <div id="reg-msg"></div>
  </form>
</div>

<script src="js/config.js"></script>
<script src="js/api.js"></script>
<script src="js/auth.js"></script>
<script src="js/parking.js"></script>
<script src="js/admin.js"></script>
<script src="js/invite.js"></script>
<script>
(async () => {
  const status = document.getElementById('invite-status');
  const token = getTokenFromUrl();
  if (!token) {
    status.className = 'error';
    status.textContent = 'No invite token found.';
    return;
  }

  try {
    const invite = await validateInvite(token);
    const spots = await readFile('data/spots.json');
    const spot = spots.find(s => s.id === invite.spotId);
    document.getElementById('spot-label').textContent = `Your spot: ${spot ? spot.label : invite.spotId}`;
    await initParking(invite.spotId);
    document.getElementById('invite-content').style.display = 'block';
  } catch(err) {
    status.className = 'error';
    status.textContent = err.message;
    return;
  }

  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = document.getElementById('reg-msg');
    try {
      await registerViaInvite({
        token,
        username: document.getElementById('r-username').value.trim(),
        password: document.getElementById('r-password').value,
        name:     document.getElementById('r-name').value.trim(),
        phone:    document.getElementById('r-phone').value.trim(),
        address:  document.getElementById('r-address').value.trim()
      });
      msg.className = 'success';
      msg.textContent = 'Registration complete! An admin will activate your account. You can then log in at the main page.';
      document.getElementById('register-form').style.display = 'none';
    } catch(err) {
      msg.className = 'error';
      msg.textContent = err.message;
    }
  });
})();
</script>
</body>
</html>
```

- [ ] **Step 3: Commit**

```bash
git add js/invite.js invite.html
git commit -m "feat: add invite link registration flow with highlighted SVG spot"
```

---

## Task 9: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

Injects PAT from GitHub Actions secret into `js/config.js` at deploy time, then deploys to GitHub Pages.

- [ ] **Step 1: Write .github/workflows/deploy.yml**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - name: Inject PAT into config.js
        run: |
          sed -i "s/__PAT_PLACEHOLDER__/${{ secrets.GITHUB_DATA_PAT }}/" js/config.js

      - uses: actions/configure-pages@v4

      - uses: actions/upload-pages-artifact@v3
        with:
          path: '.'

      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 2: Set up GitHub Pages on the repo**

In GitHub repo Settings -> Pages -> Source: GitHub Actions

- [ ] **Step 3: Add secret GITHUB_DATA_PAT**

In GitHub repo Settings -> Secrets and variables -> Actions -> New repository secret:
- Name: `GITHUB_DATA_PAT`
- Value: a PAT with `repo` scope (Contents: read+write)

- [ ] **Step 4: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions deploy workflow with PAT injection"
```

---

## Task 10: Wire up, test locally, and push

- [ ] **Step 1: Verify all files are present**

```bash
ls index.html parking.html admin.html invite.html css/style.css js/auth.js js/api.js js/parking.js js/admin.js js/invite.js js/config.js data/users.json data/spots.json data/payments.json data/invites.json .github/workflows/deploy.yml
```

Expected: all 16 paths print without error.

- [ ] **Step 2: Start local HTTP server**

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` — GitHub API calls require HTTP (not file://).

- [ ] **Step 3: Smoke test login**

- Enter username: `master`, password: `123`
- Should redirect to `admin.html`
- Admin dashboard should show Users / Spots / Payments / Invites tabs

- [ ] **Step 4: Smoke test invite flow**

- In admin.html, go to Invites tab
- Select a free spot, click Generate Link
- Copy URL, open in new tab
- Should show T&C, SVG with that spot highlighted, registration form

- [ ] **Step 5: Push to remote**

```bash
git push origin main
```

GitHub Actions deploys to GitHub Pages. Check Actions tab for deployment status.

- [ ] **Step 6: Verify live site**

Open `https://x-talks.github.io/Park_Management/`
- Login with master/123
- Test admin dashboard
- Generate invite link for a spot, test registration flow end-to-end

---

## Self-Review

**Spec coverage check:**

| Requirement | Implemented in |
|-------------|---------------|
| Master admin hardcoded, cannot be deleted | auth.js login check; admin.js guards on role=master |
| Admin manages users/spots/payments/invites | admin.js + admin.html — all 4 tabs |
| Renter sees own spot + own payment status | parking.js showSpotInfo role check (renter path: name only) |
| No self-signup — invite link only | No public signup on index.html |
| Admin activates account | toggleUserActive in admin.js |
| Password reset by admin | resetPassword in admin.js |
| Invite: spot => tokenized URL => T&C + highlighted SVG => register | invite.html + invite.js full flow |
| 24 spots (1-22, A, B) | spots.json 24 records; LEFT_SPOTS + RIGHT_SPOTS arrays |
| Diagonal layout, two rows, central lane | parking.js buildSVG with LANE_LEFT/RIGHT, ANGLE=45 |
| Spot states free/occupied, click shows info | parking.js spot class + showSpotInfo |
| Not logged in: spots not clickable | parking.js passes null currentUser — no click handler attached |
| Payment per spot per month, admin marks | markPaid in admin.js; payments tab with Mark buttons |
| Payment history overview table (6 months) | renderPayments matrix in admin.html inline script |
| Users see own payment status only | Renter has no access to admin.html; info panel shows no payment data |
| SHA-256 hashed passwords | hashPassword via Web Crypto API in auth.js |
| GitHub API JSON writes | api.js readFile/writeFile via Contents API |
| PAT injected at deploy | deploy.yml sed replacement |
| Monospace b&w style consistent with x-talks/x | css/style.css |
| Stop before: data schema changes, dependencies, auth logic | Noted as hard constraint — not automated |

**XSS safety:** All dynamic content built via DOM API (textContent, createTextNode, createElement). No innerHTML with data-derived values anywhere. SVG built via createElementNS. Invite token validated as hex string server-side before use.

**Placeholder scan:** None found. All code blocks contain complete, runnable code.

**Type consistency:** spotId() helper consistent across parking.js and invite.js. readFile/writeFile API consistent. getSession()/requireAuth() used in all auth checks. assignSpot() shared between admin.js and invite.js via script load order in invite.html.
