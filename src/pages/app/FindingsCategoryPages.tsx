import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { SeverityLabel, StatusLabel } from '../../components/SeverityTag';
import { useAuth } from '../../context/AuthContext';

interface FindingRow {
  id: number;
  repositoryName: string;
  category: string;
  severity: string;
  confidence: string;
  scannerEngine: string;
  ruleId: string;
  title: string;
  description: string;
  filePath: string;
  lineStart: number;
  status: string;
}

function FindingsExplorer({
  title,
  categories,
  emptyText,
}: {
  title: string;
  categories: string[];
  emptyText: string;
}) {
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sevFilter, setSevFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const categoriesKey = categories.join(',');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allowed = new Set(categoriesKey.split(',').filter(Boolean));
      const res = await apiFetch<{ findings: FindingRow[] }>('/api/findings');
      setItems(res.findings.filter((f) => allowed.has(f.category)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load findings.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, categoriesKey]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDismiss = async (row: FindingRow) => {
    setError(null);
    try {
      const next = row.status === 'dismissed' ? 'open' : 'dismissed';
      await apiFetch(`/api/findings/${row.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      setItems((prev) => prev.map((x) => (x.id === row.id ? { ...x, status: next } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update finding status.');
    }
  };

  const filtered = items.filter((i) => sevFilter === 'all' || i.severity === sevFilter);

  return (
    <AppShell title={title}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 rounded-md bg-[#F8F8FA] dark:bg-[#19191F] border border-[#E8E8ED] dark:border-[#2B2B34]">
            {['all', 'critical', 'high', 'medium', 'low', 'info'].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSevFilter(sev)}
                className={`px-3 py-1 rounded text-xs font-medium capitalize ${
                  sevFilter === sev
                    ? 'bg-white dark:bg-[#101014] text-[#17171C] dark:text-white border border-[#E8E8ED] dark:border-[#2B2B34]'
                    : 'text-[#777783]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
          <span className="text-xs font-mono text-[#777783] tabular-nums">{filtered.length} finding(s)</span>
        </div>

        {error ? (
          <div role="alert" className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#777783]">Loading findings...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#777783]">{emptyText}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] text-xs text-[#777783]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Finding</th>
                    <th className="py-3 px-4 font-semibold">Severity</th>
                    <th className="py-3 px-4 font-semibold">Scanner</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {filtered.map((f) => (
                    <tr key={f.id} className="hover:bg-[#F8F8FA]/60 dark:hover:bg-[#19191F]/60">
                      <td className="py-3 px-4">
                        <div className="font-semibold">{f.title}</div>
                        <div className="text-xs font-mono text-[#777783] mt-0.5">
                          {f.repositoryName} · {f.filePath}:{f.lineStart} · {f.ruleId}
                        </div>
                      </td>
                      <td className="py-3 px-4"><SeverityLabel severity={f.severity} /></td>
                      <td className="py-3 px-4 font-mono text-xs">{f.scannerEngine}</td>
                      <td className="py-3 px-4"><StatusLabel status={f.status} /></td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-3">
                        <Link to={`/app/diagnosis?findingId=${f.id}`} className="text-xs font-semibold text-[#7656D6] hover:underline">
                          AI Doctor
                        </Link>
                        {f.status === 'open' || f.status === 'dismissed' ? (
                          <button
                            type="button"
                            onClick={() => toggleDismiss(f)}
                            className="text-xs text-[#777783] hover:text-[#17171C] dark:hover:text-white"
                          >
                            {f.status === 'dismissed' ? 'Reopen' : 'Dismiss'}
                          </button>
                        ) : null}
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

export function SecurityCenterPage() {
  return (
    <FindingsExplorer
      title="Security Center"
      categories={['security']}
      emptyText="No security findings detected under current filter."
    />
  );
}

export function CodeQualityPage() {
  return (
    <FindingsExplorer
      title="Code Quality & Performance"
      categories={['quality', 'performance']}
      emptyText="No code quality or performance smells detected under current filter."
    />
  );
}
