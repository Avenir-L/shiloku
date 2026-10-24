# Guestbook persistence

The previous implementation used a serverless instance's temporary filesystem.
That data was not durable or shared. Failed writes could also return success and
the frontend could silently keep messages only in a visitor's localStorage.

The replacement requires a Redis-compatible REST database connected to the
Vercel `shiloku` project, production environment. Accepted server-only variables:

- `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Use Vercel Marketplace's Upstash integration to connect the database. The token
needs GET, INCR, EXPIRE, EVAL, ZADD and ZREVRANGE permissions. Do not put tokens in
the browser or commit them. Existing storage integration inspection/provisioning
was denied by the current connector; no database has been created.

`shiloku:guestbook:v1` stores each message as a separate sorted-set member with a
UUID. Appending and per-IP rate limiting are atomic. Messages have no expiry and
are not trimmed; the public API currently reads the most recent 80. Configure
provider backups and export retained messages as needed. Redis persistence and
service retention must be enabled by the selected provider/plan.

Missing or unavailable storage returns 503. There is no temporary-file write or
fake success fallback. A rejected submission leaves the browser draft untouched.
Cached reads are disabled. The old localStorage data is left intact for recovery
but is not mixed into the public feed or automatically published.

Validation: `node --test tests/guestbook-persistence.test.mjs` mocks the shared
store to check cross-instance reads, concurrent submissions, missing configuration
and outages. This is not a live Redis integration test. After connecting the
database, test Lua execution and read-after-write from separate instances before
publishing; use an explicitly identified test message and remove it afterward.

An old message that existed only in a recycled instance's temporary filesystem
cannot be recovered from this code change. A visitor's original browser might
still contain locally saved messages; never publish those without their consent.
