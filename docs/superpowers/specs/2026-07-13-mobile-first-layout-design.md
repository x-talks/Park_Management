# Mobile-First Layout Design

## Goal

Redesign the Park Management PWA to be fully mobile-first — a single responsive layout that works for both residents and admins on any screen size, replacing the current desktop-first multi-page structure.

## Decisions Made

- **Map scaling:** Scale-to-fit (option A) — map shrinks to fill screen width, all spots visible at once, user pinch-zooms if needed
- **Spot interaction:** Bottom sheet (slide up) — tapping a spot opens a panel from the bottom of the screen, map stays visible above
- **Nav structure:** Role-based tabs — residents get 3 tabs, admins get 4 tabs (Admin tab injected at runtime)
- **Admin access:** Mobile-first for everyone — no separate desktop admin view; admins use the same mobile UI with extra controls

---

## Screen Structure

### All pages share

- **Top header:** App logo/name, language switcher, theme toggle. Admin badge (`ADMIN` chip) visible when `role === 'admin'` or `role === 'master'`.
- **Bottom navigation:** Fixed at bottom. Tabs injected based on role at login.

### Bottom nav — Resident (3 tabs)

| Tab | Icon | Page |
|-----|------|------|
| Map | 🗺 | `parking.html` |
| Incidents | ⚠️ | `incident.html` |
| Profile | 👤 | profile section on `parking.html` |

### Bottom nav — Admin (4 tabs)

| Tab | Icon | Page |
|-----|------|------|
| Map | 🗺 | `parking.html` |
| Incidents | ⚠️ | `incident.html` |
| Admin | ⚙️ | `admin.html` |
| Profile | 👤 | profile section on `parking.html` |

Admin tab is rendered only when `currentUser.role === 'admin' || currentUser.role === 'master'` — same role check already used in the codebase.

---

## Map Screen (`parking.html`)

### Layout

```
┌─────────────────────────────┐
│ Header (logo + controls)    │
├─────────────────────────────┤
│                             │
│   SVG parking map           │
│   (scales to fill width,    │
│    height auto)             │
│                             │
│   Legend (inline below map) │
├─────────────────────────────┤
│ Bottom sheet (collapsed)    │  ← "Tap a spot to see details"
├─────────────────────────────┤
│ Bottom nav                  │
└─────────────────────────────┘
```

### Map SVG

- `viewBox="-60 0 920 760"` unchanged (existing geometry stays)
- `width: 100%`, `height: auto` — scales to container width
- No horizontal scroll; map shrinks to fit

### Bottom sheet — states

**Collapsed (default):**
- Shows drag handle + hint text: "Tap a spot to see details"
- Height: ~48px

**Expanded (after tap):**
- Slides up to ~40% of screen height
- Shows spot details + action buttons
- Drag handle at top; tapping backdrop or dragging down collapses it

### Bottom sheet — Resident content

```
Spot 1 · Your spot          [status pill: Free / Occupied]
Assigned to: you · Last paid: June 2026

[ Reserve ]  [ Pay ]  [ ⚠ Report ]
```

- **Reserve:** Only shown if spot is free and user has no active reservation
- **Pay:** Only shown if user is assigned to this spot
- **Report:** Always shown

### Bottom sheet — Admin content (same spot, extra buttons)

```
Spot 7 · Occupied           [status pill: Occupied]
Assigned to: Hans Mueller · Since: Jan 2026

[ Pay ]  [ ⚠ Report ]  [ Release ]  [ Assign ]
```

- **Release:** Frees the spot (removes occupant assignment)
- **Assign:** Opens assign-to-resident flow (existing modal)
- Admin always sees all 4 buttons regardless of spot state

### Legend

Remains below the map as a horizontal row of colored swatches. Unchanged from current design.

### Info panel

Replaced by the bottom sheet. The existing `#info-panel` div is removed.

---

## Profile Screen

Accessed via the Profile tab. Contains:
- Display name edit
- Plate number edit
- Save button

This is the existing `profile-edit-section` content, promoted to its own tab destination rather than hidden at the bottom of `parking.html`.

---

## Admin Screen (`admin.html`)

Existing admin page. No structural changes required for this spec — it becomes accessible via the Admin tab in the bottom nav on mobile. Future spec will address admin screen mobile layout.

---

## Incidents Screen (`incident.html`)

Existing incidents page. Accessible via the Incidents tab. No structural changes in this spec.

---

## Residents Section

The collapsible Residents section currently on `parking.html` is removed from the map page. Resident list access is deferred to a future spec (could become its own tab or part of Admin).

---

## Implementation Scope

This spec covers changes to **`parking.html`** and **`css/style.css`** only:

1. Replace `#info-panel` with a bottom sheet component
2. Update bottom nav to be role-aware (3 vs 4 tabs)
3. Ensure map SVG scales to 100% width on mobile
4. Remove residents collapsible section from parking page
5. Profile section becomes the destination for the Profile tab

`admin.html` and `incident.html` are out of scope for this iteration.

---

## Files Changed

| File | Change |
|------|--------|
| `parking.html` | Bottom sheet markup, role-aware nav, remove info-panel and residents section |
| `css/style.css` | Bottom sheet styles, mobile nav styles, map scaling |
| `js/parking.js` | Bottom sheet open/close logic, spot tap handler update |

---

## Non-Goals

- Redesigning the map SVG geometry (already done in brainstorm sessions)
- Making `admin.html` mobile-first (separate spec)
- Pinch-to-zoom implementation (browser native handles this)
- Offline / PWA caching changes
