# Logo Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the logo in the site header a clickable link to `parking.html` on all authenticated pages (`admin.html`, `parking.html`, `incident.html`), while leaving the login page logo unchanged.

**Architecture:** Wrap the existing logo+title `<div>` in a styled `<a href="parking.html">` on three HTML files. Add a CSS rule to reset link styles so the header appearance is unchanged. No JS, no new files.

**Tech Stack:** Plain HTML, CSS

---

### Task 1: Add CSS reset for logo link

**Files:**
- Modify: `/Users/D069379/My_X/Park_Management/css/style.css`

The wrapping `<a>` needs to look exactly like the current `<div>` — no underline, no blue color, inherits layout.

- [ ] **Step 1: Open `css/style.css` and find the `.site-header` block**

The header styles are in `css/style.css`. Look for `.site-header`.

- [ ] **Step 2: Add the logo link style after `.site-header`**

Add this rule immediately after the `.site-header` block:

```css
.site-header .logo-link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: inherit;
}
.site-header .logo-link:hover {
  opacity: 0.85;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add css/style.css
git commit -m "style: add logo-link class for clickable header logo"
```

---

### Task 2: Make logo clickable in `admin.html`

**Files:**
- Modify: `/Users/D069379/My_X/Park_Management/admin.html`

- [ ] **Step 1: Find the logo div in `admin.html`**

Locate this block (around line 25):

```html
<div style="display:flex;align-items:center;gap:0.6rem">
  <img src="logo.png" alt="" style="height:28px;width:auto;filter:invert(1);opacity:0.9" onerror="this.style.display='none'"/>
  <h1 data-i18n="app.admin">Admin Dashboard</h1>
</div>
```

- [ ] **Step 2: Replace the div with an anchor**

Replace the block above with:

```html
<a href="parking.html" class="logo-link">
  <img src="logo.png" alt="" style="height:28px;width:auto;filter:invert(1);opacity:0.9" onerror="this.style.display='none'"/>
  <h1 data-i18n="app.admin">Admin Dashboard</h1>
</a>
```

- [ ] **Step 3: Verify visually**

Open `admin.html` in a browser. The header should look identical to before. Clicking the logo should navigate to `parking.html`.

- [ ] **Step 4: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add admin.html
git commit -m "feat: logo click navigates to parking.html in admin view"
```

---

### Task 3: Make logo clickable in `parking.html`

**Files:**
- Modify: `/Users/D069379/My_X/Park_Management/parking.html`

- [ ] **Step 1: Find the logo div in `parking.html`**

Locate this block (around line 15):

```html
<div style="display:flex;align-items:center;gap:0.6rem">
  <img src="logo.png" alt="" style="height:28px;width:auto;filter:invert(1);opacity:0.9" onerror="this.style.display='none'"/>
  <h1 data-i18n="app.name">Park Management</h1>
</div>
```

- [ ] **Step 2: Replace the div with an anchor**

Replace the block above with:

```html
<a href="parking.html" class="logo-link">
  <img src="logo.png" alt="" style="height:28px;width:auto;filter:invert(1);opacity:0.9" onerror="this.style.display='none'"/>
  <h1 data-i18n="app.name">Park Management</h1>
</a>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add parking.html
git commit -m "feat: logo click navigates to parking.html (self-link) in parking view"
```

---

### Task 4: Make logo clickable in `incident.html`

**Files:**
- Modify: `/Users/D069379/My_X/Park_Management/incident.html`

- [ ] **Step 1: Find the logo div in `incident.html`**

Locate this block (around line 110):

```html
<div style="display:flex;align-items:center;gap:0.6rem">
  <img src="logo.png" alt="" style="height:28px;width:auto;filter:invert(1);opacity:0.9" onerror="this.style.display='none'"/>
  <h1 ...>...</h1>
</div>
```

- [ ] **Step 2: Replace the div with an anchor**

Replace the block with:

```html
<a href="parking.html" class="logo-link">
  <img src="logo.png" alt="" style="height:28px;width:auto;filter:invert(1);opacity:0.9" onerror="this.style.display='none'"/>
  <h1 data-i18n="inc.title">Park Management — Report Incident</h1>
</a>
```

- [ ] **Step 3: Commit**

```bash
cd /Users/D069379/My_X/Park_Management
git add incident.html
git commit -m "feat: logo click navigates to parking.html in incident view"
```

---

### Task 5: Final verification

- [ ] **Step 1: Check `index.html` is unchanged**

Open `index.html`. The logo should still be a plain `<img>` with no link wrapping — confirm it is not clickable.

- [ ] **Step 2: Verify all three pages**

Open each page in a browser and confirm:
- Logo click on `admin.html` → lands on `parking.html` ✓
- Logo click on `parking.html` → reloads `parking.html` ✓
- Logo click on `incident.html` → lands on `parking.html` ✓
- Logo on `index.html` → not clickable ✓

- [ ] **Step 3: Push**

```bash
cd /Users/D069379/My_X/Park_Management
git push
```
