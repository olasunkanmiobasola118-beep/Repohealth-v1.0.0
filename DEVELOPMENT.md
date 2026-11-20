# Development Guide

## Project Structure

```text
server.ts                 # Express + Vite middleware entrypoint (port 3000)
src/
  db/
    index.ts              # pg.Pool + Drizzle instance
    schema.ts             # 19 PostgreSQL tables & relations
    drizzle.config.ts     # Drizzle Kit schema configuration
  lib/
    firebase.ts           # Client Firebase Auth & Firestore initialization
    firebase-admin.ts     # Server Firebase Admin SDK token verification
    admin-metrics.ts      # Pure Firestore telemetry aggregation & validation helpers
    scoring.ts            # Deterministic 0-100 weighted health score engine
    diff.ts               # Unified diff builder
    scanner/engine.ts     # Deterministic static, secret, complexity, dependency & architecture scanner
  server/
    auth.ts               # Firebase & local session authentication middleware
    session-tokens.ts     # HMAC-SHA256 session tokens & scrypt password hashing
    crypto.ts             # AES-256-GCM encryption + secret redaction
    github.ts             # GitHub REST API integration
    osv.ts                # Live OSV.dev vulnerability batch lookup
    scan-runner.ts        # Async scan job orchestrator
    routes.ts             # Express API handlers
    ai/providers.ts       # Multi-model AI adapter (Gemini, Gemma, DeepSeek, OpenAI-compatible)
  components/             # Shared UI & landing components
  context/                # AuthContext & ThemeContext
  pages/
    public/               # Landing, marketing, docs, pricing & auth pages
    app/                  # Authenticated workspace & admin telemetry pages
```

## Scripts

- `npm run dev` — Starts `tsx server.ts` on `http://0.0.0.0:3000`.
- `npm run lint` — Runs TypeScript type-checking (`tsc --noEmit`).
- `npm run build` — Compiles the Vite production client bundle into `dist/`.
- `npm run start` — Runs the production Express server (`node server.ts`).

## Testing

Unit tests use Node's built-in `node:test` runner via `tsx`:

```bash
npx --yes tsx --test src/lib/scoring.test.ts src/lib/admin-metrics.test.ts src/server/session-tokens.test.ts firestore.rules.test.ts
```
