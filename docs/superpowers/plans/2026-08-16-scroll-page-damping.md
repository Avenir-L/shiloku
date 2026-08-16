# Scroll Page Damping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a wheel gesture move the homepage one page at a time with a damped transition, and increase the vertical rhythm of the second page.

**Architecture:** `index.html` keeps the two existing `.scroll-page` elements and adds a small wheel-navigation controller. The controller derives the active target from the section offsets, locks input during animation, and calls `window.scrollTo` with the same easing duration used by the CSS layout. CSS supplies the extra time-page spacing.

**Tech Stack:** Static HTML, CSS, browser JavaScript, Node assertion test.

---

### Task 1: Define the expected page-turn contract

**Files:**

- Modify: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/tests/scroll-layout.test.mjs`
- Test: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/tests/scroll-layout.test.mjs`

- [ ] **Step 1: Add failing structural assertions**

```js
assert.match(html, /function initWheelPageNavigation\(\)/, 'wheel page navigation is missing');
assert.match(html, /passive: false/, 'wheel handler must be able to prevent native free scrolling');
assert.match(html, /WHEEL_PAGE_DURATION = 700/, 'damped page duration is missing');
assert.match(html, /scrollTo\(\{ top: targetTop, behavior: 'smooth' \}\)/, 'wheel navigation does not use smooth page movement');
assert.match(html, /#time-page-content \.mid-area \{[\s\S]*gap: clamp\(28px, 5vh, 56px\)/, 'second-page vertical spacing is not enlarged');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node .\\tests\\scroll-layout.test.mjs`

Expected: failure mentioning missing wheel page navigation.

### Task 2: Add damped wheel page navigation

**Files:**

- Modify: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/index.html`
- Test: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/tests/scroll-layout.test.mjs`

- [ ] **Step 1: Add the controller beside `initScrollPageTransitions`**

```js
const WHEEL_PAGE_DURATION = 700;

function initWheelPageNavigation() {
    const pages = [...document.querySelectorAll('.scroll-page')];
    let isTurningPage = false;
    window.addEventListener('wheel', (event) => {
        if (isTurningPage || Math.abs(event.deltaY) < 8) return;
        const currentIndex = pages.reduce((closestIndex, page, index) =>
            Math.abs(page.offsetTop - window.scrollY) < Math.abs(pages[closestIndex].offsetTop - window.scrollY) ? index : closestIndex, 0);
        const nextIndex = Math.max(0, Math.min(pages.length - 1, currentIndex + Math.sign(event.deltaY)));
        if (nextIndex === currentIndex) return;
        event.preventDefault();
        isTurningPage = true;
        const targetTop = pages[nextIndex].offsetTop;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
        window.setTimeout(() => { isTurningPage = false; }, WHEEL_PAGE_DURATION);
    }, { passive: false });
}
```

- [ ] **Step 2: Initialize it during DOMContentLoaded**

```js
window.addEventListener('DOMContentLoaded', () => {
    initCharacterHoverCopy();
    initScrollPageTransitions();
    initWheelPageNavigation();
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `node .\\tests\\scroll-layout.test.mjs`

Expected: `scroll layout structure is present`.

### Task 3: Increase second-page vertical spacing and verify the browser

**Files:**

- Modify: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/index.html`
- Test: `C:/Users/LunaFolia/Desktop/personal/shiloku-scroll-preview-20260816/tests/scroll-layout.test.mjs`

- [ ] **Step 1: Increase the centered content gap**

```css
#time-page-content .mid-area {
    gap: clamp(28px, 5vh, 56px);
}
```

- [ ] **Step 2: Run the structural test**

Run: `node .\\tests\\scroll-layout.test.mjs`

Expected: `scroll layout structure is present`.

- [ ] **Step 3: Reload `http://127.0.0.1:4173/index.html` and inspect**

Expected: one wheel direction advances one page, a second immediate wheel gesture is ignored during the 700 ms transition, the second page has visibly larger vertical gaps, and the browser console has no errors.
