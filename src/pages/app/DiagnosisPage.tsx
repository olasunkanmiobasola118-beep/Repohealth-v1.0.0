import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Stethoscope, Wrench } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SeverityLabel, StatusLabel } from '../../components/SeverityTag';
import { useAuth } from '../../context/AuthContext';

interface FindingWithMeta {
  id: number;
  repositoryId: number;
  repositoryName: string;
  ruleId: string;
  category: string;
  severity: string;
  confidence: string;
  scannerEngine: string;
  title: string;
  description: string;
  whyItMatters: string;
  filePath: string;
  lineStart: number;
  codeExcerpt: string;
  status: string;
  diagnosis: {
    id: number;
    provider: string;
    model: string;
    rootCause: string;
    explanation: string;
    whyItMatters: string;
    recommendedSolution: string;
    verificationRequirements: string;
    evidenceRefsJson: string[];
    confidenceNote: string;
    createdAt: string;
  } | null;
}

export function DiagnosisPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { apiFetch, session } = useAuth();
  const [findings, setFindings] = useState<FindingWithMeta[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get('findingId') ? Number(searchParams.get('findingId')) : null
  );
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [proposingFix, setProposingFix] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ findings: FindingWithMeta[] }>('/api/findings');
      setFindings(res.findings);
      setSelectedId((prev) => prev ?? res.findings[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load findings.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  const findingParam = searchParams.get('findingId');

  useEffect(() => {
    if (findingParam) {
      const parsed = Number(findingParam);
      if (Number.isInteger(parsed) && parsed > 0) {
        setSelectedId(parsed);
      }
    }
  }, [findingParam]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = findings.find((f) => f.id === selectedId) || null;

  const handleRunDiagnosis = async () => {
    if (!selected) return;
    setDiagnosing(true);
    setError(null);
    try {
      const res = await apiFetch<{ diagnosis: FindingWithMeta['diagnosis'] }>('/api/ai/diagnose', {
        method: 'POST',
        body: JSON.stringify({ findingId: selected.id }),
      });
      setFindings((prev) =>
        prev.map((f) =>
          f.id === selected.id
            ? { ...f, status: f.status === 'open' ? 'diagnosed' : f.status, diagnosis: res.diagnosis }
            : f
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI Doctor diagnosis failed.');
    } finally {
      setDiagnosing(false);
    }
  };

  const handleProposeFix = async () => {
    if (!selected) return;
    setProposingFix(true);
    setError(null);
    try {
      const res = await apiFetch<{ fix: { id: number } }>('/api/ai/propose-fix', {
        method: 'POST',
        body: JSON.stringify({ findingId: selected.id }),
      });
      navigate(`/app/fix-center?fixId=${res.fix.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate proposed fix.');
    } finally {
      setProposingFix(false);
    }
  };

  return (
    <AppShell title="AI Doctor · Diagnosis">
      {loading ? (
        <div className="p-8 text-sm text-[#777783]">Loading scanner findings...</div>
      ) : findings.length === 0 ? (
        <div className="p-10 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] text-center text-sm text-[#777783]">
          No findings available yet. Run a repository scan to inspect issues with AI Doctor.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Findings Queue */}
          <div className="lg:col-span-4 border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden max-h-[78vh] flex flex-col">
            <div className="px-4 py-3 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] text-xs font-semibold">
              Scanner Findings ({findings.length})
            </div>
            <div className="overflow-y-auto divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
              {findings.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedId(f.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    f.id === selectedId
                      ? 'bg-[#7656D6]/8 dark:bg-[#7656D6]/15'
                      : 'hover:bg-[#F8F8FA] dark:hover:bg-[#19191F]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <SeverityLabel severity={f.severity} />
                    <span className="font-mono text-[11px] text-[#777783]">{f.ruleId}</span>
                  </div>
                  <div className="mt-1 text-sm font-medium line-clamp-1">{f.title}</div>
                  <div className="mt-0.5 text-xs font-mono text-[#777783] truncate">
                    {f.repositoryName} · {f.filePath}:{f.lineStart}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Finding & AI Diagnosis */}
          <div className="lg:col-span-8 space-y-6">
            {selected ? (
              <>
                <div className="p-6 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 text-xs text-[#777783]">
                        <SeverityLabel severity={selected.severity} />
                        <span>·</span>
                        <span className="capitalize">{selected.confidence} ({selected.scannerEngine})</span>
                        <span>·</span>
                        <StatusLabel status={selected.status} />
                      </div>
                      <h2 className="mt-2 font-display text-xl font-bold">{selected.title}</h2>
                      <div className="mt-1 font-mono text-xs text-[#777783]">
                        {selected.repositoryName} · {selected.filePath}:{selected.lineStart}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={diagnosing}
                        onClick={handleRunDiagnosis}
                        className="glass-btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-60 text-xs font-semibold whitespace-nowrap"
                      >
                        <Stethoscope className="h-3.5 w-3.5" />
                        <span>{diagnosing ? 'Analyzing Evidence...' : selected.diagnosis ? 'Re-run AI Diagnosis' : 'Run AI Diagnosis'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={proposingFix}
                        onClick={handleProposeFix}
                        className="glass-btn-secondary inline-flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-60 text-xs font-semibold whitespace-nowrap"
                      >
                        <Wrench className="h-3.5 w-3.5 text-[#7656D6]" />
                        <span>{proposingFix ? 'Generating Patch...' : 'Propose Fix'}</span>
                      </button>
                    </div>
                  </div>

                  {error ? (
                    <div role="alert" className="p-3 rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
                      {error}
                    </div>
                  ) : null}

                  <div className="text-xs text-[#777783]">
                    Active Diagnosis Model: <span className="font-mono font-semibold text-[#17171C] dark:text-[#F4F4F6]">{session?.aiPreferences?.diagnosisModel || 'gemini-4-hydrogen'}</span>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#777783] mb-1.5">Deterministic Evidence Excerpt</div>
                    <pre className="p-4 rounded-md bg-[#F8F8FA] dark:bg-[#19191F] border border-[#E8E8ED] dark:border-[#2B2B34] font-mono text-xs overflow-x-auto leading-6">
                      {selected.codeExcerpt || 'No excerpt captured.'}
                    </pre>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2">
                    <div>
                      <div className="text-xs font-semibold text-[#777783]">Scanner Explanation</div>
                      <p className="mt-1 text-[#555562] dark:text-[#9898A6]">{selected.description}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[#777783]">Why It Matters</div>
                      <p className="mt-1 text-[#555562] dark:text-[#9898A6]">{selected.whyItMatters}</p>
                    </div>
                  </div>
                </div>

                {/* Structured AI Diagnosis Output */}
                {selected.diagnosis ? (
                  <div className="p-6 rounded-lg border border-[#7656D6]/50 bg-[#F8F8FA] dark:bg-[#19191F] space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-display text-base font-semibold">
                        <Sparkles className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
                        <span>AI Doctor Structured Diagnosis</span>
                      </div>
                      <span className="font-mono text-xs text-[#777783]">
                        {selected.diagnosis.provider} / {selected.diagnosis.model}
                      </span>
                    </div>

                    <div className="space-y-4 text-sm">
                      <div>
                        <h3 className="text-xs font-semibold text-[#777783]">Root Cause</h3>
                        <p className="mt-1 leading-relaxed">{selected.diagnosis.rootCause}</p>
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-[#777783]">Technical Explanation</h3>
                        <p className="mt-1 text-[#555562] dark:text-[#9898A6] leading-relaxed">{selected.diagnosis.explanation}</p>
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-[#777783]">Recommended Solution</h3>
                        <p className="mt-1 text-[#555562] dark:text-[#9898A6] leading-relaxed">{selected.diagnosis.recommendedSolution}</p>
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-[#777783]">Verification Requirements</h3>
                        <p className="mt-1 text-[#555562] dark:text-[#9898A6] leading-relaxed">{selected.diagnosis.verificationRequirements}</p>
                      </div>
                      {selected.diagnosis.evidenceRefsJson?.length ? (
                        <div>
                          <h3 className="text-xs font-semibold text-[#777783]">Evidence References</h3>
                          <ul className="mt-1 list-disc list-inside font-mono text-xs text-[#555562] dark:text-[#9898A6]">
                            {selected.diagnosis.evidenceRefsJson.map((ref, idx) => (
                              <li key={idx}>{ref}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {selected.diagnosis.confidenceNote ? (
                        <div className="text-xs text-[#777783] pt-2 border-t border-[#E8E8ED] dark:border-[#2B2B34]">
                          Confidence Note: {selected.diagnosis.confidenceNote}
                        </div>
                      ) : null}
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
