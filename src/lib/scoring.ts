export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingCategory = 'security' | 'quality' | 'dependency' | 'architecture' | 'performance';

export interface ScoringFindingInput {
  id?: number | string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: 'confirmed' | 'potential';
  status?: string;
}

export interface RepoSignalsInput {
  totalFiles: number;
  hasTests: boolean;
  testFileCount: number;
  hasReadme: boolean;
  hasSecurityPolicy: boolean;
  hasCiConfig: boolean;
  hasEnvExample: boolean;
  hasTypeConfig: boolean;
  circularDependencyCount: number;
  vulnerableDependencyCount: number;
  outdatedDependencyCount: number;
}

export interface ScoreBreakdown {
  overallScore: number;
  categories: {
    security: number;
    quality: number;
    dependency: number;
    maintainability: number;
    testingDocs: number;
    config: number;
  };
  weights: {
    security: number;
    quality: number;
    dependency: number;
    maintainability: number;
    testingDocs: number;
    config: number;
  };
  deductions: Array<{
    category: string;
    reason: string;
    points: number;
    severity?: FindingSeverity;
  }>;
  methodologyNote: string;
}

export const SCORE_WEIGHTS = {
  security: 0.3,
  quality: 0.2,
  dependency: 0.2,
  maintainability: 0.15,
  testingDocs: 0.1,
  config: 0.05,
} as const;

const SEVERITY_DEDUCTION: Record<FindingSeverity, number> = {
  critical: 18,
  high: 10,
  medium: 4,
  low: 1.5,
  info: 0,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateRepositoryHealthScore(
  findingsList: ScoringFindingInput[],
  signals: RepoSignalsInput
): ScoreBreakdown {
  const activeFindings = findingsList.filter(
    (f) => f.status !== 'verified_resolved' && f.status !== 'dismissed'
  );

  let security = 100;
  let quality = 100;
  let dependency = 100;
  let maintainability = 100;
  let testingDocs = 40; // Base 40, earn up to 100 for tests, README, SECURITY.md
  let config = 60; // Base 60, earn up to 100 for CI, .env.example, tsconfig/linting

  const deductions: ScoreBreakdown['deductions'] = [];

  for (const f of activeFindings) {
    const basePenalty = SEVERITY_DEDUCTION[f.severity] ?? 0;
    const confidenceFactor = f.confidence === 'confirmed' ? 1 : 0.65;
    const penalty = Number((basePenalty * confidenceFactor).toFixed(1));
    if (penalty <= 0) continue;

    if (f.category === 'security') {
      security -= penalty;
      deductions.push({
        category: 'security',
        reason: f.title,
        points: -penalty,
        severity: f.severity,
      });
    } else if (f.category === 'dependency') {
      dependency -= penalty;
      deductions.push({
        category: 'dependency',
        reason: f.title,
        points: -penalty,
        severity: f.severity,
      });
    } else if (f.category === 'quality' || f.category === 'performance') {
      quality -= penalty;
      maintainability -= Number((penalty * 0.5).toFixed(1));
      deductions.push({
        category: f.category,
        reason: f.title,
        points: -penalty,
        severity: f.severity,
      });
    } else if (f.category === 'architecture') {
      maintainability -= penalty;
      deductions.push({
        category: 'architecture',
        reason: f.title,
        points: -penalty,
        severity: f.severity,
      });
    }
  }

  // Signals for Testing & Docs
  if (signals.hasTests) {
    testingDocs += Math.min(40, 20 + signals.testFileCount * 5);
  } else {
    deductions.push({
      category: 'testingDocs',
      reason: 'No automated test suite detected',
      points: -30,
      severity: 'medium',
    });
  }

  if (signals.hasReadme) {
    testingDocs += 15;
  } else {
    deductions.push({
      category: 'testingDocs',
      reason: 'Missing root README.md documentation',
      points: -15,
      severity: 'low',
    });
  }

  if (signals.hasSecurityPolicy) {
    testingDocs += 5;
  }

  // Signals for Config quality
  if (signals.hasCiConfig) config += 15;
  if (signals.hasEnvExample) config += 15;
  if (signals.hasTypeConfig) config += 10;

  if (!signals.hasCiConfig) {
    deductions.push({
      category: 'config',
      reason: 'No CI workflow configuration detected',
      points: -15,
      severity: 'low',
    });
  }

  if (signals.circularDependencyCount > 0) {
    const circPenalty = Math.min(25, signals.circularDependencyCount * 8);
    maintainability -= circPenalty;
    deductions.push({
      category: 'architecture',
      reason: `${signals.circularDependencyCount} circular module dependency cycle(s)`,
      points: -circPenalty,
      severity: 'medium',
    });
  }

  const categories = {
    security: clampScore(security),
    quality: clampScore(quality),
    dependency: clampScore(dependency),
    maintainability: clampScore(maintainability),
    testingDocs: clampScore(testingDocs),
    config: clampScore(config),
  };

  const overallScore = clampScore(
    categories.security * SCORE_WEIGHTS.security +
      categories.quality * SCORE_WEIGHTS.quality +
      categories.dependency * SCORE_WEIGHTS.dependency +
      categories.maintainability * SCORE_WEIGHTS.maintainability +
      categories.testingDocs * SCORE_WEIGHTS.testingDocs +
      categories.config * SCORE_WEIGHTS.config
  );

  deductions.sort((a, b) => a.points - b.points);

  return {
    overallScore,
    categories,
    weights: { ...SCORE_WEIGHTS },
    deductions: deductions.slice(0, 12),
    methodologyNote:
      'Deterministic weighted score: Security 30%, Code Quality 20%, Dependency Health 20%, Maintainability 15%, Testing & Docs 10%, Configuration 5%. Confirmed findings carry 1.0x penalty; potential findings carry 0.65x.',
  };
}

export function deriveRepositoryStatus(
  overallScore: number | null,
  criticalCount: number
): 'healthy' | 'needs_attention' | 'critical' | 'unscanned' {
  if (overallScore === null) return 'unscanned';
  if (criticalCount > 0 || overallScore < 55) return 'critical';
  if (overallScore < 80) return 'needs_attention';
  return 'healthy';
}
