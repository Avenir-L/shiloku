# AI chat safeguards

The production chat endpoint requires `DEEPSEEK_API_KEY`,
`KV_REST_API_URL` and `KV_REST_API_TOKEN`. Reuse the project's Redis-compatible
REST store if provisioned; the token must permit EVAL, GET, INCR and EXPIRE.
Never place these values in frontend code.

Limits are five accepted requests per IP per UTC minute and 100 across the
deployment per UTC calendar day. An atomic Redis script checks both counters.
Attempts that reach the provider consume quota even if the provider fails.
IP addresses are hashed before constructing Redis keys. Counters expire.
Development without Redis has an in-process fallback; production fails closed
with HTTP 503 when shared limiting is unavailable.

Messages are limited to 1000 JavaScript string code units; total JSON input
is limited to 8192 bytes. Provider output is capped at 2048 tokens and provider
requests time out after 25 seconds. A distributed attack can still exhaust the
daily allowance; these controls bound paid chat requests, not all hosting costs.
Provider account billing alerts and any hard spending cap must be configured
separately in the provider account. No provider billing settings were changed.

Before publishing, verify the production environment names and Redis permissions
without printing secrets. Test an invalid message first (no provider charge),
then one valid response and quota rejection. Project Node.js setting was inspected
on 2026-10-22 and reported 24.x; this does not attest a specific patch version.

Run `node --test tests/chat-security.test.mjs` for mocked-provider regression checks.
