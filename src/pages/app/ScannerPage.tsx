import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Play, ScanSearch } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface RepoOption {
  id: number;
  fullName: string;
  defaultBranch: string;
}

interface ScanJob {
  id: number;
  repositoryId: number;
  branch: string;
  scanType: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  currentStage: string;
  progressPct: number;
  filesAnalyzed: number;
  totalFiles: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  healthScore: number | null;
  skippedChecksJson: string[];
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

const ANALYZERS = [
  { id: 'secret-scanner', label: 'Secret & Credential Scanner' },
  { id: 'static-ast', label: 'Static Security Pattern & OWASP Analyzer' },
  { id: 'osv-audit', label: 'Dependency & OSV Vulnerability Audit' },
  { id: 'complexity-analyzer', label: 'Code Quality, Complexity & Duplication' },
  { id: 'architecture-analyzer', label: 'Module Dependency Graph & Structure' },
];

export function ScannerPage() {
  const [searchParams] = useSearchParams();
  const { apiFetch } = useAuth();
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>(searchParams.get('repoId') || '');
  const [branch, setBranch] = useState<string>(searchParams.get('branch') || 'main');
  const [scanType, setScanType] = useState<string>('full');
  const [enabledAnalyzers, setEnabledAnalyzers] = useState<string[]>(ANALYZERS.map((a) => a.id));
  const [activeJob, setActiveJob] = useState<ScanJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialRepoParam = searchParams.get('repoId') || '';
  const initialBranchParam = searchParams.get('branch') || '';

  useEffect(() => {
    apiFetch<{ repositories: RepoOption[] }>('/api/repositories')
      .then((res) => {
        setRepos(res.repositories);
        setSelectedRepoId((current) => {
          const targetId = current || initialRepoParam || (res.repositories[0] ? String(res.repositories[0].id) : '');
          const match = res.repositories.find((r) => String(r.id) === targetId);
          if (match && !initialBranchParam) {
            setBranch(match.defaultBranch);
          }
          return targetId;
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load repositories.');
      });
  }, [apiFetch, initialRepoParam, initialBranchParam]);

  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'queued' && activeJob.status !== 'running')) return;
    const timer = setInterval(async () => {
      try {
        const res = await apiFetch<{ scan: ScanJob }>(`/api/scans/${activeJob.id}`);
        setActiveJob(res.scan);
      } catch {
        // ignore transient poll error
      }
    }, 900);
    return () => clearInterval(timer);
  }, [activeJob, apiFetch]);

  const toggleAnalyzer = (id: string) => {
    setEnabledAnalyzers((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleStartScan = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRepoId) {
      setError('Please select a repository first.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<{ scanJob: ScanJob }>('/api/scans/start', {
        method: 'POST',
        body: JSON.stringify({
          repositoryId: Number(selectedRepoId),
          branch: branch.trim() || 'main',
          scanType,
          enabledAnalyzers,
        }),
      });
      setActiveJob(res.scanJob);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start scan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell title="Repository Scanner">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={handleStartScan}
          className="lg:col-span-2 p-6 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] space-y-5"
        >
          <div>
            <h2 className="font-display text-base font-semibold">Configure Deterministic Scan</h2>
            <p className="text-xs text-[#777783] dark:text-[#9898A6] mt-0.5">
              Select target repository, branch, and scanning scope. Execution runs asynchronously in the background.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="scan-repo" className="block text-xs font-semibold mb-1.5">Repository</label>
              <select
                id="scan-repo"
                value={selectedRepoId}
                onChange={(e) => {
                  setSelectedRepoId(e.target.value);
                  const found = repos.find((r) => String(r.id) === e.target.value);
                  if (found) setBranch(found.defaultBranch);
                }}
                className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm"
              >
                {repos.length === 0 ? (
                  <option value="">No repositories imported</option>
                ) : (
                  repos.map((r) => (
                    <option key={r.id} value={r.id}>{r.fullName}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label htmlFor="scan-branch" className="block text-xs font-semibold mb-1.5">Branch</label>
              <input
                id="scan-branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold mb-2">Scan Profile</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'full', label: 'Full Repository' },
                { id: 'security', label: 'Security Only' },
                { id: 'quality', label: 'Code Quality' },
                { id: 'dependency', label: 'Dependencies' },
                { id: 'architecture', label: 'Architecture' },
                { id: 'custom', label: 'Custom Analyzers' },
              ].map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setScanType(profile.id)}
                  className={`px-3 py-2 rounded-md text-xs font-medium border text-left transition-colors ${
                    scanType === profile.id
                      ? 'border-[#7656D6] bg-white dark:bg-[#101014] text-[#7656D6] font-semibold'
                      : 'border-[#E8E8ED] dark:border-[#2B2B34] bg-white/60 dark:bg-[#101014]/60 text-[#555562] dark:text-[#9898A6]'
                  }`}
                >
                  {profile.label}
                </button>
              ))}
            </div>
          </div>

          {scanType === 'custom' ? (
            <div className="space-y-2 pt-2 border-t border-[#E8E8ED] dark:border-[#2B2B34]">
              <span className="block text-xs font-semibold">Select Active Analyzers</span>
              {ANALYZERS.map((a) => (
                <label key={a.id} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabledAnalyzers.includes(a.id)}
                    onChange={() => toggleAnalyzer(a.id)}
                    className="rounded border-[#E8E8ED]"
                  />
                  <span>{a.label}</span>
                </label>
              ))}
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="p-3 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          ) : null}

          {repos.length === 0 ? (
            <div className="p-3 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-xs text-[#555562] dark:text-[#9898A6] flex items-center justify-between gap-3">
              <span>No repositories imported in this workspace yet.</span>
              <Link to="/app/repositories" className="font-semibold text-[#7656D6] hover:underline whitespace-nowrap">
                Import Repository →
              </Link>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || repos.length === 0}
            className="glass-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-lg disabled:opacity-60 text-sm font-semibold"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span>{submitting ? 'Queuing Scan...' : 'Start Repository Scan'}</span>
          </button>
        </form>

        {/* Live Scan Status Panel */}
        <div className="p-6 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] space-y-5">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold">Live Execution Status</h2>
          </div>

          {!activeJob ? (
            <p className="text-sm text-[#777783] dark:text-[#9898A6]">
              Start a scan job on the left to observe live pipeline stages, file counts, skipped checks, and resulting health score.
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium">{activeJob.currentStage}</span>
                  <span className="font-mono tabular-nums">{activeJob.progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-[#E8E8ED] dark:bg-[#2B2B34] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      activeJob.status === 'failed' ? 'bg-red-600' : 'bg-[#7656D6]'
                    }`}
                    style={{ width: `${activeJob.progressPct}%` }}
                  />
                </div>
              </div>

              <dl className="space-y-2 text-xs border-t border-[#E8E8ED] dark:border-[#2B2B34] pt-4">
                <div className="flex justify-between">
                  <dt className="text-[#777783]">Status</dt>
                  <dd className="font-mono font-semibold uppercase">{activeJob.status}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#777783]">Files Analyzed</dt>
                  <dd className="font-mono tabular-nums">{activeJob.filesAnalyzed} / {activeJob.totalFiles}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#777783]">Findings Discovered</dt>
                  <dd className="font-mono tabular-nums">{activeJob.findingsCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#777783]">Health Score</dt>
                  <dd className="font-mono font-semibold tabular-nums">
                    {activeJob.healthScore !== null ? `${activeJob.healthScore}/100` : 'Pending'}
                  </dd>
                </div>
              </dl>

              {activeJob.errorMessage ? (
                <div role="alert" className="p-3 rounded border border-red-300 text-xs text-red-600">
                  {activeJob.errorMessage}
                </div>
              ) : null}

              {activeJob.skippedChecksJson?.length ? (
                <div className="p-3 rounded bg-[#F8F8FA] dark:bg-[#19191F] text-xs text-[#777783]">
                  <div className="font-semibold text-[#17171C] dark:text-[#F4F4F6] mb-1">Skipped / Notes</div>
                  {activeJob.skippedChecksJson.map((s, idx) => (
                    <div key={idx}>{s}</div>
                  ))}
                </div>
              ) : null}

              {activeJob.status === 'completed' ? (
                <div className="pt-2 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Scan persisted to PostgreSQL</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/app/repositories/${activeJob.repositoryId}`}
                      className="text-xs font-semibold text-[#7656D6] hover:underline"
                    >
                      View Findings
                    </Link>
                    <Link
                      to="/app/diagnosis"
                      className="text-xs font-semibold text-[#7656D6] hover:underline"
                    >
                      Open AI Doctor
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
