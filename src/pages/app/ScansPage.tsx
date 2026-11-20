import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface ScanRecord {
  id: number;
  repositoryId: number;
  repositoryName: string;
  branch: string;
  scanType: string;
  status: string;
  filesAnalyzed: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  healthScore: number | null;
  createdAt: string;
  completedAt: string | null;
}

export function ScansPage() {
  const { apiFetch } = useAuth();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [rescanningId, setRescanningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ scans: ScanRecord[] }>('/api/scans');
      setScans(res.scans);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scan history.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [load]);

  const toggleCompare = (id: number) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleRescan = async (scan: ScanRecord) => {
    setRescanningId(scan.id);
    setError(null);
    try {
      await apiFetch('/api/scans/start', {
        method: 'POST',
        body: JSON.stringify({
          repositoryId: scan.repositoryId,
          branch: scan.branch,
          scanType: scan.scanType,
        }),
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        void load();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue rescan.');
    } finally {
      setRescanningId(null);
    }
  };

  const compared = compareIds.map((id) => scans.find((s) => s.id === id)).filter(Boolean) as ScanRecord[];

  return (
    <AppShell title="Scan History">
      <div className="space-y-6">
        {error ? (
          <div role="alert" className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
        {compared.length === 2 ? (
          <div className="p-5 rounded-lg border border-[#7656D6] bg-[#F8F8FA] dark:bg-[#19191F]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-sm font-semibold">Scan Comparison</h2>
              <button type="button" onClick={() => setCompareIds([])} className="text-xs text-[#777783] hover:underline">
                Clear comparison
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-[#777783]">Baseline Scan #{compared[0].id}</div>
                <div className="font-semibold mt-0.5">{compared[0].repositoryName} ({compared[0].branch})</div>
                <div className="font-mono mt-1 tabular-nums">Score: {compared[0].healthScore ?? '—'} · Findings: {compared[0].findingsCount}</div>
              </div>
              <div>
                <div className="text-[#777783]">Target Scan #{compared[1].id}</div>
                <div className="font-semibold mt-0.5">{compared[1].repositoryName} ({compared[1].branch})</div>
                <div className="font-mono mt-1 tabular-nums">Score: {compared[1].healthScore ?? '—'} · Findings: {compared[1].findingsCount}</div>
              </div>
              <div>
                <div className="text-[#777783]">Delta</div>
                <div className="font-mono text-base font-bold mt-1 tabular-nums">
                  {compared[1].healthScore !== null && compared[0].healthScore !== null
                    ? `${compared[1].healthScore - compared[0].healthScore >= 0 ? '+' : ''}${compared[1].healthScore - compared[0].healthScore} pts`
                    : 'N/A'}
                </div>
                <div className="font-mono text-[#777783] tabular-nums">
                  Findings delta: {compared[1].findingsCount - compared[0].findingsCount}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#777783]">Loading scan history...</div>
          ) : scans.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#777783]">No scans executed yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] text-xs text-[#777783]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Compare</th>
                    <th className="py-3 px-4 font-semibold">Repository</th>
                    <th className="py-3 px-4 font-semibold">Type / Branch</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Files</th>
                    <th className="py-3 px-4 font-semibold text-right">Findings</th>
                    <th className="py-3 px-4 font-semibold text-right">Score</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {scans.map((s) => (
                    <tr key={s.id} className="hover:bg-[#F8F8FA]/60 dark:hover:bg-[#19191F]/60">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          aria-label={`Compare scan ${s.id}`}
                          checked={compareIds.includes(s.id)}
                          onChange={() => toggleCompare(s.id)}
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{s.repositoryName}</div>
                        <div className="text-xs text-[#777783] font-mono tabular-nums">
                          {new Date(s.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">{s.scanType} · {s.branch}</td>
                      <td className="py-3 px-4 text-xs uppercase font-mono">{s.status}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{s.filesAnalyzed}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{s.findingsCount}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        {s.healthScore !== null ? `${s.healthScore}/100` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          disabled={rescanningId === s.id}
                          onClick={() => handleRescan(s)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#7656D6] hover:underline"
                        >
                          <RefreshCw className="h-3 w-3" />
                          <span>Rescan</span>
                        </button>
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
