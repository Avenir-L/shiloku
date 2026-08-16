import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(html, /class="page-scroll-shell"/, 'page scroll shell is missing');
assert.match(html, /class="scroll-page intro-page"/, 'first scroll page is missing');
assert.match(html, /class="scroll-page time-page"/, 'second scroll page is missing');
assert.match(html, /id="profile-page-content"/, 'profile content is not isolated on page one');
assert.match(html, /id="time-page-content"/, 'time content is not isolated on page two');
assert.match(html, /id="page-two-footer"/, 'contact and external links are not grouped at the bottom of page two');
assert.match(html, /class="[^"]*profile-listen-stats/, 'listening stats are not on page one');
assert.match(html, /class="[^"]*hover-copy/, 'profile and time copy does not have hover treatment');
assert.match(html, /class="avatar-wrap avatar-centered"/, 'avatar is not independently centered');
assert.match(html, /#time-page-content \.daily-quote-wrap \{\s*width: 100%;/, 'daily quote does not reserve the full centered time column');
assert.match(html, /\.subtitle\.hover-copy \{\s*display: block;/, 'subtitle is not forced onto its own line');
assert.match(html, /\.hover-char:hover/, 'single-character hover style is missing');
assert.match(html, /function initCharacterHoverCopy\(\)/, 'character hover initialization is missing');
assert.match(html, /IntersectionObserver/, 'scroll-page transition observer is missing');
assert.match(html, /function initWheelPageNavigation\(\)/, 'wheel page navigation is missing');
assert.match(html, /passive: false/, 'wheel handler must be able to prevent native free scrolling');
assert.match(html, /WHEEL_PAGE_DURATION = 700/, 'damped page duration is missing');
assert.match(html, /scrollTo\(\{ top: targetTop, behavior: 'smooth' \}\)/, 'wheel navigation does not use smooth page movement');
assert.match(html, /#time-page-content \.mid-area \{[\s\S]*gap: clamp\(28px, 5vh, 56px\)/, 'second-page vertical spacing is not enlarged');
assert.match(html, /\.cursor-ring \{ display: none !important; \}/, 'custom cursor ring is still visible');
assert.match(html, /#profile-page-content \.bio-title\.hover-copy \{[\s\S]*display: inline-flex;/, 'profile heading is not compact');
assert.match(html, /#page-two-footer \{[\s\S]*top: clamp\(8px, 1\.5vh, 16px\);/, 'second-page footer is not lowered');
assert.match(html, /#profile-page-content \.bio-actions \{ gap: clamp\(20px, 3vw, 36px\); \}/, 'profile action buttons are still too close');
assert.doesNotMatch(html, /ctx\.shadowBlur = this\.glow;/, 'background particles still create blurred white halos');
assert.match(html, /#particle-canvas \{ display: none !important; \}/, 'particle canvas can still overlay the heading');

const pageOne = html.indexOf('id="profile-page-content"');
const pageTwo = html.indexOf('id="time-page-content"');
const stats = html.indexOf('id="listen-stats-wrap"');
assert.ok(stats > pageOne && stats < pageTwo, 'listening stats must be on the first page');

for (const id of ['corner-tools', 'ai-float-button', 'footer-notice', 'guestbook-panel']) {
  assert.match(html, new RegExp(`id="${id}"|class="footer-notice"`), `${id} is missing`);
}

console.log('scroll layout structure is present');
