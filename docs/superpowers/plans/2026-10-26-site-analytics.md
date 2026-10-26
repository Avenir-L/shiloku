# Site analytics implementation plan

**Goal:** Show real page views, estimated visitors, daily trends and popular sections in the private overview

**Architecture:** A small same-origin collector records allowlisted events into independent `shiloku:analytics:v1:` Redis keys with 90-day retention. Admin-only aggregation reads daily hashes and HyperLogLog visitor estimates. No guestbook or space writes, no raw IPs or full referrer URLs stored

**Tech stack:** Existing Node/Vercel functions, Redis REST, plain browser JS and SVG

- [ ] Write failing collector and admin authorization tests
- [ ] Implement atomic bounded collector and aggregation in `api/_lib/analytics.js`, expose `api/analytics.js`, add authenticated `analytics` admin action
- [ ] Instrument homepage and music-room openings; honor Do Not Track, ignore admin pages
- [ ] Add actual metrics and accessible trend chart to overview; distinguish empty/live/demo data and explain UV estimate
- [ ] Verify locally, run full admin tests and build, review security and deployment configuration
- [ ] Configure missing production-only owner auth secrets without printing values, deploy correct `avenir` project, verify public read-only behavior and unchanged guestbook IDs
