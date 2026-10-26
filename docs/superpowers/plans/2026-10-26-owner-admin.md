# Owner Admin Implementation Plan

Goal: Implement a private Passkey admin panel and durable music account maintenance without changing guestbook data.

Architecture: Separate auth/storage/music modules and same-origin admin API; independent admin and music Redis namespaces. Existing public account-management routes stay forbidden. Space publishing remains separate future scope.

Tech: Node.js, SimpleWebAuthn, Redis REST, AES-256-GCM, plain HTML/CSS/modules.

- [x] Regression tests for authorization, bootstrap ownership, challenge replay, encrypted persistence, guestbook isolation.
- [x] Implement isolated storage, owner authentication, recovery and local bootstrap tooling.
- [x] Implement authenticated music QR create/check, status, encrypted save and runtime reads.
- [x] Build responsive admin interface with separate routes/navigation and bundle local browser dependencies.
- [x] Verify 23 related tests, browser login through software authenticator fixtures with real signature verification, unauthorized requests and unchanged live guestbook IDs. Native iPhone/Windows Hello confirmation remains owner-operated.
- [x] Prepare local result and owner enrollment instructions; no production deployment or configuration changes. Independent security review completed; revocation race and recovery-at-limit findings fixed and regression-tested.
