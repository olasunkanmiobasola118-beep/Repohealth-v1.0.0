import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  auditLogs,
  findings,
  githubInstallations,
  healthScoreHistory,
  notifications,
  repositories,
  scanJobs,
} from '../db/schema.ts';
import { deriveRepositoryStatus } from '../lib/scoring.ts';
import { runDeterministicScan, type ScannableFile, type ScanType } from '../lib/scanner/engine.ts';
import { getCoveredCategories, reconcileRepositoryFindings } from '../lib/scanner/reconcile.ts';
import { decryptSecret } from './crypto.ts';
import { fetchGitHubRepositoryFiles } from './github.ts';
import { queryOsvBatch } from './osv.ts';

export async function executeScanJob(params: {
  workspaceId: number;
  repositoryId: number;
  branch: string;
  scanType: ScanType;
  enabledAnalyzers?: string[];
  existingJobId?: number;
  filesOverride?: ScannableFile[];
  commitSha?: string;
  skipOsv?: boolean;
  userUid?: string;
}) {
  const [repo] = await db
    .select()
    .from(repositories)
    .where(eq(repositories.id, params.repositoryId));

  if (!repo || repo.workspaceId !== params.workspaceId) {
    throw new Error('Repository not found in workspace.');
  }

  let jobId = params.existingJobId;
  if (!jobId) {
    const [created] = await db
      .insert(scanJobs)
      .values({
        workspaceId: params.workspaceId,
        repositoryId: params.repositoryId,
        branch: params.branch,
        commitSha: params.commitSha || 'HEAD',
        scanType: params.scanType,
        status: 'running',
        currentStage: 'Initializing scan pipeline',
        progressPct: 10,
        startedAt: new Date(),
      })
      .returning();
    jobId = created.id;
  } else {
    await db
      .update(scanJobs)
      .set({
        status: 'running',
        currentStage: 'Fetching repository files',
        progressPct: 15,
        startedAt: new Date(),
      })
      .where(eq(scanJobs.id, jobId));
  }

  try {
    let files: ScannableFile[] = params.filesOverride || [];
    let commitSha = params.commitSha || 'HEAD';
    const extraSkipped: string[] = [];

    if (files.length === 0) {
      const [gh] = await db
        .select()
        .from(githubInstallations)
        .where(eq(githubInstallations.workspaceId, params.workspaceId));
      const token = decryptSecret(gh?.encryptedToken);
      const fetched = await fetchGitHubRepositoryFiles(repo.fullName, params.branch, token || undefined);
      files = fetched.files;
      commitSha = fetched.commitSha;
      if (fetched.skippedReason) extraSkipped.push(fetched.skippedReason);
    }

    await db
      .update(scanJobs)
      .set({
        currentStage: 'Running deterministic security & AST analyzers',
        progressPct: 45,
        totalFiles: files.length,
        commitSha,
      })
      .where(eq(scanJobs.id, jobId));

    const scanResult = await runDeterministicScan(files, {
      scanType: params.scanType,
      enabledAnalyzers: params.enabledAnalyzers,
      osvLookup: params.skipOsv ? undefined : queryOsvBatch,
    });

    await db
      .update(scanJobs)
      .set({
        currentStage: 'Computing deterministic health score & persisting findings',
        progressPct: 80,
        filesAnalyzed: scanResult.filesAnalyzed,
      })
      .where(eq(scanJobs.id, jobId));

    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    for (const f of scanResult.findings) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    }

    const existingRepoFindings = await db
      .select({
        id: findings.id,
        fingerprint: findings.fingerprint,
        category: findings.category,
        status: findings.status,
      })
      .from(findings)
      .where(eq(findings.repositoryId, params.repositoryId));

    const plan = reconcileRepositoryFindings(
      existingRepoFindings,
      scanResult.findings,
      getCoveredCategories(params.scanType, params.enabledAnalyzers)
    );

    if (plan.duplicateIdsToDelete.length > 0) {
      await db.delete(findings).where(inArray(findings.id, plan.duplicateIdsToDelete));
    }

    for (const upd of plan.updates) {
      await db
        .update(findings)
        .set({
          scanJobId: jobId!,
          severity: upd.finding.severity,
          confidence: upd.finding.confidence,
          scannerEngine: upd.finding.scannerEngine,
          ruleId: upd.finding.ruleId,
          title: upd.finding.title,
          description: upd.finding.description,
          whyItMatters: upd.finding.whyItMatters,
          filePath: upd.finding.filePath,
          lineStart: upd.finding.lineStart,
          lineEnd: upd.finding.lineEnd,
          codeExcerpt: upd.finding.codeExcerpt,
          status: upd.nextStatus,
          metadataJson: upd.finding.metadata || {},
          updatedAt: new Date(),
        })
        .where(eq(findings.id, upd.id));
    }

    if (plan.resolveIds.length > 0) {
      await db
        .update(findings)
        .set({ status: 'verified_resolved', updatedAt: new Date() })
        .where(inArray(findings.id, plan.resolveIds));
    }

    if (plan.inserts.length > 0) {
      await db.insert(findings).values(
        plan.inserts.map((f) => ({
          workspaceId: params.workspaceId,
          repositoryId: params.repositoryId,
          scanJobId: jobId!,
          fingerprint: f.fingerprint,
          category: f.category,
          severity: f.severity,
          confidence: f.confidence,
          scannerEngine: f.scannerEngine,
          ruleId: f.ruleId,
          title: f.title,
          description: f.description,
          whyItMatters: f.whyItMatters,
          filePath: f.filePath,
          lineStart: f.lineStart,
          lineEnd: f.lineEnd,
          codeExcerpt: f.codeExcerpt,
          status: 'open',
          metadataJson: f.metadata || {},
        }))
      );
    }

    const previousScores = await db
      .select()
      .from(healthScoreHistory)
      .where(eq(healthScoreHistory.repositoryId, params.repositoryId))
      .orderBy(desc(healthScoreHistory.recordedAt))
      .limit(1);

    const prevOverall = previousScores[0]?.overallScore ?? scanResult.scoreBreakdown.overallScore;
    const delta = scanResult.scoreBreakdown.overallScore - prevOverall;

    await db.insert(healthScoreHistory).values({
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      scanJobId: jobId,
      overallScore: scanResult.scoreBreakdown.overallScore,
      securityScore: scanResult.scoreBreakdown.categories.security,
      qualityScore: scanResult.scoreBreakdown.categories.quality,
      dependencyScore: scanResult.scoreBreakdown.categories.dependency,
      maintainabilityScore: scanResult.scoreBreakdown.categories.maintainability,
      testingDocsScore: scanResult.scoreBreakdown.categories.testingDocs,
      configScore: scanResult.scoreBreakdown.categories.config,
      deltaFromPrevious: delta,
    });

    const allSkipped = [...extraSkipped, ...scanResult.skippedChecks];

    const [completedJob] = await db
      .update(scanJobs)
      .set({
        status: 'completed',
        currentStage: 'Completed',
        progressPct: 100,
        filesAnalyzed: scanResult.filesAnalyzed,
        totalFiles: files.length,
        findingsCount: scanResult.findings.length,
        criticalCount: counts.critical,
        highCount: counts.high,
        mediumCount: counts.medium,
        lowCount: counts.low,
        infoCount: counts.info,
        healthScore: scanResult.scoreBreakdown.overallScore,
        scoreBreakdownJson: scanResult.scoreBreakdown as unknown as Record<string, unknown>,
        architectureJson: scanResult.architecture as unknown as Record<string, unknown>,
        dependenciesJson: scanResult.dependencies as unknown as Array<Record<string, unknown>>,
        skippedChecksJson: allSkipped,
        completedAt: new Date(),
      })
      .where(eq(scanJobs.id, jobId))
      .returning();

    const newStatus = deriveRepositoryStatus(scanResult.scoreBreakdown.overallScore, counts.critical);

    await db
      .update(repositories)
      .set({
        lastScanAt: new Date(),
        healthScore: scanResult.scoreBreakdown.overallScore,
        languagesJson: scanResult.languages,
        status: newStatus,
      })
      .where(eq(repositories.id, params.repositoryId));

    await db.insert(notifications).values({
      workspaceId: params.workspaceId,
      type: counts.critical > 0 ? 'critical_finding' : 'scan_complete',
      title:
        counts.critical > 0
          ? `${counts.critical} critical issue(s) in ${repo.fullName}`
          : `Scan completed for ${repo.fullName}`,
      message: `Analyzed ${scanResult.filesAnalyzed} files on ${params.branch}. Health score: ${scanResult.scoreBreakdown.overallScore}/100 (${scanResult.findings.length} findings).`,
      linkPath: `/app/repositories/${repo.id}`,
      isRead: false,
    });

    if (params.userUid) {
      await db.insert(auditLogs).values({
        workspaceId: params.workspaceId,
        userUid: params.userUid,
        action: 'scan.completed',
        resourceType: 'scan_job',
        resourceId: String(jobId),
        detailsJson: {
          repository: repo.fullName,
          scanType: params.scanType,
          score: scanResult.scoreBreakdown.overallScore,
          findingsCount: scanResult.findings.length,
        },
      });
    }

    return completedJob;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan execution failed';
    await db
      .update(scanJobs)
      .set({
        status: 'failed',
        currentStage: 'Failed',
        errorMessage: message,
        completedAt: new Date(),
      })
      .where(eq(scanJobs.id, jobId));

    await db.insert(notifications).values({
      workspaceId: params.workspaceId,
      type: 'verification_failed',
      title: `Scan failed for ${repo.fullName}`,
      message,
      linkPath: '/app/scans',
      isRead: false,
    });

    throw error;
  }
}
