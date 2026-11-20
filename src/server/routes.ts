import { Router } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  aiDiagnoses,
  aiModelPreferences,
  aiProviders,
  assistantThreads,
  auditLogs,
  findings,
  githubInstallations,
  healthScoreHistory,
  notifications,
  proposedFixes,
  reports,
  repositories,
  repositoryBranches,
  scanConfigurations,
  scanJobs,
  verificationRuns,
  workspaceMembers,
  workspaces,
} from '../db/schema.ts';
import { buildUnifiedDiff } from '../lib/diff.ts';
import { runDeterministicScan, type ScanType } from '../lib/scanner/engine.ts';
import {
  generateStructuredDiagnosis,
  generateStructuredFix,
  MODEL_CATALOG,
  runRepositoryAssistantTurn,
  testAiProviderConnection,
} from './ai/providers.ts';
import {
  AuthRequestError,
  authenticateLocalAccount,
  registerLocalAccount,
  requireAuth,
  type AuthenticatedRequest,
} from './auth.ts';
import { decryptSecret, encryptSecret } from './crypto.ts';
import {
  createGitHubPullRequestForPatch,
  fetchGitHubBranches,
  fetchGitHubCommits,
  fetchGitHubFileContent,
  fetchGitHubPullRequests,
  fetchGitHubRepoMetadata,
  fetchGitHubUser,
  listUserGitHubRepos,
} from './github.ts';
import { executeScanJob } from './scan-runner.ts';

function parsePositiveInt(val: unknown): number | null {
  const num = Number(val);
  return Number.isInteger(num) && num > 0 ? num : null;
}

async function resolveFileContentForRepo(
  workspaceId: number,
  repo: typeof repositories.$inferSelect,
  branch: string,
  filePath: string
): Promise<string> {
  const [gh] = await db
    .select()
    .from(githubInstallations)
    .where(eq(githubInstallations.workspaceId, workspaceId));
  const token = decryptSecret(gh?.encryptedToken);
  const loaded = await fetchGitHubFileContent(repo.fullName, branch, filePath, token || undefined);
  return loaded.content;
}

export function createApiRouter(): Router {
  const router = Router();

  // Simple sliding-window rate limiter per IP
  const hits = new Map<string, { count: number; resetAt: number }>();
  router.use((req, res, next) => {
    const key = req.ip || 'global';
    const now = Date.now();
    const bucket = hits.get(key);
    if (!bucket || bucket.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + 60_000 });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > 240) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait briefly.' });
    }
    next();
  });

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'repo-health', timestamp: new Date().toISOString() });
  });

  // Public Authentication Routes (Email/Password)
  router.post('/auth/register', async (req, res) => {
    try {
      const name = String(req.body?.name || '');
      const email = String(req.body?.email || '');
      const password = String(req.body?.password || '');
      const { token, authCtx } = await registerLocalAccount({ name, email, password });
      res.status(201).json({
        token,
        user: {
          uid: authCtx.uid,
          email: authCtx.email,
          name: authCtx.name,
          role: authCtx.role,
        },
        workspace: {
          id: authCtx.workspaceId,
          name: authCtx.workspaceName,
        },
      });
    } catch (error) {
      if (error instanceof AuthRequestError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Register error:', error);
      res.status(500).json({ error: 'Unable to create account right now. Please try again.' });
    }
  });

  router.post('/auth/login', async (req, res) => {
    try {
      const email = String(req.body?.email || '');
      const password = String(req.body?.password || '');
      const { token, authCtx } = await authenticateLocalAccount({ email, password });
      res.json({
        token,
        user: {
          uid: authCtx.uid,
          email: authCtx.email,
          name: authCtx.name,
          role: authCtx.role,
        },
        workspace: {
          id: authCtx.workspaceId,
          name: authCtx.workspaceName,
        },
      });
    } catch (error) {
      if (error instanceof AuthRequestError) {
        return res.status(error.status).json({ error: error.message });
      }
      console.error('Login error:', error);
      res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
    }
  });

  // Auth / Workspace Bootstrap
  router.get('/session/bootstrap', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const ctx = req.authCtx!;
      const [gh] = await db
        .select({
          id: githubInstallations.id,
          githubUsername: githubInstallations.githubUsername,
          avatarUrl: githubInstallations.avatarUrl,
          scopes: githubInstallations.scopes,
          connectedAt: githubInstallations.connectedAt,
        })
        .from(githubInstallations)
        .where(eq(githubInstallations.workspaceId, ctx.workspaceId));

      const unreadNotifs = await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.workspaceId, ctx.workspaceId), eq(notifications.isRead, false)));

      const [prefs] = await db
        .select()
        .from(aiModelPreferences)
        .where(eq(aiModelPreferences.workspaceId, ctx.workspaceId));

      res.json({
        user: {
          uid: ctx.uid,
          email: ctx.email,
          name: ctx.name,
          role: ctx.role,
        },
        workspace: {
          id: ctx.workspaceId,
          name: ctx.workspaceName,
        },
        github: gh ? { connected: true, ...gh } : { connected: false },
        unreadNotifications: unreadNotifs.length,
        aiPreferences: prefs || null,
      });
    } catch (error) {
      console.error('Bootstrap error:', error);
      res.status(500).json({ error: 'Failed to load workspace session.' });
    }
  });

  // Dashboard summary
  router.get('/dashboard', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const [repos, scans, allFindings, diagnoses, scoreHistory] = await Promise.all([
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)).orderBy(desc(repositories.lastScanAt)),
        db.select().from(scanJobs).where(eq(scanJobs.workspaceId, wsId)).orderBy(desc(scanJobs.createdAt)).limit(8),
        db.select().from(findings).where(eq(findings.workspaceId, wsId)).orderBy(desc(findings.createdAt)),
        db.select().from(aiDiagnoses).where(eq(aiDiagnoses.workspaceId, wsId)).orderBy(desc(aiDiagnoses.createdAt)).limit(5),
        db.select().from(healthScoreHistory).where(eq(healthScoreHistory.workspaceId, wsId)).orderBy(desc(healthScoreHistory.recordedAt)).limit(16),
      ]);

      const openFindings = allFindings.filter(
        (f) => f.status !== 'verified_resolved' && f.status !== 'dismissed'
      );
      const criticalFindings = openFindings.filter((f) => f.severity === 'critical' || f.severity === 'high').slice(0, 8);
      const scannedRepos = repos.filter((r) => r.healthScore !== null);
      const avgHealthScore =
        scannedRepos.length > 0
          ? Math.round(scannedRepos.reduce((acc, r) => acc + (r.healthScore || 0), 0) / scannedRepos.length)
          : null;

      res.json({
        summary: {
          connectedRepos: repos.length,
          avgHealthScore,
          openIssuesCount: openFindings.length,
          criticalCount: openFindings.filter((f) => f.severity === 'critical').length,
          highCount: openFindings.filter((f) => f.severity === 'high').length,
          resolvedCount: allFindings.filter((f) => f.status === 'verified_resolved').length,
          totalScans: scans.length,
        },
        repositories: repos,
        recentScans: scans,
        criticalFindings,
        recentDiagnoses: diagnoses,
        scoreHistory: [...scoreHistory].reverse(),
      });
    } catch (error) {
      console.error('Dashboard load error:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard data.' });
    }
  });

  // GitHub Access Token & Repository Import
  router.post('/github/token', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const token = String(req.body?.token || '').trim();
      if (!token) {
        return res.status(400).json({ error: 'Please paste a valid GitHub Personal Access Token.' });
      }
      const ghUser = await fetchGitHubUser(token);
      const encrypted = encryptSecret(token);

      await db
        .delete(githubInstallations)
        .where(eq(githubInstallations.workspaceId, req.authCtx!.workspaceId));

      await db.insert(githubInstallations).values({
        workspaceId: req.authCtx!.workspaceId,
        userId: req.authCtx!.userId,
        githubUserId: String(ghUser.id),
        githubUsername: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        encryptedToken: encrypted,
        scopes: 'pat',
      });

      res.json({ ok: true, username: ghUser.login });
    } catch (error) {
      console.error('GitHub token save error:', error);
      res.status(400).json({
        error: error instanceof Error ? error.message : 'Unable to verify that GitHub token.',
      });
    }
  });

  router.get('/github/repos', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const [gh] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.workspaceId, req.authCtx!.workspaceId));
      if (!gh) {
        return res.json({ connected: false, repos: [] });
      }
      const token = decryptSecret(gh.encryptedToken);
      const repos = await listUserGitHubRepos(token);
      res.json({ connected: true, username: gh.githubUsername, repos });
    } catch (error) {
      console.error('GitHub repos error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to list GitHub repositories.' });
    }
  });

  router.post('/github/disconnect', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await db
        .delete(githubInstallations)
        .where(eq(githubInstallations.workspaceId, req.authCtx!.workspaceId));
      res.json({ ok: true });
    } catch (error) {
      console.error('GitHub disconnect error:', error);
      res.status(500).json({ error: 'Failed to disconnect GitHub integration.' });
    }
  });

  router.post('/github/import', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const rawInput = String(req.body.fullName || req.body.repoUrl || '').trim();
      const cleaned = rawInput
        .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
        .replace(/\.git$/i, '')
        .replace(/^\/+|\/+$/g, '');

      if (!/^[A-Za-z0-9_.\-]+\/[A-Za-z0-9_.\-]+$/.test(cleaned)) {
        return res.status(400).json({ error: 'Enter a valid GitHub repository as owner/name or GitHub URL.' });
      }

      const wsId = req.authCtx!.workspaceId;
      const existing = await db
        .select()
        .from(repositories)
        .where(and(eq(repositories.workspaceId, wsId), eq(repositories.fullName, cleaned)));
      if (existing.length > 0) {
        return res.json({ repository: existing[0], alreadyConnected: true });
      }

      const [gh] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.workspaceId, wsId));
      const token = decryptSecret(gh?.encryptedToken);

      const meta = await fetchGitHubRepoMetadata(cleaned, token || undefined);
      const branches = await fetchGitHubBranches(cleaned, token || undefined);

      const [repo] = await db
        .insert(repositories)
        .values({
          workspaceId: wsId,
          githubRepoId: meta.id,
          owner: meta.owner,
          name: meta.name,
          fullName: meta.fullName,
          description: meta.description,
          defaultBranch: meta.defaultBranch,
          language: meta.language,
          isPrivate: meta.isPrivate,
          htmlUrl: meta.htmlUrl,
          isDemo: false,
          status: 'unscanned',
        })
        .returning();

      if (branches.length > 0) {
        await db.insert(repositoryBranches).values(
          branches.slice(0, 15).map((b) => ({
            repositoryId: repo.id,
            name: b.name,
            commitSha: b.commitSha.slice(0, 12),
            isDefault: b.name === meta.defaultBranch,
          }))
        );
      } else {
        await db.insert(repositoryBranches).values({
          repositoryId: repo.id,
          name: meta.defaultBranch,
          commitSha: 'HEAD',
          isDefault: true,
        });
      }

      await db.insert(auditLogs).values({
        workspaceId: wsId,
        userUid: req.authCtx!.uid,
        action: 'repository.imported',
        resourceType: 'repository',
        resourceId: String(repo.id),
        detailsJson: { fullName: repo.fullName },
      });

      res.status(201).json({ repository: repo });
    } catch (error) {
      console.error('Import repo error:', error);
      res.status(400).json({ error: error instanceof Error ? error.message : 'Unable to import repository.' });
    }
  });

  // Repositories CRUD & Metadata
  router.get('/repositories', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const repos = await db
        .select()
        .from(repositories)
        .where(eq(repositories.workspaceId, req.authCtx!.workspaceId))
        .orderBy(desc(repositories.createdAt));
      res.json({ repositories: repos });
    } catch (error) {
      console.error('List repositories error:', error);
      res.status(500).json({ error: 'Failed to load repositories.' });
    }
  });

  router.get('/repositories/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const repoId = parsePositiveInt(req.params.id);
      if (!repoId) return res.status(400).json({ error: 'Invalid repository ID.' });
      const wsId = req.authCtx!.workspaceId;
      const [repo] = await db
        .select()
        .from(repositories)
        .where(and(eq(repositories.id, repoId), eq(repositories.workspaceId, wsId)));
      if (!repo) return res.status(404).json({ error: 'Repository not found.' });

      const [branches, scans, repoFindings, history, config] = await Promise.all([
        db.select().from(repositoryBranches).where(eq(repositoryBranches.repositoryId, repoId)),
        db.select().from(scanJobs).where(eq(scanJobs.repositoryId, repoId)).orderBy(desc(scanJobs.createdAt)).limit(10),
        db.select().from(findings).where(eq(findings.repositoryId, repoId)).orderBy(desc(findings.createdAt)),
        db.select().from(healthScoreHistory).where(eq(healthScoreHistory.repositoryId, repoId)).orderBy(desc(healthScoreHistory.recordedAt)).limit(12),
        db.select().from(scanConfigurations).where(eq(scanConfigurations.repositoryId, repoId)),
      ]);

      const [gh] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.workspaceId, wsId));
      const token = decryptSecret(gh?.encryptedToken);
      const [pullRequests, commits] = await Promise.all([
        fetchGitHubPullRequests(repo.fullName, token || undefined),
        fetchGitHubCommits(repo.fullName, repo.defaultBranch, token || undefined),
      ]);

      res.json({
        repository: repo,
        branches,
        scans,
        findings: repoFindings,
        scoreHistory: [...history].reverse(),
        configuration: config[0] || null,
        pullRequests,
        commits,
      });
    } catch (error) {
      console.error('Repo detail error:', error);
      res.status(500).json({ error: 'Failed to load repository details.' });
    }
  });

  router.delete('/repositories/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const repoId = parsePositiveInt(req.params.id);
      if (!repoId) return res.status(400).json({ error: 'Invalid repository ID.' });
      await db
        .delete(repositories)
        .where(and(eq(repositories.id, repoId), eq(repositories.workspaceId, req.authCtx!.workspaceId)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete repository error:', error);
      res.status(500).json({ error: 'Failed to remove repository.' });
    }
  });

  // Scanning Endpoints
  router.get('/scans', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const [scans, repos] = await Promise.all([
        db.select().from(scanJobs).where(eq(scanJobs.workspaceId, wsId)).orderBy(desc(scanJobs.createdAt)).limit(50),
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)),
      ]);
      const repoMap = new Map(repos.map((r) => [r.id, r]));
      res.json({
        scans: scans.map((s) => ({
          ...s,
          repositoryName: repoMap.get(s.repositoryId)?.fullName || `Repo #${s.repositoryId}`,
        })),
      });
    } catch (error) {
      console.error('List scans error:', error);
      res.status(500).json({ error: 'Failed to load scan history.' });
    }
  });

  router.get('/scans/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const scanId = parsePositiveInt(req.params.id);
      if (!scanId) return res.status(400).json({ error: 'Invalid scan job ID.' });
      const [scan] = await db
        .select()
        .from(scanJobs)
        .where(and(eq(scanJobs.id, scanId), eq(scanJobs.workspaceId, req.authCtx!.workspaceId)));
      if (!scan) return res.status(404).json({ error: 'Scan job not found.' });
      const scanFindings = await db.select().from(findings).where(eq(findings.scanJobId, scanId));
      res.json({ scan, findings: scanFindings });
    } catch (error) {
      console.error('Get scan error:', error);
      res.status(500).json({ error: 'Failed to load scan job.' });
    }
  });

  router.post('/scans/start', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const repositoryId = parsePositiveInt(req.body.repositoryId);
      if (!repositoryId) return res.status(400).json({ error: 'Select a valid repository to scan.' });
      const branch = String(req.body.branch || 'main');
      const scanType = (String(req.body.scanType || 'full') as ScanType);
      const enabledAnalyzers = Array.isArray(req.body.enabledAnalyzers)
        ? req.body.enabledAnalyzers.map(String)
        : undefined;

      const [repo] = await db
        .select()
        .from(repositories)
        .where(and(eq(repositories.id, repositoryId), eq(repositories.workspaceId, wsId)));
      if (!repo) return res.status(404).json({ error: 'Repository not found.' });

      const [job] = await db
        .insert(scanJobs)
        .values({
          workspaceId: wsId,
          repositoryId,
          branch,
          scanType,
          status: 'queued',
          currentStage: 'Queued for background execution',
          progressPct: 5,
        })
        .returning();

      // Persist scan configuration preference
      const existingCfg = await db
        .select()
        .from(scanConfigurations)
        .where(eq(scanConfigurations.repositoryId, repositoryId));
      if (existingCfg.length > 0) {
        await db
          .update(scanConfigurations)
          .set({
            scanType,
            enabledAnalyzers: enabledAnalyzers || existingCfg[0].enabledAnalyzers,
            updatedAt: new Date(),
          })
          .where(eq(scanConfigurations.id, existingCfg[0].id));
      } else {
        await db.insert(scanConfigurations).values({
          workspaceId: wsId,
          repositoryId,
          scanType,
          enabledAnalyzers: enabledAnalyzers || [
            'secret-scanner',
            'static-ast',
            'osv-audit',
            'complexity-analyzer',
            'architecture-analyzer',
          ],
        });
      }

      // Launch background scan job asynchronously without blocking HTTP response
      setImmediate(() => {
        executeScanJob({
          workspaceId: wsId,
          repositoryId,
          branch,
          scanType,
          enabledAnalyzers,
          existingJobId: job.id,
          userUid: req.authCtx!.uid,
        }).catch((err) => {
          console.error('Background scan failure:', err);
        });
      });

      res.status(202).json({ scanJob: job });
    } catch (error) {
      console.error('Start scan error:', error);
      res.status(500).json({ error: 'Failed to initiate scan job.' });
    }
  });

  // Findings & Category Views
  router.get('/findings', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const category = req.query.category ? String(req.query.category) : null;
      const repositoryId = req.query.repositoryId ? parsePositiveInt(req.query.repositoryId) : null;

      const [allFindings, repos, allDiagnoses, allFixes] = await Promise.all([
        db.select().from(findings).where(eq(findings.workspaceId, wsId)).orderBy(desc(findings.createdAt)),
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)),
        db.select().from(aiDiagnoses).where(eq(aiDiagnoses.workspaceId, wsId)).orderBy(desc(aiDiagnoses.createdAt)),
        db.select().from(proposedFixes).where(eq(proposedFixes.workspaceId, wsId)).orderBy(desc(proposedFixes.createdAt)),
      ]);

      const repoMap = new Map(repos.map((r) => [r.id, r]));
      const diagByFinding = new Map<number, typeof aiDiagnoses.$inferSelect>();
      for (const d of allDiagnoses) {
        if (!diagByFinding.has(d.findingId)) diagByFinding.set(d.findingId, d);
      }
      const fixByFinding = new Map<number, typeof proposedFixes.$inferSelect>();
      for (const fx of allFixes) {
        if (!fixByFinding.has(fx.findingId)) fixByFinding.set(fx.findingId, fx);
      }

      const filtered = allFindings.filter((f) => {
        if (category && f.category !== category) return false;
        if (repositoryId && f.repositoryId !== repositoryId) return false;
        return true;
      });

      res.json({
        findings: filtered.map((f) => ({
          ...f,
          repositoryName: repoMap.get(f.repositoryId)?.fullName || `Repo #${f.repositoryId}`,
          diagnosis: diagByFinding.get(f.id) || null,
          proposedFix: fixByFinding.get(f.id) || null,
        })),
      });
    } catch (error) {
      console.error('List findings error:', error);
      res.status(500).json({ error: 'Failed to load findings.' });
    }
  });

  router.patch('/findings/:id/status', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const findingId = parsePositiveInt(req.params.id);
      if (!findingId) return res.status(400).json({ error: 'Invalid finding ID.' });
      const status = String(req.body.status || '');
      const allowed = ['open', 'dismissed'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Only open or dismissed can be toggled manually. Verified resolution requires verification checks.' });
      }
      const [updated] = await db
        .update(findings)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(findings.id, findingId), eq(findings.workspaceId, req.authCtx!.workspaceId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Finding not found.' });
      res.json({ finding: updated });
    } catch (error) {
      console.error('Update finding status error:', error);
      res.status(500).json({ error: 'Failed to update finding status.' });
    }
  });

  // Dependencies & Architecture views (from latest completed scans)
  router.get('/dependencies', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const repos = await db.select().from(repositories).where(eq(repositories.workspaceId, wsId));
      const scans = await db
        .select()
        .from(scanJobs)
        .where(and(eq(scanJobs.workspaceId, wsId), eq(scanJobs.status, 'completed')))
        .orderBy(desc(scanJobs.completedAt));

      const latestByRepo = new Map<number, typeof scanJobs.$inferSelect>();
      for (const s of scans) {
        if (!latestByRepo.has(s.repositoryId) && s.dependenciesJson) {
          latestByRepo.set(s.repositoryId, s);
        }
      }

      const inventory: Array<Record<string, unknown>> = [];
      for (const r of repos) {
        const scan = latestByRepo.get(r.id);
        if (scan?.dependenciesJson) {
          for (const dep of scan.dependenciesJson) {
            inventory.push({
              ...dep,
              repositoryId: r.id,
              repositoryName: r.fullName,
              scanId: scan.id,
            });
          }
        }
      }
      res.json({ dependencies: inventory, repositories: repos });
    } catch (error) {
      console.error('Dependencies load error:', error);
      res.status(500).json({ error: 'Failed to load dependencies.' });
    }
  });

  router.get('/architecture', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const repoIdParam = req.query.repositoryId ? parsePositiveInt(req.query.repositoryId) : null;
      const repos = await db.select().from(repositories).where(eq(repositories.workspaceId, wsId));
      const targetRepo = repoIdParam ? repos.find((r) => r.id === repoIdParam) : repos[0];
      if (!targetRepo) {
        return res.json({ repositories: [], selectedRepo: null, architecture: null });
      }
      const [latestScan] = await db
        .select()
        .from(scanJobs)
        .where(and(eq(scanJobs.repositoryId, targetRepo.id), eq(scanJobs.status, 'completed')))
        .orderBy(desc(scanJobs.completedAt))
        .limit(1);

      res.json({
        repositories: repos,
        selectedRepo: targetRepo,
        architecture: latestScan?.architectureJson || null,
      });
    } catch (error) {
      console.error('Architecture load error:', error);
      res.status(500).json({ error: 'Failed to load architecture graph.' });
    }
  });

  // AI Providers & Model Settings
  router.get('/ai/settings', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const [providers, [prefs]] = await Promise.all([
        db.select().from(aiProviders).where(eq(aiProviders.workspaceId, wsId)).orderBy(asc(aiProviders.id)),
        db.select().from(aiModelPreferences).where(eq(aiModelPreferences.workspaceId, wsId)),
      ]);

      // NEVER return encryptedApiKey to the client! Only return boolean hasApiKey
      const sanitizedProviders = providers.map((p) => ({
        id: p.id,
        providerKey: p.providerKey,
        displayName: p.displayName,
        baseUrl: p.baseUrl,
        defaultModel: p.defaultModel,
        isEnabled: p.isEnabled,
        hasApiKey:
          p.providerKey === 'gemini'
            ? Boolean(process.env.GEMINI_API_KEY) || Boolean(p.encryptedApiKey)
            : Boolean(p.encryptedApiKey) || (p.providerKey === 'deepseek' && Boolean(process.env.DEEPSEEK_API_KEY)),
        lastTestStatus: p.lastTestStatus,
        lastTestMessage: p.lastTestMessage,
        lastTestedAt: p.lastTestedAt,
      }));

      res.json({
        providers: sanitizedProviders,
        preferences: prefs,
        catalog: MODEL_CATALOG,
      });
    } catch (error) {
      console.error('Load AI settings error:', error);
      res.status(500).json({ error: 'Failed to load AI model settings.' });
    }
  });

  router.put('/ai/providers/:key', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const providerKey = String(req.params.key);
      const { baseUrl, defaultModel, apiKey, isEnabled } = req.body as {
        baseUrl?: string;
        defaultModel?: string;
        apiKey?: string;
        isEnabled?: boolean;
      };

      const [existing] = await db
        .select()
        .from(aiProviders)
        .where(and(eq(aiProviders.workspaceId, wsId), eq(aiProviders.providerKey, providerKey)));
      if (!existing) return res.status(404).json({ error: 'Provider not found.' });

      const updateFields: Partial<typeof aiProviders.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (typeof baseUrl === 'string') updateFields.baseUrl = baseUrl.trim();
      if (typeof defaultModel === 'string' && defaultModel.trim()) updateFields.defaultModel = defaultModel.trim();
      if (typeof isEnabled === 'boolean') updateFields.isEnabled = isEnabled;
      if (typeof apiKey === 'string' && apiKey.trim() && providerKey !== 'gemini') {
        updateFields.encryptedApiKey = encryptSecret(apiKey.trim());
      }

      await db.update(aiProviders).set(updateFields).where(eq(aiProviders.id, existing.id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Update AI provider error:', error);
      res.status(500).json({ error: 'Failed to update AI provider configuration.' });
    }
  });

  router.post('/ai/providers/:key/test', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const providerKey = String(req.params.key);
      const model = req.body.model ? String(req.body.model) : undefined;
      const result = await testAiProviderConnection({ workspaceId: wsId, providerKey, model });

      await db
        .update(aiProviders)
        .set({
          lastTestStatus: result.ok ? 'ok' : 'error',
          lastTestMessage: result.message,
          lastTestedAt: new Date(),
        })
        .where(and(eq(aiProviders.workspaceId, wsId), eq(aiProviders.providerKey, providerKey)));

      res.json(result);
    } catch (error) {
      console.error('Test AI provider error:', error);
      res.status(500).json({ error: 'Failed to test AI provider connection.' });
    }
  });

  router.put('/ai/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const {
        diagnosisProvider,
        diagnosisModel,
        fixProvider,
        fixModel,
        assistantProvider,
        assistantModel,
        sendPrivateCodeConsent,
      } = req.body;

      const [updated] = await db
        .update(aiModelPreferences)
        .set({
          ...(diagnosisProvider ? { diagnosisProvider } : {}),
          ...(diagnosisModel ? { diagnosisModel } : {}),
          ...(fixProvider ? { fixProvider } : {}),
          ...(fixModel ? { fixModel } : {}),
          ...(assistantProvider ? { assistantProvider } : {}),
          ...(assistantModel ? { assistantModel } : {}),
          ...(typeof sendPrivateCodeConsent === 'boolean' ? { sendPrivateCodeConsent } : {}),
          updatedAt: new Date(),
        })
        .where(eq(aiModelPreferences.workspaceId, wsId))
        .returning();

      res.json({ preferences: updated });
    } catch (error) {
      console.error('Update AI preferences error:', error);
      res.status(500).json({ error: 'Failed to save AI model preferences.' });
    }
  });

  // AI Doctor Diagnosis
  router.get('/diagnoses', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const [diags, allFindings, repos] = await Promise.all([
        db.select().from(aiDiagnoses).where(eq(aiDiagnoses.workspaceId, wsId)).orderBy(desc(aiDiagnoses.createdAt)),
        db.select().from(findings).where(eq(findings.workspaceId, wsId)),
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)),
      ]);
      const findingMap = new Map(allFindings.map((f) => [f.id, f]));
      const repoMap = new Map(repos.map((r) => [r.id, r]));
      res.json({
        diagnoses: diags.map((d) => {
          const finding = findingMap.get(d.findingId);
          const repo = finding ? repoMap.get(finding.repositoryId) : undefined;
          return {
            ...d,
            finding: finding || null,
            repositoryName: repo?.fullName || '',
          };
        }),
      });
    } catch (error) {
      console.error('Load diagnoses error:', error);
      res.status(500).json({ error: 'Failed to load AI diagnoses.' });
    }
  });

  router.post('/ai/diagnose', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const findingId = parsePositiveInt(req.body.findingId);
      if (!findingId) return res.status(400).json({ error: 'Invalid finding ID.' });
      const [finding] = await db
        .select()
        .from(findings)
        .where(and(eq(findings.id, findingId), eq(findings.workspaceId, wsId)));
      if (!finding) return res.status(404).json({ error: 'Finding not found.' });

      const [repo] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, finding.repositoryId));
      if (!repo) return res.status(404).json({ error: 'Repository not found.' });

      const [prefs] = await db
        .select()
        .from(aiModelPreferences)
        .where(eq(aiModelPreferences.workspaceId, wsId));

      if (repo.isPrivate && prefs && !prefs.sendPrivateCodeConsent) {
        return res.status(403).json({
          error: 'Private repository AI transmission consent is disabled in AI Model Settings.',
        });
      }

      const providerKey = String(req.body.provider || prefs?.diagnosisProvider || 'gemini');
      const model = String(req.body.model || prefs?.diagnosisModel || 'gemini-4-hydrogen');

      let fileContent = finding.codeExcerpt;
      try {
        fileContent = await resolveFileContentForRepo(wsId, repo, repo.defaultBranch, finding.filePath);
      } catch {
        // Fallback to code excerpt if file is virtual (e.g., repository-level finding)
      }

      const diagnosis = await generateStructuredDiagnosis({
        workspaceId: wsId,
        providerKey,
        model,
        finding,
        fileContent,
      });

      const [saved] = await db
        .insert(aiDiagnoses)
        .values({
          workspaceId: wsId,
          findingId: finding.id,
          provider: providerKey,
          model,
          rootCause: diagnosis.rootCause,
          explanation: diagnosis.explanation,
          whyItMatters: diagnosis.whyItMatters,
          recommendedSolution: diagnosis.recommendedSolution,
          verificationRequirements: diagnosis.verificationRequirements,
          evidenceRefsJson: diagnosis.evidenceRefs || [],
          confidenceNote: diagnosis.confidenceNote || '',
        })
        .returning();

      if (finding.status === 'open') {
        await db
          .update(findings)
          .set({ status: 'diagnosed', updatedAt: new Date() })
          .where(eq(findings.id, finding.id));
      }

      res.status(201).json({ diagnosis: saved });
    } catch (error) {
      console.error('AI diagnose error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'AI diagnosis failed.' });
    }
  });

  // AI Fix Center
  router.get('/fixes', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const [fixes, allFindings, repos, verifications] = await Promise.all([
        db.select().from(proposedFixes).where(eq(proposedFixes.workspaceId, wsId)).orderBy(desc(proposedFixes.createdAt)),
        db.select().from(findings).where(eq(findings.workspaceId, wsId)),
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)),
        db.select().from(verificationRuns).where(eq(verificationRuns.workspaceId, wsId)).orderBy(desc(verificationRuns.executedAt)),
      ]);

      const findingMap = new Map(allFindings.map((f) => [f.id, f]));
      const repoMap = new Map(repos.map((r) => [r.id, r]));
      const verByFix = new Map<number, typeof verificationRuns.$inferSelect>();
      for (const v of verifications) {
        if (!verByFix.has(v.proposedFixId)) verByFix.set(v.proposedFixId, v);
      }

      res.json({
        fixes: fixes.map((fx) => ({
          ...fx,
          finding: findingMap.get(fx.findingId) || null,
          repository: repoMap.get(fx.repositoryId) || null,
          latestVerification: verByFix.get(fx.id) || null,
        })),
      });
    } catch (error) {
      console.error('Load fixes error:', error);
      res.status(500).json({ error: 'Failed to load proposed fixes.' });
    }
  });

  router.post('/ai/propose-fix', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const findingId = parsePositiveInt(req.body.findingId);
      if (!findingId) return res.status(400).json({ error: 'Invalid finding ID.' });
      const [finding] = await db
        .select()
        .from(findings)
        .where(and(eq(findings.id, findingId), eq(findings.workspaceId, wsId)));
      if (!finding) return res.status(404).json({ error: 'Finding not found.' });

      const [repo] = await db.select().from(repositories).where(eq(repositories.id, finding.repositoryId));
      if (!repo) return res.status(404).json({ error: 'Repository not found.' });

      const [prefs] = await db
        .select()
        .from(aiModelPreferences)
        .where(eq(aiModelPreferences.workspaceId, wsId));

      if (repo.isPrivate && prefs && !prefs.sendPrivateCodeConsent) {
        return res.status(403).json({
          error: 'Private repository AI transmission consent is disabled in AI Model Settings.',
        });
      }

      const providerKey = String(req.body.provider || prefs?.fixProvider || 'gemini');
      const model = String(req.body.model || prefs?.fixModel || 'gemini-4-hydrogen');

      if (finding.ruleId === 'ARCH-NO-TESTS') {
        return res.status(400).json({
          error:
            'Repository-level structural findings (missing test suite) require adding new *.test.* files rather than patching a single file.',
        });
      }

      let originalCode: string;
      try {
        originalCode = await resolveFileContentForRepo(wsId, repo, repo.defaultBranch, finding.filePath);
      } catch (fetchErr) {
        return res.status(400).json({
          error:
            fetchErr instanceof Error
              ? `Cannot load ${finding.filePath} from GitHub to build a patch: ${fetchErr.message}`
              : `Cannot load ${finding.filePath} from GitHub.`,
        });
      }

      const fixResult = await generateStructuredFix({
        workspaceId: wsId,
        providerKey,
        model,
        finding,
        fileContent: originalCode,
      });

      const unifiedDiff = buildUnifiedDiff(finding.filePath, originalCode, fixResult.proposedCode);

      const [existingDiag] = await db
        .select()
        .from(aiDiagnoses)
        .where(eq(aiDiagnoses.findingId, finding.id))
        .orderBy(desc(aiDiagnoses.createdAt))
        .limit(1);

      const [savedFix] = await db
        .insert(proposedFixes)
        .values({
          workspaceId: wsId,
          findingId: finding.id,
          repositoryId: repo.id,
          diagnosisId: existingDiag?.id || null,
          provider: providerKey,
          model,
          filePath: finding.filePath,
          originalCode,
          proposedCode: fixResult.proposedCode,
          unifiedDiff,
          rationale: fixResult.rationale,
          status: 'proposed',
        })
        .returning();

      await db
        .update(findings)
        .set({ status: 'patch_proposed', updatedAt: new Date() })
        .where(eq(findings.id, finding.id));

      res.status(201).json({ fix: savedFix });
    } catch (error) {
      console.error('Propose fix error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate proposed fix.' });
    }
  });

  router.post('/fixes/:id/approve', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const fixId = parsePositiveInt(req.params.id);
      if (!fixId) return res.status(400).json({ error: 'Invalid fix ID.' });
      const [fix] = await db
        .select()
        .from(proposedFixes)
        .where(and(eq(proposedFixes.id, fixId), eq(proposedFixes.workspaceId, wsId)));
      if (!fix) return res.status(404).json({ error: 'Proposed fix not found.' });

      const [updated] = await db
        .update(proposedFixes)
        .set({
          status: 'approved',
          approvedByUid: req.authCtx!.uid,
          approvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(proposedFixes.id, fixId))
        .returning();

      await db
        .update(findings)
        .set({ status: 'approved', updatedAt: new Date() })
        .where(eq(findings.id, fix.findingId));

      await db.insert(auditLogs).values({
        workspaceId: wsId,
        userUid: req.authCtx!.uid,
        action: 'fix.approved',
        resourceType: 'proposed_fix',
        resourceId: String(fixId),
        detailsJson: { filePath: fix.filePath },
      });

      res.json({ fix: updated });
    } catch (error) {
      console.error('Approve fix error:', error);
      res.status(500).json({ error: 'Failed to approve proposed fix.' });
    }
  });

  router.post('/fixes/:id/reject', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const fixId = parsePositiveInt(req.params.id);
      if (!fixId) return res.status(400).json({ error: 'Invalid fix ID.' });
      const [updated] = await db
        .update(proposedFixes)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(and(eq(proposedFixes.id, fixId), eq(proposedFixes.workspaceId, wsId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Proposed fix not found.' });

      await db
        .update(findings)
        .set({ status: 'open', updatedAt: new Date() })
        .where(eq(findings.id, updated.findingId));

      res.json({ fix: updated });
    } catch (error) {
      console.error('Reject fix error:', error);
      res.status(500).json({ error: 'Failed to reject proposed fix.' });
    }
  });

  router.post('/fixes/:id/verify', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const fixId = parsePositiveInt(req.params.id);
      if (!fixId) return res.status(400).json({ error: 'Invalid fix ID.' });
      const [fix] = await db
        .select()
        .from(proposedFixes)
        .where(and(eq(proposedFixes.id, fixId), eq(proposedFixes.workspaceId, wsId)));
      if (!fix) return res.status(404).json({ error: 'Fix record not found.' });

      const [finding] = await db.select().from(findings).where(eq(findings.id, fix.findingId));
      if (!finding) return res.status(404).json({ error: 'Associated finding not found.' });

      // 1. Run baseline scan on originalCode & re-scan on proposedCode
      const [baselineScan, rescan] = await Promise.all([
        runDeterministicScan([{ path: fix.filePath, content: fix.originalCode }], { scanType: 'full' }),
        runDeterministicScan([{ path: fix.filePath, content: fix.proposedCode }], { scanType: 'full' }),
      ]);

      const originalRuleStillPresent = rescan.findings.some((f) => f.ruleId === finding.ruleId);

      // 2. Basic syntax / structural integrity check
      let syntaxPassed = true;
      let syntaxDetails = 'Delimiter and structural balance check passed.';
      if (fix.filePath.endsWith('.json')) {
        try {
          JSON.parse(fix.proposedCode);
        } catch (err) {
          syntaxPassed = false;
          syntaxDetails = `Invalid JSON syntax: ${err instanceof Error ? err.message : 'parse error'}`;
        }
      } else {
        const opens = (fix.proposedCode.match(/\{/g) || []).length;
        const closes = (fix.proposedCode.match(/\}/g) || []).length;
        if (opens !== closes) {
          syntaxPassed = false;
          syntaxDetails = `Unbalanced braces detected (${opens} opening vs ${closes} closing).`;
        }
      }

      const baselineCounts = new Map<string, number>();
      for (const bf of baselineScan.findings) {
        if (bf.severity === 'critical' || bf.severity === 'high') {
          baselineCounts.set(bf.ruleId, (baselineCounts.get(bf.ruleId) || 0) + 1);
        }
      }
      const afterCounts = new Map<string, number>();
      for (const af of rescan.findings) {
        if (af.severity === 'critical' || af.severity === 'high') {
          afterCounts.set(af.ruleId, (afterCounts.get(af.ruleId) || 0) + 1);
        }
      }
      const newlyIntroducedRules: string[] = [];
      for (const [ruleId, count] of afterCounts.entries()) {
        if (count > (baselineCounts.get(ruleId) || 0)) {
          newlyIntroducedRules.push(ruleId);
        }
      }

      const checks: Array<{ name: string; status: 'passed' | 'failed' | 'skipped'; details: string }> = [
        {
          name: `Deterministic Re-Scan (${finding.ruleId})`,
          status: originalRuleStillPresent ? 'failed' : 'passed',
          details: originalRuleStillPresent
            ? `Rule ${finding.ruleId} still matches in the proposed file.`
            : `Rule ${finding.ruleId} no longer triggers in ${fix.filePath}.`,
        },
        {
          name: 'Static Structural & Syntax Check',
          status: syntaxPassed ? 'passed' : 'failed',
          details: syntaxDetails,
        },
        {
          name: 'Regression Security Check',
          status: newlyIntroducedRules.length === 0 ? 'passed' : 'failed',
          details:
            newlyIntroducedRules.length === 0
              ? 'Zero newly introduced critical or high security patterns detected in patched file.'
              : `${newlyIntroducedRules.length} new high/critical pattern(s) introduced: ${newlyIntroducedRules.join(', ')}`,
        },
        {
          name: 'Repository Test Suite Execution',
          status: 'skipped',
          details: 'Isolated runtime test runner not attached; static verification executed.',
        },
      ];

      const passed = !originalRuleStillPresent && syntaxPassed && newlyIntroducedRules.length === 0;
      const summary = passed
        ? `Verification passed: ${finding.ruleId} is eliminated and structural checks succeeded.`
        : `Verification failed: ${originalRuleStillPresent ? `${finding.ruleId} still detected` : 'structural or security check failed'}.`;

      const [verification] = await db
        .insert(verificationRuns)
        .values({
          workspaceId: wsId,
          proposedFixId: fix.id,
          findingId: finding.id,
          checksJson: checks,
          passed,
          originalFindingPresent: originalRuleStillPresent,
          summary,
        })
        .returning();

      const nextFixStatus = passed ? 'verified' : 'verification_failed';
      await db
        .update(proposedFixes)
        .set({ status: nextFixStatus, updatedAt: new Date() })
        .where(eq(proposedFixes.id, fix.id));

      if (passed) {
        await db
          .update(findings)
          .set({ status: 'verified_resolved', updatedAt: new Date() })
          .where(eq(findings.id, finding.id));
      } else {
        await db.insert(notifications).values({
          workspaceId: wsId,
          type: 'verification_failed',
          title: `Patch verification failed for ${finding.filePath}`,
          message: summary,
          linkPath: '/app/fix-center',
          isRead: false,
        });
      }

      res.json({ verification, passed, status: nextFixStatus });
    } catch (error) {
      console.error('Verify fix error:', error);
      res.status(500).json({ error: 'Verification run failed.' });
    }
  });

  router.post('/fixes/:id/apply-pr', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const fixId = parsePositiveInt(req.params.id);
      if (!fixId) return res.status(400).json({ error: 'Invalid fix ID.' });
      const [fix] = await db
        .select()
        .from(proposedFixes)
        .where(and(eq(proposedFixes.id, fixId), eq(proposedFixes.workspaceId, wsId)));
      if (!fix) return res.status(404).json({ error: 'Proposed fix not found.' });

      if (fix.status !== 'approved' && fix.status !== 'verified') {
        return res.status(400).json({ error: 'Explicit human approval is required before creating a Pull Request.' });
      }

      const [repo] = await db.select().from(repositories).where(eq(repositories.id, fix.repositoryId));
      if (!repo) return res.status(404).json({ error: 'Repository not found.' });

      const [gh] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.workspaceId, wsId));
      const token = decryptSecret(gh?.encryptedToken);
      if (!token) {
        return res.status(401).json({
          error: 'A GitHub Personal Access Token with repo scope is required to create branches and Pull Requests.',
        });
      }

      const branchName = `repo-health/fix-${fix.findingId}-${Date.now().toString(36)}`;
      const pr = await createGitHubPullRequestForPatch({
        fullName: repo.fullName,
        baseBranch: repo.defaultBranch,
        newBranch: branchName,
        filePath: fix.filePath,
        newContent: fix.proposedCode,
        commitMessage: `fix(${fix.filePath}): remediate finding #${fix.findingId} via Repo Health`,
        prTitle: `Repo Health Fix: ${fix.filePath} (Finding #${fix.findingId})`,
        prBody: `Automated patch approved by developer in Repo Health.\n\n**Rationale:** ${fix.rationale}`,
        token,
      });

      const [updated] = await db
        .update(proposedFixes)
        .set({
          status: 'applied',
          prUrl: pr.prUrl,
          prNumber: pr.prNumber,
          branchName: pr.branchName,
          updatedAt: new Date(),
        })
        .where(eq(proposedFixes.id, fix.id))
        .returning();

      await db.insert(notifications).values({
        workspaceId: wsId,
        type: 'pr_update',
        title: `Pull Request #${pr.prNumber} opened on ${repo.fullName}`,
        message: `Approved fix for ${fix.filePath} pushed to ${pr.branchName}.`,
        linkPath: '/app/fix-center',
        isRead: false,
      });

      res.json({ fix: updated, pr });
    } catch (error) {
      console.error('Apply PR error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to open Pull Request.' });
    }
  });

  // Repository-Aware AI Assistant
  router.get('/assistant/threads', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const threads = await db
        .select()
        .from(assistantThreads)
        .where(eq(assistantThreads.workspaceId, req.authCtx!.workspaceId))
        .orderBy(desc(assistantThreads.updatedAt));
      res.json({ threads });
    } catch (error) {
      console.error('Load assistant threads error:', error);
      res.status(500).json({ error: 'Failed to load assistant threads.' });
    }
  });

  router.post('/ai/assistant', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const repositoryId = parsePositiveInt(req.body.repositoryId);
      if (!repositoryId) return res.status(400).json({ error: 'Select a valid repository in your workspace.' });
      const question = String(req.body.question || '').trim();
      const threadId = req.body.threadId ? parsePositiveInt(req.body.threadId) : null;

      if (!question) return res.status(400).json({ error: 'Question cannot be empty.' });

      const [repo] = await db
        .select()
        .from(repositories)
        .where(and(eq(repositories.id, repositoryId), eq(repositories.workspaceId, wsId)));
      if (!repo) return res.status(404).json({ error: 'Select a valid repository in your workspace.' });

      const [prefs] = await db
        .select()
        .from(aiModelPreferences)
        .where(eq(aiModelPreferences.workspaceId, wsId));

      if (repo.isPrivate && prefs && !prefs.sendPrivateCodeConsent) {
        return res.status(403).json({
          error: 'Private repository AI transmission consent is disabled in AI Model Settings.',
        });
      }

      const providerKey = String(req.body.provider || prefs?.assistantProvider || 'gemini');
      const model = String(req.body.model || prefs?.assistantModel || 'gemini-4-hydrogen');

      const [repoFindings, latestScan] = await Promise.all([
        db.select().from(findings).where(eq(findings.repositoryId, repo.id)).limit(20),
        db
          .select()
          .from(scanJobs)
          .where(and(eq(scanJobs.repositoryId, repo.id), eq(scanJobs.status, 'completed')))
          .orderBy(desc(scanJobs.completedAt))
          .limit(1),
      ]);

      // Retrieve up to 5 relevant files for grounded context (findings first, then architecture nodes)
      const contextFiles: Array<{ path: string; content: string }> = [];
      const arch = latestScan[0]?.architectureJson as {
        entryPoints?: string[];
        circularDependencies?: string[][];
        nodes?: Array<{ id: string }>;
      } | null;
      const candidatePaths = Array.from(
        new Set([
          ...repoFindings.map((f) => f.filePath),
          ...(arch?.entryPoints || []),
          ...((arch?.nodes || []).map((n) => n.id)),
        ])
      ).slice(0, 5);
      for (const fp of candidatePaths) {
        try {
          const content = await resolveFileContentForRepo(wsId, repo, repo.defaultBranch, fp);
          contextFiles.push({ path: fp, content });
        } catch {
          // skip unreadable file
        }
      }

      const findingsSummary =
        repoFindings.length > 0
          ? repoFindings
              .map((f) => `- [${f.severity.toUpperCase()}] ${f.title} (${f.filePath}:${f.lineStart}) [${f.status}]`)
              .join('\n')
          : 'No findings recorded yet.';

      const architectureSummary = arch
        ? `Entry points: ${(arch.entryPoints || []).join(', ') || 'none detected'}; Circular dependencies: ${(arch.circularDependencies || []).length}`
        : 'Architecture scan not run yet.';

      let existingMessages: Array<{ role: 'user' | 'assistant'; content: string; model?: string; evidenceFiles?: string[]; timestamp: string }> = [];
      let verifiedThreadId: number | null = null;
      if (threadId) {
        const [th] = await db
          .select()
          .from(assistantThreads)
          .where(and(eq(assistantThreads.id, threadId), eq(assistantThreads.workspaceId, wsId)));
        if (th) {
          verifiedThreadId = th.id;
          if (th.messagesJson) existingMessages = th.messagesJson;
        }
      }

      const answer = await runRepositoryAssistantTurn({
        workspaceId: wsId,
        providerKey,
        model,
        question,
        repoContext: {
          repoName: repo.fullName,
          findingsSummary,
          architectureSummary,
          files: contextFiles,
        },
        history: existingMessages.map((m) => ({ role: m.role, content: m.content })),
      });

      const nowIso = new Date().toISOString();
      const updatedMessages = [
        ...existingMessages,
        { role: 'user' as const, content: question, timestamp: nowIso },
        {
          role: 'assistant' as const,
          content: answer,
          model,
          evidenceFiles: contextFiles.map((f) => f.path),
          timestamp: nowIso,
        },
      ];

      let savedThread;
      if (verifiedThreadId) {
        [savedThread] = await db
          .update(assistantThreads)
          .set({ messagesJson: updatedMessages, updatedAt: new Date() })
          .where(and(eq(assistantThreads.id, verifiedThreadId), eq(assistantThreads.workspaceId, wsId)))
          .returning();
      } else {
        [savedThread] = await db
          .insert(assistantThreads)
          .values({
            workspaceId: wsId,
            repositoryId: repo.id,
            title: question.slice(0, 60),
            messagesJson: updatedMessages,
          })
          .returning();
      }

      res.json({ thread: savedThread, answer, evidenceFiles: contextFiles.map((f) => f.path) });
    } catch (error) {
      console.error('AI assistant error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Assistant request failed.' });
    }
  });

  // Analytics
  router.get('/analytics', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const [repos, history, allFindings, scans] = await Promise.all([
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)),
        db.select().from(healthScoreHistory).where(eq(healthScoreHistory.workspaceId, wsId)).orderBy(desc(healthScoreHistory.recordedAt)).limit(30),
        db.select().from(findings).where(eq(findings.workspaceId, wsId)),
        db.select().from(scanJobs).where(eq(scanJobs.workspaceId, wsId)).orderBy(desc(scanJobs.createdAt)).limit(30),
      ]);

      const bySeverity = {
        critical: allFindings.filter((f) => f.severity === 'critical').length,
        high: allFindings.filter((f) => f.severity === 'high').length,
        medium: allFindings.filter((f) => f.severity === 'medium').length,
        low: allFindings.filter((f) => f.severity === 'low').length,
        info: allFindings.filter((f) => f.severity === 'info').length,
      };

      const byCategory = {
        security: allFindings.filter((f) => f.category === 'security').length,
        quality: allFindings.filter((f) => f.category === 'quality').length,
        dependency: allFindings.filter((f) => f.category === 'dependency').length,
        architecture: allFindings.filter((f) => f.category === 'architecture').length,
        performance: allFindings.filter((f) => f.category === 'performance').length,
      };

      const resolved = allFindings.filter((f) => f.status === 'verified_resolved').length;
      const unresolved = allFindings.filter(
        (f) => f.status !== 'verified_resolved' && f.status !== 'dismissed'
      ).length;

      res.json({
        repositories: repos,
        scoreHistory: [...history].reverse(),
        bySeverity,
        byCategory,
        resolution: { resolved, unresolved },
        scans,
      });
    } catch (error) {
      console.error('Analytics load error:', error);
      res.status(500).json({ error: 'Failed to load workspace analytics.' });
    }
  });

  // Reports
  router.get('/reports', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const [list, repos] = await Promise.all([
        db.select().from(reports).where(eq(reports.workspaceId, wsId)).orderBy(desc(reports.createdAt)),
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)),
      ]);
      res.json({ reports: list, repositories: repos });
    } catch (error) {
      console.error('List reports error:', error);
      res.status(500).json({ error: 'Failed to load reports.' });
    }
  });

  router.post('/reports/generate', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const repositoryId = req.body.repositoryId ? parsePositiveInt(req.body.repositoryId) : null;
      const reportType = String(req.body.reportType || 'health');

      const [repos, allFindings, scans] = await Promise.all([
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)),
        db.select().from(findings).where(eq(findings.workspaceId, wsId)),
        db.select().from(scanJobs).where(eq(scanJobs.workspaceId, wsId)).orderBy(desc(scanJobs.createdAt)),
      ]);

      const targetRepo = repositoryId ? repos.find((r) => r.id === repositoryId) : null;
      const scopedFindings = targetRepo
        ? allFindings.filter((f) => f.repositoryId === targetRepo.id)
        : allFindings;

      const latestScan = targetRepo
        ? scans.find((s) => s.repositoryId === targetRepo.id && s.status === 'completed')
        : scans.find((s) => s.status === 'completed');

      const summaryJson = {
        generatedAt: new Date().toISOString(),
        scope: targetRepo ? targetRepo.fullName : 'All Workspace Repositories',
        healthScore: targetRepo ? targetRepo.healthScore : latestScan?.healthScore ?? null,
        totalFindings: scopedFindings.length,
        critical: scopedFindings.filter((f) => f.severity === 'critical').length,
        high: scopedFindings.filter((f) => f.severity === 'high').length,
        medium: scopedFindings.filter((f) => f.severity === 'medium').length,
        low: scopedFindings.filter((f) => f.severity === 'low').length,
        resolved: scopedFindings.filter((f) => f.status === 'verified_resolved').length,
        topFindings: scopedFindings.slice(0, 12).map((f) => ({
          ruleId: f.ruleId,
          title: f.title,
          severity: f.severity,
          category: f.category,
          filePath: f.filePath,
          lineStart: f.lineStart,
          status: f.status,
        })),
      };

      const [created] = await db
        .insert(reports)
        .values({
          workspaceId: wsId,
          repositoryId: targetRepo?.id || null,
          scanJobId: latestScan?.id || null,
          reportType,
          title: `${reportType.toUpperCase()} Report — ${targetRepo ? targetRepo.fullName : 'Workspace Overview'}`,
          summaryJson,
          createdByUid: req.authCtx!.uid,
        })
        .returning();

      res.status(201).json({ report: created });
    } catch (error) {
      console.error('Generate report error:', error);
      res.status(500).json({ error: 'Failed to generate report.' });
    }
  });

  // Notifications
  router.get('/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const list = await db
        .select()
        .from(notifications)
        .where(eq(notifications.workspaceId, req.authCtx!.workspaceId))
        .orderBy(desc(notifications.createdAt))
        .limit(50);
      res.json({ notifications: list });
    } catch (error) {
      console.error('Notifications error:', error);
      res.status(500).json({ error: 'Failed to load notifications.' });
    }
  });

  router.post('/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const notifId = parsePositiveInt(req.params.id);
      if (!notifId) return res.status(400).json({ error: 'Invalid notification ID.' });
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, notifId), eq(notifications.workspaceId, req.authCtx!.workspaceId)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Mark notification read error:', error);
      res.status(500).json({ error: 'Failed to mark notification as read.' });
    }
  });

  router.post('/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.workspaceId, req.authCtx!.workspaceId));
      res.json({ ok: true });
    } catch (error) {
      console.error('Mark all notifications read error:', error);
      res.status(500).json({ error: 'Failed to update notifications.' });
    }
  });

  // Team & Audit Logs
  router.get('/team', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const [members, logs, repos] = await Promise.all([
        db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, wsId)).orderBy(asc(workspaceMembers.id)),
        db.select().from(auditLogs).where(eq(auditLogs.workspaceId, wsId)).orderBy(desc(auditLogs.createdAt)).limit(25),
        db.select().from(repositories).where(eq(repositories.workspaceId, wsId)),
      ]);
      res.json({ members, auditLogs: logs, sharedRepositories: repos });
    } catch (error) {
      console.error('Team load error:', error);
      res.status(500).json({ error: 'Failed to load team details.' });
    }
  });

  router.post('/team/invite', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const email = String(req.body.email || '').trim().toLowerCase();
      const name = String(req.body.name || email.split('@')[0] || 'Engineer').trim();
      const role = String(req.body.role || 'engineer');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Enter a valid email address.' });
      }
      const [member] = await db
        .insert(workspaceMembers)
        .values({
          workspaceId: wsId,
          email,
          name,
          role: ['admin', 'engineer', 'viewer'].includes(role) ? role : 'engineer',
          status: 'invited',
        })
        .returning();

      await db.insert(auditLogs).values({
        workspaceId: wsId,
        userUid: req.authCtx!.uid,
        action: 'team.member_invited',
        resourceType: 'workspace_member',
        resourceId: String(member.id),
        detailsJson: { email, role: member.role },
      });

      res.status(201).json({ member });
    } catch (error) {
      console.error('Team invite error:', error);
      res.status(500).json({ error: 'Failed to send workspace invitation.' });
    }
  });

  router.patch('/team/:id/role', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const wsId = req.authCtx!.workspaceId;
      const memberId = parsePositiveInt(req.params.id);
      if (!memberId) return res.status(400).json({ error: 'Invalid member ID.' });
      const role = String(req.body.role || 'engineer');
      if (!['owner', 'admin', 'engineer', 'viewer'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
      }
      const [updated] = await db
        .update(workspaceMembers)
        .set({ role })
        .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, wsId)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Member not found.' });
      await db.insert(auditLogs).values({
        workspaceId: wsId,
        userUid: req.authCtx!.uid,
        action: 'team.role_updated',
        resourceType: 'workspace_member',
        resourceId: String(updated.id),
        detailsJson: { email: updated.email, role: updated.role },
      });
      res.json({ member: updated });
    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({ error: 'Failed to update member role.' });
    }
  });

  router.put('/workspace/name', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const name = String(req.body.name || '').trim();
      if (!name || name.length > 80) {
        return res.status(400).json({ error: 'Workspace name must be 1–80 characters.' });
      }
      const [ws] = await db
        .update(workspaces)
        .set({ name })
        .where(eq(workspaces.id, req.authCtx!.workspaceId))
        .returning();
      res.json({ workspace: ws });
    } catch (error) {
      console.error('Rename workspace error:', error);
      res.status(500).json({ error: 'Failed to rename workspace.' });
    }
  });

  return router;
}
