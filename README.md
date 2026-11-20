# Repo Health

**Repo Health** is a repository intelligence, deterministic code scanning, and verifiable AI remediation platform designed and engineered by **Olasunkanmi Obasola**.

Built with React, TypeScript, Express, Drizzle ORM, PostgreSQL, Firebase Authentication, and Cloud Firestore.

## Key Capabilities

- **Deterministic Repository Scanning**: Runs independently of AI models to detect hardcoded secrets (with automatic redaction), OWASP/static security patterns (SQL injection, XSS sinks, command injection, unsafe TLS, weak cryptography), module complexity & code duplication, dependency vulnerabilities via live OSV.dev lookups, and module import architecture cycles.
- **Transparent Health Scoring (0–100)**: Calculates an explainable weighted repository health score across Security (`30%`), Code Quality (`20%`), Dependencies (`20%`), Architecture & Maintainability (`15%`), Testing & Documentation (`10%`), and Configuration Hygiene (`5%`).
- **Multi-Model AI Doctor & Fix Center**: Supports Google Gemini (`gemini-4-hydrogen`, `gemini-4-argon`, `gemini-4-carbon`), Google Gemma (`gemma-3-27b-it`, `gemma-3-12b-it`), DeepSeek (`deepseek-chat`, `deepseek-reasoner`), and custom OpenAI-compatible endpoints (vLLM, OpenRouter, LiteLLM, Together). Assign distinct providers per workflow (Diagnosis, Fix Generation, Repository Assistant).
- **Verifiable Remediation Workflow**: AI-generated patches render as unified or side-by-side diffs, require explicit human approval before Pull Request creation, and execute deterministic re-scans + syntax/security regression checks before marking findings `verified_resolved`.
- **GitHub Integration**: Import public repositories directly by `owner/name` or URL, or configure a GitHub Personal Access Token (encrypted with AES-256-GCM at rest) to browse private repositories and open Pull Requests from verified patches.
- **Real-Time Admin Metrics**: Secure admin-only telemetry view powered by Cloud Firestore (`userMetrics` and `dailyActivity`) with real-time registration counts, daily/weekly/monthly active user trends, and CSV export.

## Quick Start

1. Configure environment variables (see `ENVIRONMENT.md`).
2. Install dependencies: `npm install`
3. Start development server on port 3000: `npm run dev`
4. Run unit tests: `npx --yes tsx --test src/lib/scoring.test.ts src/lib/admin-metrics.test.ts src/server/session-tokens.test.ts firestore.rules.test.ts`
5. Type-check & build: `npm run lint && npm run build`

## Documentation Index

- `ARCHITECTURE.md` — System architecture, scanning pipeline, scoring engine, and AI provider abstraction.
- `API.md` — Express REST API reference and authentication headers.
- `DATABASE.md` — PostgreSQL schema (19 tables), relations, and Drizzle ORM configuration.
- `SECURITY.md` — Secret redaction, AES-256-GCM encryption, prompt-injection isolation, and verification gates.
- `ENVIRONMENT.md` — Required and optional runtime environment variables.
- `DEVELOPMENT.md` — Local setup, testing, linting, and production build workflow.

## Author & Credits

Created, architected, and engineered by **Olasunkanmi Obasola**.
