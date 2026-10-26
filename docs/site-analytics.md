# Website measurements

The public collector `/api/analytics` accepts only same-origin POST events for `home` and `music`. The homepage script sends an initial view and a new music event when the music room opens. Administration and unavailable future space pages are excluded. Recognizable bots and clients enabling Do Not Track or Global Privacy Control are skipped; ad blockers, JavaScript failures and browser storage restrictions can reduce counts. These are browser-reported measurements, not billing or bandwidth statistics

An anonymous random browser ID expires after 30 days. The server stores only an HMAC of it, daily approximate visitor sketches, daily aggregated counts, and short-lived hashed deduplication/rate keys. No raw IP address, full referrer URL, cookies or Google identity enters analytics. Visitor estimates can count a person more than once across devices/storage resets. Period UV uses a union of daily HyperLogLog sketches, not a sum of daily UV

Data uses only `shiloku:analytics:v1:` keys and expires after 90 days. Existing guestbook (`shiloku:guestbook:v1`) and future space records are untouched. Dates use Asia/Shanghai. Nothing backfills historical visits. Statistics are readable only via authenticated `POST /api/admin?action=analytics` with a range of 1, 7 or 30 days

Production needs `ANALYTICS_SECRET` (random server-only secret). Keep it stable to preserve visitor deduplication across deployments. `ADMIN_ENCRYPTION_KEY` is accepted as a fallback, but use a separate analytics secret. Normal data collection runs independently of the page and cannot block rendering or music playback

Owner login uses server-only `ADMIN_GOOGLE_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ORIGIN` and the existing private Redis store. Only a Google-verified email matching the configured owner can bind initially; later logins match the pinned immutable Google subject. No public first-visitor enrollment exists

The local `scripts/admin-preview.mjs` is loopback-only and uses synthetic data explicitly labeled in the UI; its `/admin/preview` entrance is not a production route
