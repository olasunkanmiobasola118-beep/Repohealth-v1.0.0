import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface ArchitectureData {
  repositories: Array<{ id: number; fullName: string }>;
  selectedRepo: { id: number; fullName: string } | null;
  architecture: {
    nodes: Array<{
      id: string;
      label: string;
      directory: string;
      language: string;
      linesOfCode: number;
      isEntryPoint: boolean;
      inDegree: number;
      outDegree: number;
    }>;
    edges: Array<{ source: string; target: string }>;
    circularDependencies: string[][];
    entryPoints: string[];
    directories: Array<{ name: string; fileCount: number }>;
  } | null;
}

export function ArchitecturePage() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<ArchitectureData | null>(null);
  const [repoId, setRepoId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const qs = repoId ? `?repositoryId=${repoId}` : '';
    apiFetch<ArchitectureData>(`/api/architecture${qs}`)
      .then((res) => {
        setData(res);
        setError(null);
        if (!repoId && res.selectedRepo) setRepoId(String(res.selectedRepo.id));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load architecture graph.');
      })
      .finally(() => setLoading(false));
  }, [apiFetch, repoId]);

  const arch = data?.architecture;
  const nodes = arch?.nodes.slice(0, 16) || [];
  const edges = arch?.edges || [];

  // Deterministic radial layout for interactive SVG module dependency graph
  const cx = 360;
  const cy = 210;
  const rx = 250;
  const ry = 145;
  const coords = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, idx) => {
    const angle = (idx / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    coords.set(n.id, {
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  });

  const cycleNodes = new Set((arch?.circularDependencies || []).flat());

  return (
    <AppShell title="Architecture Explorer">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[#555562] dark:text-[#9898A6]">
            Static import graph, entry points, and circular dependency cycles extracted from source modules.
          </p>
          <select
            aria-label="Select repository for architecture view"
            value={repoId}
            onChange={(e) => setRepoId(e.target.value)}
            className="px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm"
          >
            {(data?.repositories || []).map((r) => (
              <option key={r.id} value={r.id}>{r.fullName}</option>
            ))}
          </select>
        </div>

        {error ? (
          <div role="alert" className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="p-8 text-sm text-[#777783]">Loading module graph...</div>
        ) : !arch ? (
          <div className="p-10 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] text-center text-sm text-[#777783]">
            No completed architecture scan for this repository yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg p-4 bg-[#F8F8FA] dark:bg-[#19191F]">
                <div className="text-xs font-semibold mb-3">Module Import Graph</div>
                <svg viewBox="0 0 720 420" className="w-full h-[360px] bg-white dark:bg-[#101014] rounded border border-[#E8E8ED] dark:border-[#2B2B34]">
                  {edges.map((e, idx) => {
                    const from = coords.get(e.source);
                    const to = coords.get(e.target);
                    if (!from || !to) return null;
                    const isCyclic = cycleNodes.has(e.source) && cycleNodes.has(e.target);
                    return (
                      <line
                        key={idx}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke={isCyclic ? '#DC2626' : '#7656D6'}
                        strokeOpacity={isCyclic ? 0.85 : 0.4}
                        strokeWidth={isCyclic ? 2 : 1.2}
                      />
                    );
                  })}
                  {nodes.map((n) => {
                    const pos = coords.get(n.id);
                    if (!pos) return null;
                    const isCyclic = cycleNodes.has(n.id);
                    return (
                      <g key={n.id} transform={`translate(${pos.x},${pos.y})`}>
                        <circle
                          r={n.isEntryPoint ? 11 : 8}
                          fill={isCyclic ? '#DC2626' : n.isEntryPoint ? '#7656D6' : '#4B5563'}
                        />
                        <text
                          y={20}
                          textAnchor="middle"
                          className="fill-[#17171C] dark:fill-[#F4F4F6] text-[10px] font-mono"
                        >
                          {n.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34]">
                  <div className="text-xs font-semibold mb-2">Entry Points</div>
                  {arch.entryPoints.length === 0 ? (
                    <div className="text-xs text-[#777783]">None detected</div>
                  ) : (
                    <ul className="space-y-1 font-mono text-xs">
                      {arch.entryPoints.map((ep) => (
                        <li key={ep}>{ep}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-4 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34]">
                  <div className="text-xs font-semibold mb-2">Circular Dependencies ({arch.circularDependencies.length})</div>
                  {arch.circularDependencies.length === 0 ? (
                    <div className="text-xs text-emerald-700 dark:text-emerald-400">No circular import cycles detected.</div>
                  ) : (
                    <ul className="space-y-2 font-mono text-xs text-red-600 dark:text-red-400">
                      {arch.circularDependencies.map((c, idx) => (
                        <li key={idx}>{c.join(' -> ')}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="p-4 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34]">
                  <div className="text-xs font-semibold mb-2">Directory Structure</div>
                  <div className="space-y-1.5 text-xs">
                    {arch.directories.slice(0, 8).map((d) => (
                      <div key={d.name} className="flex justify-between font-mono">
                        <span className="truncate">{d.name}</span>
                        <span className="tabular-nums text-[#777783]">{d.fileCount} files</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
