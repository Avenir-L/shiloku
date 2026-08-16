# Cursor and Layout Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove decorative cursor artifacts, lower the second-page footer, keep the profile heading compact when hovered character by character, and give the first-page action buttons more breathing room.

**Architecture:** The existing single-file page keeps its current behavior but disables the custom cursor initialization and hides its markup. Focused CSS overrides move the page-two footer lower and make the profile title a shrink-to-fit inline flex row. Existing Node structural tests protect the additions.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Node assertion test.

---

### Task 1: Define regression checks

**Files:**

- Modify: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/tests/scroll-layout.test.mjs`
- Test: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/tests/scroll-layout.test.mjs`

- [ ] **Step 1: Add failing assertions**

```js
assert.match(html, /\.cursor-ring \{ display: none !important; \}/, 'custom cursor ring is still visible');
assert.match(html, /#profile-page-content \.bio-title\.hover-copy \{[\s\S]*display: inline-flex;/, 'profile heading is not compact');
assert.match(html, /#page-two-footer \{[\s\S]*padding-bottom: clamp\(28px, 5vh, 64px\);/, 'second-page footer is not lowered');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node .\\tests\\scroll-layout.test.mjs`

Expected: failure mentioning the custom cursor ring.

### Task 2: Apply focused cursor and layout fixes

**Files:**

- Modify: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/index.html`
- Test: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/tests/scroll-layout.test.mjs`

- [ ] **Step 1: Add the cursor and compact-heading CSS**

```css
.cursor-ring { display: none !important; }
#profile-page-content .bio-title.hover-copy {
    display: inline-flex;
    width: fit-content;
    justify-content: center;
    text-align: center;
}
```

- [ ] **Step 2: Lower the page-two footer**

```css
#page-two-footer {
    position: relative;
    top: clamp(8px, 1.5vh, 16px);
}

#profile-page-content .bio-actions { gap: clamp(20px, 3vw, 36px); }
```

- [ ] **Step 3: Disable the particle producer**

```js
const trails = [];
// Do not push TrailParticle instances from mousemove.
```

- [ ] **Step 4: Run the structural test**

Run: `node .\\tests\\scroll-layout.test.mjs`

Expected: `scroll layout structure is present`.

### Task 3: Verify the local preview

**Files:**

- Test: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/index.html`

- [ ] **Step 1: Reload the local preview and inspect both pages**

Expected: the system cursor is used without a ring or trail, `个人简介` is compact and centered, the second-page footer is lower, and the browser console has no errors.
