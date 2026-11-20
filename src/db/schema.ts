import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  name: text('name').notNull().default('Developer'),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('owner'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workspaces = pgTable('workspaces', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: integer('owner_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  plan: text('plan').notNull().default('pro'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const workspaceMembers = pgTable('workspace_members', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('engineer'), // owner | admin | engineer | viewer
  status: text('status').notNull().default('active'), // active | invited
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

export const githubInstallations = pgTable('github_installations', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  githubUserId: text('github_user_id').notNull(),
  githubUsername: text('github_username').notNull(),
  avatarUrl: text('avatar_url'),
  encryptedToken: text('encrypted_token').notNull(),
  scopes: text('scopes').notNull().default('repo,read:user'),
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
});

export const repositories = pgTable('repositories', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  githubRepoId: text('github_repo_id'),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  description: text('description').default(''),
  defaultBranch: text('default_branch').notNull().default('main'),
  language: text('language').notNull().default('TypeScript'),
  languagesJson: jsonb('languages_json').$type<Record<string, number>>().default({}),
  isPrivate: boolean('is_private').notNull().default(false),
  htmlUrl: text('html_url').notNull().default(''),
  isDemo: boolean('is_demo').notNull().default(false),
  lastScanAt: timestamp('last_scan_at'),
  healthScore: integer('health_score'),
  status: text('status').notNull().default('unscanned'), // healthy | needs_attention | critical | unscanned
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const repositoryBranches = pgTable('repository_branches', {
  id: serial('id').primaryKey(),
  repositoryId: integer('repository_id')
    .references(() => repositories.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  commitSha: text('commit_sha').notNull().default('HEAD'),
  isDefault: boolean('is_default').notNull().default(false),
  lastSyncedAt: timestamp('last_synced_at').defaultNow().notNull(),
});

export const scanConfigurations = pgTable('scan_configurations', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  repositoryId: integer('repository_id')
    .references(() => repositories.id, { onDelete: 'cascade' })
    .notNull(),
  scanType: text('scan_type').notNull().default('full'),
  includePaths: jsonb('include_paths').$type<string[]>().default([]),
  excludePaths: jsonb('exclude_paths').$type<string[]>().default(['node_modules', 'dist', '.git']),
  enabledAnalyzers: jsonb('enabled_analyzers')
    .$type<string[]>()
    .default(['secret-scanner', 'static-ast', 'osv-audit', 'complexity-analyzer', 'architecture-analyzer']),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const scanJobs = pgTable('scan_jobs', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  repositoryId: integer('repository_id')
    .references(() => repositories.id, { onDelete: 'cascade' })
    .notNull(),
  branch: text('branch').notNull().default('main'),
  commitSha: text('commit_sha').notNull().default('HEAD'),
  scanType: text('scan_type').notNull().default('full'),
  status: text('status').notNull().default('queued'), // queued | running | completed | failed
  currentStage: text('current_stage').notNull().default('Queued'),
  progressPct: integer('progress_pct').notNull().default(0),
  filesAnalyzed: integer('files_analyzed').notNull().default(0),
  totalFiles: integer('total_files').notNull().default(0),
  findingsCount: integer('findings_count').notNull().default(0),
  criticalCount: integer('critical_count').notNull().default(0),
  highCount: integer('high_count').notNull().default(0),
  mediumCount: integer('medium_count').notNull().default(0),
  lowCount: integer('low_count').notNull().default(0),
  infoCount: integer('info_count').notNull().default(0),
  healthScore: integer('health_score'),
  scoreBreakdownJson: jsonb('score_breakdown_json').$type<Record<string, unknown>>(),
  architectureJson: jsonb('architecture_json').$type<Record<string, unknown>>(),
  dependenciesJson: jsonb('dependencies_json').$type<Array<Record<string, unknown>>>(),
  skippedChecksJson: jsonb('skipped_checks_json').$type<string[]>().default([]),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const findings = pgTable('findings', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  repositoryId: integer('repository_id')
    .references(() => repositories.id, { onDelete: 'cascade' })
    .notNull(),
  scanJobId: integer('scan_job_id')
    .references(() => scanJobs.id, { onDelete: 'cascade' })
    .notNull(),
  fingerprint: text('fingerprint').notNull(),
  category: text('category').notNull(), // security | quality | dependency | architecture | performance
  severity: text('severity').notNull(), // critical | high | medium | low | info
  confidence: text('confidence').notNull().default('confirmed'), // confirmed | potential
  scannerEngine: text('scanner_engine').notNull(),
  ruleId: text('rule_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  whyItMatters: text('why_it_matters').notNull(),
  filePath: text('file_path').notNull(),
  lineStart: integer('line_start').notNull().default(1),
  lineEnd: integer('line_end').notNull().default(1),
  codeExcerpt: text('code_excerpt').notNull().default(''),
  status: text('status').notNull().default('open'), // open | diagnosed | patch_proposed | approved | verified_resolved | dismissed
  metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiProviders = pgTable('ai_providers', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  providerKey: text('provider_key').notNull(), // gemini | gemma | deepseek | openai_compatible
  displayName: text('display_name').notNull(),
  baseUrl: text('base_url').notNull().default(''),
  encryptedApiKey: text('encrypted_api_key'),
  defaultModel: text('default_model').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(true),
  lastTestStatus: text('last_test_status').default('untested'), // untested | ok | error
  lastTestMessage: text('last_test_message').default(''),
  lastTestedAt: timestamp('last_tested_at'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiModelPreferences = pgTable('ai_model_preferences', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  diagnosisProvider: text('diagnosis_provider').notNull().default('gemini'),
  diagnosisModel: text('diagnosis_model').notNull().default('gemini-4-hydrogen'),
  fixProvider: text('fix_provider').notNull().default('gemini'),
  fixModel: text('fix_model').notNull().default('gemini-4-hydrogen'),
  assistantProvider: text('assistant_provider').notNull().default('gemini'),
  assistantModel: text('assistant_model').notNull().default('gemini-4-hydrogen'),
  sendPrivateCodeConsent: boolean('send_private_code_consent').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const aiDiagnoses = pgTable('ai_diagnoses', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  findingId: integer('finding_id')
    .references(() => findings.id, { onDelete: 'cascade' })
    .notNull(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  rootCause: text('root_cause').notNull(),
  explanation: text('explanation').notNull(),
  whyItMatters: text('why_it_matters').notNull(),
  recommendedSolution: text('recommended_solution').notNull(),
  verificationRequirements: text('verification_requirements').notNull(),
  evidenceRefsJson: jsonb('evidence_refs_json').$type<string[]>().default([]),
  confidenceNote: text('confidence_note').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const proposedFixes = pgTable('proposed_fixes', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  findingId: integer('finding_id')
    .references(() => findings.id, { onDelete: 'cascade' })
    .notNull(),
  repositoryId: integer('repository_id')
    .references(() => repositories.id, { onDelete: 'cascade' })
    .notNull(),
  diagnosisId: integer('diagnosis_id').references(() => aiDiagnoses.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  filePath: text('file_path').notNull(),
  originalCode: text('original_code').notNull(),
  proposedCode: text('proposed_code').notNull(),
  unifiedDiff: text('unified_diff').notNull(),
  rationale: text('rationale').notNull(),
  status: text('status').notNull().default('proposed'), // proposed | approved | rejected | applied | verified | verification_failed
  prUrl: text('pr_url'),
  prNumber: integer('pr_number'),
  branchName: text('branch_name'),
  approvedByUid: text('approved_by_uid'),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const verificationRuns = pgTable('verification_runs', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  proposedFixId: integer('proposed_fix_id')
    .references(() => proposedFixes.id, { onDelete: 'cascade' })
    .notNull(),
  findingId: integer('finding_id')
    .references(() => findings.id, { onDelete: 'cascade' })
    .notNull(),
  checksJson: jsonb('checks_json')
    .$type<Array<{ name: string; status: 'passed' | 'failed' | 'skipped'; details: string }>>()
    .default([]),
  passed: boolean('passed').notNull().default(false),
  originalFindingPresent: boolean('original_finding_present').notNull().default(true),
  summary: text('summary').notNull(),
  executedAt: timestamp('executed_at').defaultNow().notNull(),
});

export const healthScoreHistory = pgTable('health_score_history', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  repositoryId: integer('repository_id')
    .references(() => repositories.id, { onDelete: 'cascade' })
    .notNull(),
  scanJobId: integer('scan_job_id')
    .references(() => scanJobs.id, { onDelete: 'cascade' })
    .notNull(),
  overallScore: integer('overall_score').notNull(),
  securityScore: integer('security_score').notNull(),
  qualityScore: integer('quality_score').notNull(),
  dependencyScore: integer('dependency_score').notNull(),
  maintainabilityScore: integer('maintainability_score').notNull(),
  testingDocsScore: integer('testing_docs_score').notNull(),
  configScore: integer('config_score').notNull(),
  deltaFromPrevious: integer('delta_from_previous').notNull().default(0),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
});

export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(), // scan_complete | critical_finding | verification_failed | score_change | pr_update
  title: text('title').notNull(),
  message: text('message').notNull(),
  linkPath: text('link_path').notNull().default('/app/dashboard'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  repositoryId: integer('repository_id').references(() => repositories.id, { onDelete: 'set null' }),
  scanJobId: integer('scan_job_id').references(() => scanJobs.id, { onDelete: 'set null' }),
  reportType: text('report_type').notNull(), // health | security | scan_summary
  title: text('title').notNull(),
  summaryJson: jsonb('summary_json').$type<Record<string, unknown>>().default({}),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid').notNull(),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  detailsJson: jsonb('details_json').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const assistantThreads = pgTable('assistant_threads', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  repositoryId: integer('repository_id').references(() => repositories.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  messagesJson: jsonb('messages_json')
    .$type<Array<{ role: 'user' | 'assistant'; content: string; model?: string; evidenceFiles?: string[]; timestamp: string }>>()
    .default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  workspaces: many(workspaces),
  memberships: many(workspaceMembers),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
  members: many(workspaceMembers),
  repositories: many(repositories),
  scanJobs: many(scanJobs),
  findings: many(findings),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [repositories.workspaceId], references: [workspaces.id] }),
  branches: many(repositoryBranches),
  scanJobs: many(scanJobs),
  findings: many(findings),
  scoreHistory: many(healthScoreHistory),
}));

export const scanJobsRelations = relations(scanJobs, ({ one, many }) => ({
  repository: one(repositories, { fields: [scanJobs.repositoryId], references: [repositories.id] }),
  findings: many(findings),
}));

export const findingsRelations = relations(findings, ({ one, many }) => ({
  repository: one(repositories, { fields: [findings.repositoryId], references: [repositories.id] }),
  scanJob: one(scanJobs, { fields: [findings.scanJobId], references: [scanJobs.id] }),
  diagnoses: many(aiDiagnoses),
  proposedFixes: many(proposedFixes),
}));
