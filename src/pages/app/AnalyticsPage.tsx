import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface AnalyticsPayload {
  repositories: Array<{ id: number; fullName: string; healthScore: number | null; language: string }>;
  scoreHistory: Array<{ id: number; overallScore: number; securityScore: number; qualityScore: number; recordedAt: string }>;
  bySeverity: Record<string, number>;
  byCategory: Record<string, number>;
  resolution: { resolved: number; unresolved: number };
}

export function AnalyticsPage() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AnalyticsPayload>('/api/analytics')
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load workspace analytics.');
      })
      .finally(() => setLoading(false));
  }, [apiFetch]);

  return (
    <AppShell title="Analytics">
      {error ? (
        <div role="alert" className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : loading || !data ? (
        <div className="p-8 text-sm text-[#777783]">Loading workspace analytics...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34]">
              <h2 className="font-display text-sm font-semibold mb-4">Findings by Severity</h2>
              <div className="space-y-2.5 text-xs">
                {Object.entries(data.bySeverity).map(([sev, count]) => {
                  const total = Math.max(1, Object.values(data.bySeverity).reduce((a, b) => a + b, 0));
                  return (
                    <div key={sev}>
                      <div className="flex justify-between mb-1">
                        <span className="capitalize font-medium">{sev}</span>
                        <span className="font-mono tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 rounded bg-[#E8E8ED] dark:bg-[#2B2B34] overflow-hidden">
                        <div className="h-full bg-[#7656D6]" style={{ width: `${(count / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34]">
              <h2 className="font-display text-sm font-semibold mb-4">Findings by Category</h2>
              <div className="space-y-2.5 text-xs">
                {Object.entries(data.byCategory).map(([cat, count]) => {
                  const total = Math.max(1, Object.values(data.byCategory).reduce((a, b) => a + b, 0));
                  return (
                    <div key={cat}>
                      <div className="flex justify-between mb-1">
                        <span className="capitalize font-medium">{cat}</span>
                        <span className="font-mono tabular-nums">{count}</span>
                      </div>
                      <div className="h-1.5 rounded bg-[#E8E8ED] dark:bg-[#2B2B34] overflow-hidden">
                        <div className="h-full bg-[#7656D6]" style={{ width: `${(count / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34]">
              <h2 className="font-display text-sm font-semibold mb-4">Remediation Progress</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-[#777783]">Verified Resolved</div>
                  <div className="font-display text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {data.resolution.resolved}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#777783]">Unresolved Active Findings</div>
                  <div className="font-display text-3xl font-bold tabular-nums">
                    {data.resolution.unresolved}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] font-display text-sm font-semibold">
              Repository Health Comparison
            </div>
            <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
              {data.repositories.map((repo) => (
                <div key={repo.id} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">{repo.fullName}</div>
                    <div className="text-xs text-[#777783]">{repo.language}</div>
                  </div>
                  <div className="flex items-center gap-4 w-48">
                    <div className="flex-1 h-2 rounded bg-[#E8E8ED] dark:bg-[#2B2B34] overflow-hidden">
                      <div className="h-full bg-[#7656D6]" style={{ width: `${repo.healthScore ?? 0}%` }} />
                    </div>
                    <span className="font-mono text-xs font-semibold tabular-nums w-12 text-right">
                      {repo.healthScore !== null ? `${repo.healthScore}/100` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
