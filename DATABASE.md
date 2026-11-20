# Database Schema

Repo Health uses PostgreSQL (Cloud SQL) managed with **Drizzle ORM** (`src/db/schema.ts`, `src/db/index.ts`, `src/db/drizzle.config.ts`).

## Connection Configuration

`src/db/index.ts` connects via `pg.Pool` using discrete Cloud SQL parameters (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, port `5432`) without `DATABASE_URL` or eager startup connection probes.

## Tables (19)

| Table | Purpose |
| :--- | :--- |
| `users` | Authenticated Firebase and local email/password user records (`uid`, `email`, `name`, `role`). |
| `workspaces` | Workspace tenants (`name`, `slug`, `owner_id`, `plan`). |
| `workspace_members` | Team roster, invitations, and RBAC roles (`owner`, `admin`, `engineer`, `viewer`). |
| `github_installations` | Workspace GitHub PAT identity and AES-256-GCM `encrypted_token`. |
| `repositories` | Connected repositories (`full_name`, `default_branch`, `language`, `is_private`, `is_demo`, `health_score`, `status`). |
| `repository_branches` | Synced branch metadata and commit SHAs per repository. |
| `scan_configurations` | Saved scan types, include/exclude paths, and enabled deterministic analyzers per repository. |
| `scan_jobs` | Async scan execution state (`status`, `current_stage`, `progress_pct`, severity counts, `score_breakdown_json`, `architecture_json`, `dependencies_json`, `skipped_checks_json`). |
| `findings` | Normalized deterministic findings (`fingerprint`, `category`, `severity`, `confidence`, `scanner_engine`, `rule_id`, `file_path`, `line_start`, `code_excerpt`, `status`). |
| `ai_providers` | Per-workspace provider endpoints, default models, AES-256-GCM `encrypted_api_key`, and connectivity test telemetry. |
| `ai_model_preferences` | Per-task provider/model routing (`diagnosis_*`, `fix_*`, `assistant_*`) and `send_private_code_consent`. |
| `ai_diagnoses` | Structured root-cause diagnosis, impact, remediation guidance, verification criteria, and evidence references. |
| `proposed_fixes` | AI-generated full-file patches, `unified_diff`, rationale, human approval metadata, and Pull Request references (`pr_url`, `pr_number`, `branch_name`). |
| `verification_runs` | Deterministic re-scan and static check results (`checks_json`, `passed`, `original_finding_present`). |
| `health_score_history` | Historical 0–100 overall and category sub-scores recorded after each scan. |
| `notifications` | Workspace alerts for scan completion, critical findings, verification failures, score shifts, and PR creation. |
| `reports` | Persisted JSON summaries (`health`, `security`, `scan_summary`) exportable to PDF. |
| `audit_logs` | Immutable action log (`repository.imported`, `fix.approved`, `team.member_invited`, etc.). |
| `assistant_threads` | Persisted multi-turn Q&A threads scoped to a workspace and repository. |
