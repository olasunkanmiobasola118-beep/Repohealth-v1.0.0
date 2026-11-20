import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface DepItem {
  name: string;
  version: string;
  ecosystem: string;
  scope: string;
  filePath: string;
  license?: string;
  repositoryName: string;
  outdatedHint?: string;
  vulnerabilities: Array<{ id: string; summary: string; severity: string; fixedVersion?: string }>;
}

export function DependenciesPage() {
  const { apiFetch } = useAuth();
  const [deps, setDeps] = useState<DepItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'vulnerable'>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ dependencies: DepItem[] }>('/api/dependencies')
      .then((res) => {
        setDeps(res.dependencies);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dependencies.');
      })
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const filtered = deps.filter((d) =>
    filter === 'vulnerable' ? d.vulnerabilities.length > 0 || Boolean(d.outdatedHint) : true
  );

  return (
    <AppShell title="Dependencies">
      <div className="space-y-5">
        {error ? (
          <div role="alert" className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 rounded-md bg-[#F8F8FA] dark:bg-[#19191F] border border-[#E8E8ED] dark:border-[#2B2B34]">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                filter === 'all' ? 'bg-white dark:bg-[#101014] border border-[#E8E8ED] dark:border-[#2B2B34]' : 'text-[#777783]'
              }`}
            >
              All Packages ({deps.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('vulnerable')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                filter === 'vulnerable' ? 'bg-white dark:bg-[#101014] border border-[#E8E8ED] dark:border-[#2B2B34]' : 'text-[#777783]'
              }`}
            >
              Advisories &amp; Warnings
            </button>
          </div>
        </div>

        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#777783]">Loading dependency inventory...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#777783]">No dependencies match this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] text-xs text-[#777783]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Package</th>
                    <th className="py-3 px-4 font-semibold">Version</th>
                    <th className="py-3 px-4 font-semibold">Ecosystem</th>
                    <th className="py-3 px-4 font-semibold">Repository</th>
                    <th className="py-3 px-4 font-semibold">License</th>
                    <th className="py-3 px-4 font-semibold">Advisory Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {filtered.map((d, idx) => (
                    <tr key={`${d.repositoryName}-${d.name}-${idx}`}>
                      <td className="py-3 px-4 font-mono font-semibold text-xs">{d.name}</td>
                      <td className="py-3 px-4 font-mono text-xs tabular-nums">{d.version}</td>
                      <td className="py-3 px-4 text-xs">{d.ecosystem} ({d.scope})</td>
                      <td className="py-3 px-4 text-xs">{d.repositoryName}</td>
                      <td className="py-3 px-4 text-xs font-mono">{d.license || '—'}</td>
                      <td className="py-3 px-4 text-xs">
                        {d.vulnerabilities.length > 0 ? (
                          <span className="text-red-600 dark:text-red-400 font-semibold">
                            {d.vulnerabilities.map((v) => v.id).join(', ')}
                          </span>
                        ) : d.outdatedHint ? (
                          <span className="text-amber-600 dark:text-amber-400">{d.outdatedHint}</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">No known CVEs</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
