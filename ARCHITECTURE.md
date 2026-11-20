# System Architecture

Repo Health separates deterministic analysis from AI-assisted reasoning and enforces strict human-in-the-loop verification gates before code changes are accepted.

## High-Level Components

1. **Frontend SPA (`src/`)**:
   - React 19 + TypeScript + Tailwind CSS v4 + React Router DOM v7.
   - **Public Marketing & Docs (`/`, `/features`, `/security`, `/documentation`, `/pricing`, `/login`, `/register`)**: Editorial light-first landing experience with interactive scanner previews and dedicated documentation/authentication pages.
   - **Authenticated Workspace (`/app/*`)**: Workspace routes protected by `AuthContext` supporting Firebase Google Sign-In (`Authorization: Bearer <idToken>`) and local email/password session authentication (`Authorization: Bearer <sessionToken>`), plus an admin-only Firestore telemetry console (`/app/admin/metrics`).

2. **Backend API & Orchestrator (`server.ts`, `src/server/`)**:
   - Express server running on port `3000` with Vite middleware in development and static `dist/` serving in production.
   - Sliding-window IP rate limiter (`240 req/min` on `/api/*`).
   - Background scan runner (`src/server/scan-runner.ts`) updating `scan_jobs` progress stages asynchronously.

3. **Deterministic Scanning & Scoring Engine (`src/lib/`)**:
   - `src/lib/scanner/engine.ts`: Evaluates repository files using pattern rules, cyclomatic complexity estimation, duplicate block hashing, dependency manifest parsing (`package.json`, `requirements.txt`), live OSV.dev advisory queries (`src/server/osv.ts`), and DFS circular import detection.
   - `src/lib/scoring.ts`: Computes the 0–100 health score and category sub-scores deterministically without LLM involvement.
   - `src/lib/diff.ts`: Generates standard unified diffs via `diff` (`createTwoFilesPatch`).

4. **Multi-Model AI Adapter (`src/server/ai/providers.ts`)**:
   - **Google Gemini & Gemma**: Uses the `@google/genai` SDK server-side with `GEMINI_API_KEY` and structured `responseSchema` JSON outputs for Gemini.
   - **DeepSeek & OpenAI-Compatible**: Uses `/chat/completions` over HTTPS with per-workspace AES-256-GCM encrypted API keys stored in `ai_providers`.
   - **Prompt Isolation**: Repository code is redacted via `redactSecrets()` and wrapped inside `<untrusted_repository_code>` tags with explicit system-instruction guards.

5. **Verification & GitHub Remediation (`src/server/routes.ts`, `src/server/github.ts`)**:
   - `POST /api/fixes/:id/verify`: Re-runs `runDeterministicScan()` on `proposedCode`, validates JSON/brace structural integrity, verifies the original rule no longer triggers and no new critical/high issues were introduced, and records a `verification_runs` row.
   - `POST /api/fixes/:id/apply-pr`: Requires prior human approval (`approved` or `verified` status) and a stored GitHub Personal Access Token before creating a branch, committing the patch, and opening a Pull Request.
