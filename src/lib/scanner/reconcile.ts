import type { FindingCategory } from '../scoring.ts';
import type { DetectedFinding, ScanType } from './engine.ts';

export interface ExistingRepositoryFinding {
  id: number;
  fingerprint: string;
  category: string;
  status: string;
}

export interface ReconciliationPlan {
  duplicateIdsToDelete: number[];
  updates: Array<{ id: number; finding: DetectedFinding; nextStatus: string }>;
  inserts: DetectedFinding[];
  resolveIds: number[];
}

const STATUS_PRIORITY: Record<string, number> = {
  verified_resolved: 6,
  approved: 5,
  patch_proposed: 4,
  diagnosed: 3,
  dismissed: 2,
  open: 1,
};

export function getCoveredCategories(
  scanType: ScanType,
  enabledAnalyzers?: string[]
): Set<FindingCategory> {
  if (scanType === 'full') {
    return new Set(['security', 'quality', 'dependency', 'architecture', 'performance']);
  }
  if (scanType === 'security') return new Set(['security']);
  if (scanType === 'quality') return new Set(['quality', 'performance']);
  if (scanType === 'dependency') return new Set(['dependency']);
  if (scanType === 'architecture') return new Set(['architecture']);

  const covered = new Set<FindingCategory>();
  const analyzers = enabledAnalyzers || [];
  if (analyzers.includes('secret-scanner') || analyzers.includes('static-ast')) {
    covered.add('security');
  }
  if (analyzers.includes('complexity-analyzer')) {
    covered.add('quality');
    covered.add('performance');
  }
  if (analyzers.includes('osv-audit')) {
    covered.add('dependency');
  }
  if (analyzers.includes('architecture-analyzer')) {
    covered.add('architecture');
  }
  return covered;
}

export function reconcileRepositoryFindings(
  existingFindings: ExistingRepositoryFinding[],
  detectedFindings: DetectedFinding[],
  coveredCategories: Set<FindingCategory>
): ReconciliationPlan {
  const canonicalByFingerprint = new Map<string, ExistingRepositoryFinding>();
  const duplicateIdsToDelete: number[] = [];

  for (const row of existingFindings) {
    const prev = canonicalByFingerprint.get(row.fingerprint);
    if (!prev) {
      canonicalByFingerprint.set(row.fingerprint, row);
      continue;
    }
    const prevPrio = STATUS_PRIORITY[prev.status] || 0;
    const rowPrio = STATUS_PRIORITY[row.status] || 0;
    if (rowPrio > prevPrio || (rowPrio === prevPrio && row.id > prev.id)) {
      duplicateIdsToDelete.push(prev.id);
      canonicalByFingerprint.set(row.fingerprint, row);
    } else {
      duplicateIdsToDelete.push(row.id);
    }
  }

  const detectedFingerprints = new Set<string>();
  const updates: ReconciliationPlan['updates'] = [];
  const inserts: DetectedFinding[] = [];

  for (const detected of detectedFindings) {
    if (detectedFingerprints.has(detected.fingerprint)) continue;
    detectedFingerprints.add(detected.fingerprint);

    const existing = canonicalByFingerprint.get(detected.fingerprint);
    if (existing) {
      const nextStatus = existing.status === 'open' ? 'open' : existing.status;
      updates.push({ id: existing.id, finding: detected, nextStatus });
    } else {
      inserts.push(detected);
    }
  }

  const resolveIds: number[] = [];
  for (const [fingerprint, existing] of canonicalByFingerprint.entries()) {
    if (detectedFingerprints.has(fingerprint)) continue;
    const category = existing.category as FindingCategory;
    if (
      coveredCategories.has(category) &&
      existing.status !== 'dismissed' &&
      existing.status !== 'verified_resolved'
    ) {
      resolveIds.push(existing.id);
    }
  }

  return {
    duplicateIdsToDelete,
    updates,
    inserts,
    resolveIds,
  };
}
