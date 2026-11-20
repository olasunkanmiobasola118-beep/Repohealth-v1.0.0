import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, GitBranch, GitCommit, GitPullRequest, ScanSearch } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SeverityLabel, StatusLabel } from '../../components/SeverityTag';
import { useAuth } from '../../context/AuthContext';

interface RepoDetailResponse {
  repository: {
    id: number;
    fullName: string;
    description: string;
    defaultBranch: string;
    language: string;
    healthScore: number | null;
    status: string;
    htmlUrl: string;
    languagesJson: Record<string, number>;
  };
  branches: Array<{ id: number; name: string; commitSha: string; isDefault: boolean }>;
  scans: Array<{
    id: number;
    branch: string;
    scanType: string;
    status: string;
    findingsCount: number;
    healthScore: number | null;
    createdAt: string;
  }>;
  findings: Array<{
    id: number;
    title: string;
    severity: string;
    category: string;
    filePath: string;
    lineStart: number;
    status: string;
  }>;
  pullRequests: Array<{ number: number; title: string; author: string; branch: string; state: string }>;
  commits: Array<{ sha: string; message: string; author: string; date: string }>;
}

export function RepositoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [data, setData] = useState<RepoDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('main');

  useEffect(() => {
    setLoading(true);
    apiFetch<RepoDetailResponse>(`/api/repositories/${id}`)
      .then((res) => {
        setData(res);
        setSelectedBranch(res.repository.defaultBranch);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load repository.'))
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  return (
    <AppShell title={data?.repository.fullName || 'Repository Details'}>
      {loading ? (
        <div className="p-8 text-sm text-[#777783]">Loading repository telemetry...</div>
      ) : error || !data ? (
        <div role="alert" className="p-4 rounded-lg border border-red-300 text-sm text-red-700">
          {error || 'Repository not found.'}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                to="/app/repositories"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#777783] hover:text-[#17171C] dark:hover:text-white mb-2"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Repositories</span>
              </Link>
              <h2 className="font-display text-2xl font-bold">{data.repository.fullName}</h2>
              <p className="text-sm text-[#555562] dark:text-[#9898A6] mt-1">
                {data.repository.description || 'Connected repository'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label htmlFor="detail-branch" className="sr-only">Select branch</label>
              <select
                id="detail-branch"
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-xs font-mono"
              >
                {data.branches.length > 0 ? (
                  data.branches.map((b) => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))
                ) : (
                  <option value={data.repository.defaultBranch}>{data.repository.defaultBranch}</option>
                )}
              </select>
              <button
                type="button"
                onClick={() => navigate(`/app/scanner?repoId=${data.repository.id}&branch=${encodeURIComponent(selectedBranch)}`)}
                className="glass-btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
              >
                <ScanSearch className="h-3.5 w-3.5" />
                <span>Scan Branch</span>
              </button>
            </div>
          </div>

          {/* Overview Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="text-xs text-[#777783]">Health Score</div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">
                {data.repository.healthScore !== null ? `${data.repository.healthScore}/100` : 'Unscanned'}
              </div>
            </div>
            <div className="p-4 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="text-xs text-[#777783]">Condition</div>
              <div className="mt-2"><StatusLabel status={data.repository.status} /></div>
            </div>
            <div className="p-4 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="text-xs text-[#777783]">Findings</div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">{data.findings.length}</div>
            </div>
            <div className="p-4 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="text-xs text-[#777783]">Open Pull Requests</div>
              <div className="mt-1 font-display text-2xl font-bold tabular-nums">{data.pullRequests.length}</div>
            </div>
          </div>

          {/* Findings + PRs & Commits */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] font-display text-sm font-semibold">
                Repository Findings
              </div>
              {data.findings.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#777783]">No findings recorded for this repository yet.</div>
              ) : (
                <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {data.findings.map((f) => (
                    <div key={f.id} className="px-4 py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{f.title}</div>
                        <div className="text-xs font-mono text-[#777783] mt-0.5 truncate">
                          {f.category} · {f.filePath}:{f.lineStart}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <SeverityLabel severity={f.severity} />
                        <StatusLabel status={f.status} />
                        <Link
                          to={`/app/diagnosis?findingId=${f.id}`}
                          className="text-xs font-semibold text-[#7656D6] hover:underline"
                        >
                          Diagnose
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] flex items-center gap-2 font-display text-sm font-semibold">
                  <GitPullRequest className="h-4 w-4 text-[#7656D6]" />
                  <span>Pull Requests</span>
                </div>
                <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {data.pullRequests.length === 0 ? (
                    <div className="p-4 text-xs text-[#777783]">No open pull requests.</div>
                  ) : (
                    data.pullRequests.map((pr) => (
                      <div key={pr.number} className="p-3.5 text-xs">
                        <div className="font-semibold">#{pr.number} {pr.title}</div>
                        <div className="text-[#777783] mt-1 font-mono">
                          <GitBranch className="inline h-3 w-3 mr-1" />
                          {pr.branch} · @{pr.author}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] flex items-center gap-2 font-display text-sm font-semibold">
                  <GitCommit className="h-4 w-4 text-[#7656D6]" />
                  <span>Recent Commits</span>
                </div>
                <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {data.commits.length === 0 ? (
                    <div className="p-4 text-xs text-[#777783]">No commits retrieved.</div>
                  ) : (
                    data.commits.slice(0, 5).map((c) => (
                      <div key={c.sha} className="p-3.5 text-xs">
                        <div className="font-medium truncate">{c.message}</div>
                        <div className="text-[#777783] mt-0.5 font-mono">{c.sha} · {c.author}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
