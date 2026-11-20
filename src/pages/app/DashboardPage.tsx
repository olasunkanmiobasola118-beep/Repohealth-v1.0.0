import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FolderGit2, ScanSearch, ShieldAlert, Stethoscope } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SeverityLabel, StatusLabel } from '../../components/SeverityTag';
import { useAuth } from '../../context/AuthContext';

interface DashboardData {
  summary: {
    connectedRepos: number;
    avgHealthScore: number | null;
    openIssuesCount: number;
    criticalCount: number;
    highCount: number;
    resolvedCount: number;
    totalScans: number;
  };
  repositories: Array<{
    id: number;
    fullName: string;
    language: string;
    defaultBranch: string;
    healthScore: number | null;
    status: string;
    lastScanAt: string | null;
  }>;
  recentScans: Array<{
    id: number;
    repositoryId: number;
    branch: string;
    scanType: string;
    status: string;
    findingsCount: number;
    healthScore: number | null;
    createdAt: string;
  }>;
  criticalFindings: Array<{
    id: number;
    repositoryId: number;
    title: string;
    severity: string;
    category: string;
    filePath: string;
    lineStart: number;
    status: string;
  }>;
  recentDiagnoses: Array<{
    id: number;
    findingId: number;
    model: string;
    rootCause: string;
    createdAt: string;
  }>;
  scoreHistory: Array<{
    id: number;
    overallScore: number;
    securityScore: number;
    qualityScore: number;
    recordedAt: string;
  }>;
}

export function DashboardPage() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<DashboardData>('/api/dashboard')
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch]);

  const repoNameMap = new Map((data?.repositories || []).map((r) => [r.id, r.fullName]));

  return (
    <AppShell title="Dashboard">
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]" />
            ))}
          </div>
          <div className="h-64 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]" />
        </div>
      ) : error ? (
        <div role="alert" className="p-4 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : data ? (
        <div className="space-y-8">
          {/* KPI Summary Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="text-xs font-medium text-[#777783] dark:text-[#9898A6]">Average Health Score</div>
              <div className="mt-2 font-display text-3xl font-bold tabular-nums">
                {data.summary.avgHealthScore !== null ? `${data.summary.avgHealthScore}/100` : '—'}
              </div>
              <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6]">
                Weighted deterministic average
              </div>
            </div>

            <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="text-xs font-medium text-[#777783] dark:text-[#9898A6]">Connected Repositories</div>
              <div className="mt-2 font-display text-3xl font-bold tabular-nums">
                {data.summary.connectedRepos}
              </div>
              <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6] tabular-nums">
                {data.summary.totalScans} recent scan {data.summary.totalScans === 1 ? 'job' : 'jobs'}
              </div>
            </div>

            <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="text-xs font-medium text-[#777783] dark:text-[#9898A6]">Critical &amp; High Issues</div>
              <div className="mt-2 font-display text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {data.summary.criticalCount + data.summary.highCount}
              </div>
              <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6] tabular-nums">
                {data.summary.criticalCount} critical · {data.summary.highCount} high
              </div>
            </div>

            <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="text-xs font-medium text-[#777783] dark:text-[#9898A6]">Verified Resolved</div>
              <div className="mt-2 font-display text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {data.summary.resolvedCount}
              </div>
              <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6] tabular-nums">
                {data.summary.openIssuesCount} open {data.summary.openIssuesCount === 1 ? 'finding' : 'findings'} remaining
              </div>
            </div>
          </div>

          {/* Health Trend & Critical Findings */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-semibold">Critical &amp; High Attention Queue</h2>
                </div>
                <Link to="/app/security" className="text-xs font-medium text-[#7656D6] hover:underline">
                  Open Security Center
                </Link>
              </div>
              {data.criticalFindings.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#777783] dark:text-[#9898A6]">
                  No open critical or high-severity findings in this workspace.
                </div>
              ) : (
                <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {data.criticalFindings.map((f) => (
                    <div key={f.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F8F8FA]/60 dark:hover:bg-[#19191F]/60">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{f.title}</div>
                        <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6] font-mono truncate">
                          {repoNameMap.get(f.repositoryId) || 'repo'} · {f.filePath}:{f.lineStart}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <SeverityLabel severity={f.severity} />
                        <Link
                          to={`/app/diagnosis?findingId=${f.id}`}
                          className="text-xs font-semibold text-[#7656D6] hover:underline whitespace-nowrap"
                        >
                          Diagnose
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Score Trend Spark Chart */}
            <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg p-5 flex flex-col justify-between">
              <div>
                <h2 className="font-display text-sm font-semibold">Health Score Trend</h2>
                <p className="mt-1 text-xs text-[#777783] dark:text-[#9898A6]">
                  Deterministic scores recorded across scan runs
                </p>
              </div>

              {data.scoreHistory.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#777783]">No scan history recorded yet.</div>
              ) : (
                <div className="my-6">
                  <div className="flex items-end gap-2 h-32 pt-2 border-b border-[#E8E8ED] dark:border-[#2B2B34]">
                    {data.scoreHistory.slice(-10).map((point) => (
                      <div key={point.id} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5">
                        <span className="font-mono text-[10px] tabular-nums text-[#777783]">
                          {point.overallScore}
                        </span>
                        <div
                          className="w-full max-w-[32px] rounded-t bg-[#7656D6]/85 transition-all"
                          style={{ height: `${Math.max(10, Math.round((point.overallScore / 100) * 92))}px` }}
                          title={`Score: ${point.overallScore}/100`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Link
                to="/app/analytics"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7656D6] hover:underline"
              >
                <span>Inspect full analytics</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Repositories & Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderGit2 className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-semibold">Repositories</h2>
                </div>
                <Link to="/app/repositories" className="text-xs font-medium text-[#7656D6] hover:underline">
                  Manage all
                </Link>
              </div>
              {data.repositories.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-sm text-[#777783]">No repositories connected yet.</p>
                  <Link
                    to="/app/repositories"
                    className="glass-btn-primary inline-flex px-4 py-2 rounded-lg text-xs font-semibold"
                  >
                    Connect Repository
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {data.repositories.slice(0, 6).map((repo) => (
                    <Link
                      key={repo.id}
                      to={`/app/repositories/${repo.id}`}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F8F8FA]/60 dark:hover:bg-[#19191F]/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{repo.fullName}</div>
                        <div className="mt-0.5 text-xs text-[#777783] dark:text-[#9898A6]">
                          {repo.language} · {repo.defaultBranch}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <StatusLabel status={repo.status} />
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {repo.healthScore !== null ? `${repo.healthScore}` : '—'}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-semibold">Recent Scans &amp; AI Diagnoses</h2>
                </div>
                <Link to="/app/scans" className="text-xs font-medium text-[#7656D6] hover:underline">
                  Scan history
                </Link>
              </div>
              <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                {data.recentScans.slice(0, 4).map((scan) => (
                  <div key={scan.id} className="px-5 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {repoNameMap.get(scan.repositoryId) || `Repository #${scan.repositoryId}`}
                      </div>
                      <div className="text-xs text-[#777783] dark:text-[#9898A6] font-mono tabular-nums">
                        {scan.scanType} · {scan.branch} · {scan.findingsCount} {scan.findingsCount === 1 ? 'finding' : 'findings'}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      {scan.healthScore !== null ? `${scan.healthScore}/100` : scan.status}
                    </span>
                  </div>
                ))}
                {data.recentDiagnoses.slice(0, 2).map((diag) => (
                  <Link
                    key={diag.id}
                    to="/app/diagnosis"
                    className="px-5 py-3 block hover:bg-[#F8F8FA]/60 dark:hover:bg-[#19191F]/60"
                  >
                    <div className="text-xs font-semibold text-[#7656D6]">AI Diagnosis · {diag.model}</div>
                    <div className="mt-0.5 text-sm truncate">{diag.rootCause}</div>
                  </Link>
                ))}
                {data.recentScans.length === 0 && data.recentDiagnoses.length === 0 ? (
                  <div className="p-8 text-center space-y-3">
                    <ScanSearch className="h-5 w-5 mx-auto text-[#777783]" />
                    <p className="text-sm text-[#777783]">Run your first repository scan to populate activity.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
