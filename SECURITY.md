# Security Architecture & Safeguards

Repo Health applies defense-in-depth across credential storage, static scanning, AI prompting, and patch application.

## 1. Encryption at Rest for Stored Credentials
- `src/server/crypto.ts` encrypts all user-supplied BYOK AI provider API keys and GitHub OAuth access tokens using **AES-256-GCM** (`scryptSync` key derivation from `ENCRYPTION_SECRET`, random 12-byte IV, 16-byte authentication tag).
- Encrypted secrets are never returned in API responses (`GET /api/ai/settings` exposes only a `hasApiKey` boolean; `GET /api/session/bootstrap` exposes only GitHub username/scopes).

## 2. Automatic Secret Redaction
- During deterministic scanning (`src/lib/scanner/engine.ts`), matched credentials (AWS Access Keys, GitHub PATs, PEM headers, credential literals) are masked via `redactLineSecrets()` before persisting `code_excerpt` rows in PostgreSQL.
- Before sending source code to any AI model (`src/server/ai/providers.ts`), `redactSecrets()` strips recognized secret tokens so raw credentials are not leaked to external LLM providers.

## 3. Prompt-Injection Isolation
- Repository source files are treated as untrusted input and wrapped in `<untrusted_repository_code path="...">...</untrusted_repository_code>` delimiters with explicit `SYSTEM_SECURITY_GUARD` instructions preventing code comments or strings from altering assistant or diagnosis behavior.
- Workspaces can disable transmission of private repository code to external AI providers via `sendPrivateCodeConsent` in AI Model Settings (`403 Forbidden` enforced server-side).

## 4. Human-in-the-Loop & Verification Gates
- **No Auto-Merge / No Silent Commits**: Proposed AI patches require an explicit `POST /api/fixes/:id/approve` action before `POST /api/fixes/:id/apply-pr` can create a GitHub branch or Pull Request.
- **No Unverified Resolution**: `PATCH /api/findings/:id/status` blocks manually setting `verified_resolved`. Findings only transition to `verified_resolved` after `POST /api/fixes/:id/verify` confirms the original rule no longer triggers and structural/regression checks pass.

## 5. Multi-Tenant & Auth Isolation
- All API routes enforce workspace scoping (`workspaceId` derived from verified Firebase ID tokens or signed HMAC-SHA256 session tokens).
- Local passwords use per-user `scrypt` salts stored in PostgreSQL; Firestore security rules enforce strict `email_verified == true` and admin-only list/read access on `userMetrics` and `dailyActivity`.
- `/api/*` endpoints enforce a sliding-window IP rate limit (`240` requests per minute).
