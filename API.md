# API Documentation

All API routes are mounted under `/api`.

## Authentication Headers

Protected routes require a valid session token:
- `Authorization: Bearer <Firebase_ID_Token>` — Verified server-side via `firebase-admin` (Google sign-in).
- `Authorization: Bearer <Signed_Session_Token>` — Verified server-side via HMAC-SHA256 (`src/server/session-tokens.ts`) for local email/password accounts.

## Endpoints

### Health & Session
- `GET /api/health` — Public health probe (`{ status: "ok", service: "repo-health", timestamp }`).
- `POST /api/auth/register` & `POST /api/auth/login` — Local email/password registration and authentication using per-user `scrypt` password hashes.
- `GET /api/session/bootstrap` — Bootstraps user/workspace, GitHub token connection state, unread notification count, and AI preferences.

### Dashboard & Analytics
- `GET /api/dashboard` — Returns workspace summary KPIs, repositories, recent scans, open critical/high findings, recent diagnoses, and score history.
- `GET /api/analytics` — Returns severity breakdown, category breakdown, resolution counts, and score history over time.

### GitHub & Repositories
- `POST /api/github/token` — Verifies and stores a workspace GitHub Personal Access Token encrypted with AES-256-GCM.
- `GET /api/github/repos` — Lists repositories accessible via the stored GitHub Personal Access Token.
- `POST /api/github/disconnect` — Removes stored GitHub credentials for the workspace.
- `POST /api/github/import` — Imports a repository by `fullName` (`owner/name`) or GitHub URL and syncs branches.
- `GET /api/repositories` — Lists workspace repositories.
- `GET /api/repositories/:id` — Returns repository metadata, branches, scan history, findings, score history, pull requests, and recent commits.
- `DELETE /api/repositories/:id` — Removes a repository from the workspace.

### Deterministic Scanning
- `GET /api/scans` — Lists scan jobs in the workspace.
- `GET /api/scans/:id` — Returns a single scan job with progress stage and associated findings.
- `POST /api/scans/start` — Enqueues an asynchronous scan job (`repositoryId`, `branch`, `scanType`, optional `enabledAnalyzers`) and returns `202 Accepted`.

### Findings, Dependencies & Architecture
- `GET /api/findings` — Filters findings by `category` and/or `repositoryId`, joined with latest AI diagnosis and proposed fix.
- `PATCH /api/findings/:id/status` — Toggles finding status manually between `open` and `dismissed` (`verified_resolved` requires verification checks).
- `GET /api/dependencies` — Aggregates parsed npm/PyPI dependencies and OSV vulnerabilities from latest completed scans.
- `GET /api/architecture` — Returns module import graph nodes, edges, entry points, and circular dependency chains for a repository.

### AI Settings, Diagnosis, Fix Center & Assistant
- `GET /api/ai/settings` — Returns configured providers (with `hasApiKey` boolean only; secrets never returned), model preferences, and `MODEL_CATALOG`.
- `PUT /api/ai/providers/:key` — Updates provider base URL, default model, enabled state, and encrypted API key.
- `POST /api/ai/providers/:key/test` — Executes a live connectivity test against the selected AI provider/model.
- `PUT /api/ai/preferences` — Updates task-specific provider/model selections and private repository code consent.
- `GET /api/diagnoses` — Lists AI diagnoses in the workspace.
- `POST /api/ai/diagnose` — Generates and persists structured root-cause diagnosis for a finding (`findingId`, optional `provider`, `model`).
- `GET /api/fixes` — Lists proposed fixes joined with findings, repositories, and latest verification runs.
- `POST /api/ai/propose-fix` — Generates a full-file remediation patch and unified diff for a finding.
- `POST /api/fixes/:id/approve` — Records human approval and updates finding status to `approved`.
- `POST /api/fixes/:id/reject` — Marks proposed fix `rejected` and reopens finding.
- `POST /api/fixes/:id/verify` — Executes deterministic re-scan and static checks on `proposedCode`, updating finding to `verified_resolved` if passed.
- `POST /api/fixes/:id/apply-pr` — Creates a branch, commits the approved patch, and opens a GitHub Pull Request (requires stored GitHub token).
- `GET /api/assistant/threads` — Lists persisted repository assistant conversation threads.
- `POST /api/ai/assistant` — Answers developer questions grounded in repository findings, architecture summary, and retrieved source files.

### Reports, Notifications & Team
- `GET /api/reports` & `POST /api/reports/generate` — Lists and generates persisted workspace/repository health & security reports (client supports PDF export via `jsPDF`).
- `GET /api/notifications`, `POST /api/notifications/:id/read`, `POST /api/notifications/read-all` — Manages workspace notifications.
- `GET /api/team`, `POST /api/team/invite`, `PATCH /api/team/:id/role`, `PUT /api/workspace/name` — Manages workspace members, RBAC roles, audit logs, and workspace name.
