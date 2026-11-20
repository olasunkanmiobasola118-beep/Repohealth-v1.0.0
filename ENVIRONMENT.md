# Environment Configuration

Refer to `.env.example` for the template of runtime variables. Never commit real secrets to source control.

## Runtime Variables

| Variable | Required | Description |
| :--- | :--- | :--- |
| `PORT` | No (default `3000`) | HTTP port for the Express + Vite server. |
| `APP_URL` | Yes | Public origin URL of the running application. |
| `GEMINI_API_KEY` | Yes (for Gemini/Gemma) | Server-side API key used for `@google/genai` calls. Never exposed to the browser. |
| `SQL_HOST` | Yes (PostgreSQL) | PostgreSQL host address used by `src/db/index.ts`. |
| `SQL_USER` | Yes (PostgreSQL) | PostgreSQL application role username. |
| `SQL_PASSWORD` | Yes (PostgreSQL) | PostgreSQL application role password. |
| `SQL_DB_NAME` | Yes (PostgreSQL) | PostgreSQL database name. |
| `ENCRYPTION_SECRET` | Recommended | 32+ byte secret used by AES-256-GCM credential encryption and HMAC session token signing. |
| `DEEPSEEK_API_KEY` | Optional | Optional server-side fallback key for DeepSeek models when not configured per-workspace in UI. |
