# Logo Navigation Design

**Date:** 2026-06-24

## Summary

Clicking the logo navigates to `parking.html` (the parking map) for all authenticated pages. The login page logo remains a plain non-clickable image.

## Decision

- **Landing page for all roles:** `parking.html` — the parking map is the operational heart of the app and already adapts per role (shows/hides the Admin nav link based on session role).
- **Admin landing page:** `parking.html` (not `admin.html`). Admins reach the admin panel via the nav link when needed; it is not a "home" they land on.
- **Regular user landing page:** `parking.html`.
- **Login page (`index.html`):** Logo stays as a plain `<img>` — no click behavior. Standard practice: logo-as-home-link only makes sense when logged in.

## Changes Required

| File | Change |
|------|--------|
| `admin.html` | Wrap the logo+title `<div>` in `<a href="parking.html">` |
| `parking.html` | Wrap the logo+title `<div>` in `<a href="parking.html">` |
| `incident.html` | Wrap the logo+title `<div>` in `<a href="parking.html">` |
| `index.html` | No change — logo remains a plain `<img>` |

## Implementation Notes

- The wrapping `<a>` should reset default link styles (no underline, inherits color) so the header appearance does not change.
- No JavaScript changes required.
- No new pages required.
