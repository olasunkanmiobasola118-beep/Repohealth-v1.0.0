import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Check, CheckCircle2, GitPullRequest, ShieldCheck, X, XCircle } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { DiffViewer } from '../../components/DiffViewer';
import { StatusLabel } from '../../components/SeverityTag';
import { useAuth } from '../../context/AuthContext';

interface FixRecord {
  id: number;
  findingId: number;
  repositoryId: number;
  provider: string;
  model: string;
  filePath: string;
  originalCode: string;
  proposedCode: string;
  unifiedDiff: string;
  rationale: string;
  status: string;
  prUrl: string | null;
  prNumber: number | null;
  branchName: string | null;
  finding: {
    id: number;
    ruleId: string;
    title: string;
    severity: string;
  } | null;
  repository: {
    id: number;
    fullName: string;
  } | null;
  latestVerification: {
    id: number;
    passed: boolean;
    originalFindingPresent: boolean;
    summary: string;
    checksJson: Array<{ name: string; status: 'passed' | 'failed' | 'skipped'; details: string }>;
    executedAt: string;
  } | null;
}

export function FixCenterPage() {
  const [searchParams] = useSearchParams();
  const { apiFetch } = useAuth();
  const [fixes, setFixes] = useState<FixRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get('fixId') ? Number(searchParams.get('fixId')) : null
  );
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [confirmApproveOpen, setConfirmApproveOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ fixes: FixRecord[] }>('/api/fixes');
      setFixes(res.fixes);
      setSelectedId((prev) => prev ?? res.fixes[0]?.id ?? null);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load proposed fixes.' });
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const fixParam = searchParams.get('fixId');

  useEffect(() => {
    if (fixParam) {
      const parsed = Number(fixParam);
      if (Number.isInteger(parsed) && parsed > 0) {
        setSelectedId(parsed);
      }
    }
  }, [fixParam]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = fixes.find((f) => f.id === selectedId) || null;

  const handleApprove = async () => {
    if (!selected) return;
    setBusyAction('approve');
    setFeedback(null);
    try {
      await apiFetch(`/api/fixes/${selected.id}/approve`, { method: 'POST' });
      setConfirmApproveOpen(false);
      setFeedback({ type: 'success', text: 'Patch approved. You can now run deterministic verification or open a GitHub Pull Request.' });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Approval failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setBusyAction('reject');
    setFeedback(null);
    try {
      await apiFetch(`/api/fixes/${selected.id}/reject`, { method: 'POST' });
      setFeedback({ type: 'success', text: 'Proposed patch rejected. Original code left untouched.' });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Reject failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleVerify = async () => {
    if (!selected) return;
    setBusyAction('verify');
    setFeedback(null);
    try {
      const res = await apiFetch<{ passed: boolean; verification: { summary: string } }>(
        `/api/fixes/${selected.id}/verify`,
        { method: 'POST' }
      );
      setFeedback({
        type: res.passed ? 'success' : 'error',
        text: res.verification.summary,
      });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Verification check failed.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenPr = async () => {
    if (!selected) return;
    setBusyAction('pr');
    setFeedback(null);
    try {
      const res = await apiFetch<{ pr: { prUrl: string; prNumber: number } }>(
        `/api/fixes/${selected.id}/apply-pr`,
        { method: 'POST' }
      );
      setFeedback({ type: 'success', text: `Pull Request #${res.pr.prNumber} created on GitHub.` });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Unable to open Pull Request.' });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <AppShell title="AI Fix Center">
      {loading ? (
        <div className="p-8 text-sm text-[#777783]">Loading proposed patches...</div>
      ) : fixes.length === 0 ? (
        <div className="p-10 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] text-center space-y-2">
          <p className="text-sm font-medium">No proposed fixes yet.</p>
          <p className="text-xs text-[#777783]">
            Open any finding in AI Diagnosis and click &ldquo;Propose Fix&rdquo; to inspect diffs and run verification checks here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden max-h-[78vh] flex flex-col">
            <div className="px-4 py-3 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] text-xs font-semibold">
              Proposed Patches ({fixes.length})
            </div>
            <div className="overflow-y-auto divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
              {fixes.map((fx) => (
                <button
                  key={fx.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(fx.id);
                    setConfirmApproveOpen(false);
                    setFeedback(null);
                  }}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    fx.id === selectedId
                      ? 'bg-[#7656D6]/8 dark:bg-[#7656D6]/15'
                      : 'hover:bg-[#F8F8FA] dark:hover:bg-[#19191F]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusLabel status={fx.status} />
                    <span className="font-mono text-[11px] text-[#777783]">#{fx.id}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium truncate">
                    {fx.finding?.title || fx.filePath}
                  </div>
                  <div className="mt-0.5 text-xs font-mono text-[#777783] truncate">
                    {fx.repository?.fullName} · {fx.filePath}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-5">
            {selected ? (
              <>
                <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-[#777783]">
                        <StatusLabel status={selected.status} />
                        <span>·</span>
                        <span className="font-mono">{selected.provider} / {selected.model}</span>
                      </div>
                      <h2 className="mt-1 font-display text-lg font-bold">
                        {selected.finding?.title || selected.filePath}
                      </h2>
                      <p className="mt-1 text-xs text-[#555562] dark:text-[#9898A6]">
                        {selected.rationale}
                      </p>
                    </div>
                  </div>

                  {feedback ? (
                    <div
                      role={feedback.type === 'error' ? 'alert' : 'status'}
                      className={`p-3 rounded-md text-xs border ${
                        feedback.type === 'error'
                          ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                          : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {feedback.text}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2.5">
                    {selected.status === 'proposed' || selected.status === 'rejected' ? (
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={() => setConfirmApproveOpen(true)}
                        className="glass-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Approve Patch</span>
                      </button>
                    ) : null}

                    {selected.status !== 'rejected' && selected.status !== 'applied' ? (
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={handleReject}
                        className="glass-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold hover:!border-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Reject</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      disabled={Boolean(busyAction)}
                      onClick={handleVerify}
                      className="glass-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-[#7656D6]" />
                      <span>{busyAction === 'verify' ? 'Verifying...' : 'Run Verification Checks'}</span>
                    </button>

                    {(selected.status === 'approved' || selected.status === 'verified') && !selected.prUrl ? (
                      <button
                        type="button"
                        disabled={Boolean(busyAction)}
                        onClick={handleOpenPr}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                      >
                        <GitPullRequest className="h-3.5 w-3.5" />
                        <span>{busyAction === 'pr' ? 'Opening PR...' : 'Create GitHub Pull Request'}</span>
                      </button>
                    ) : null}
                  </div>

                  {confirmApproveOpen ? (
                    <div className="p-4 rounded-md border border-[#7656D6] bg-white dark:bg-[#101014] space-y-3">
                      <div className="text-xs font-semibold">Confirm Human Approval</div>
                      <p className="text-xs text-[#555562] dark:text-[#9898A6]">
                        I have reviewed the diff for <code className="font-mono">{selected.filePath}</code> and approve this patch for verification and optional Pull Request submission.
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleApprove}
                          disabled={busyAction === 'approve'}
                          className="glass-btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                        >
                          {busyAction === 'approve' ? 'Approving...' : 'Confirm Approval'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmApproveOpen(false)}
                          className="glass-btn-secondary px-3.5 py-1.5 rounded-lg text-xs font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {selected.prUrl ? (
                    <div className="text-xs font-mono text-[#7656D6]">
                      PR #{selected.prNumber} on branch {selected.branchName} · {selected.prUrl}
                    </div>
                  ) : null}
                </div>

                {/* Diff Viewer */}
                <DiffViewer
                  filePath={selected.filePath}
                  originalCode={selected.originalCode}
                  proposedCode={selected.proposedCode}
                />

                {/* Verification Results */}
                {selected.latestVerification ? (
                  <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-display text-sm font-semibold">
                        {selected.latestVerification.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span>Verification Report</span>
                      </div>
                      <span className="font-mono text-xs text-[#777783]">
                        {new Date(selected.latestVerification.executedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-[#555562] dark:text-[#9898A6]">
                      {selected.latestVerification.summary}
                    </p>
                    <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34] border border-[#E8E8ED] dark:border-[#2B2B34] rounded-md">
                      {selected.latestVerification.checksJson.map((chk, idx) => (
                        <div key={idx} className="px-3.5 py-2.5 flex items-start justify-between gap-4 text-xs">
                          <div>
                            <div className="font-semibold">{chk.name}</div>
                            <div className="text-[#777783] mt-0.5">{chk.details}</div>
                          </div>
                          <span
                            className={`font-mono uppercase font-semibold shrink-0 ${
                              chk.status === 'passed'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : chk.status === 'failed'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-[#777783]'
                            }`}
                          >
                            {chk.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}
