import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Download, FileText } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface ReportRecord {
  id: number;
  reportType: string;
  title: string;
  createdAt: string;
  summaryJson: {
    generatedAt: string;
    scope: string;
    healthScore: number | null;
    totalFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    resolved: number;
    topFindings: Array<{
      ruleId: string;
      title: string;
      severity: string;
      filePath: string;
      lineStart: number;
      status: string;
    }>;
  };
}

export function ReportsPage() {
  const { apiFetch } = useAuth();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [repos, setRepos] = useState<Array<{ id: number; fullName: string }>>([]);
  const [repoId, setRepoId] = useState('');
  const [reportType, setReportType] = useState('health');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ reports: ReportRecord[]; repositories: Array<{ id: number; fullName: string }> }>('/api/reports');
      setReports(res.reports);
      setRepos(res.repositories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleGenerate = async (e: FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      await apiFetch('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify({
          repositoryId: repoId ? Number(repoId) : null,
          reportType,
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = async (report: ReportRecord) => {
    setError(null);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      const s = report.summaryJson;
      doc.setFontSize(18);
      doc.text('Repo Health — Engineering Report', 14, 20);
      doc.setFontSize(11);
      doc.text(report.title, 14, 30);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date(s.generatedAt || report.createdAt).toLocaleString()}`, 14, 38);
      doc.text(`Scope: ${s.scope} | Health Score: ${s.healthScore ?? 'N/A'}/100`, 14, 44);
      doc.text(
        `Findings: ${s.totalFindings} total (${s.critical} critical, ${s.high} high, ${s.medium} medium, ${s.low} low) | Resolved: ${s.resolved}`,
        14,
        50
      );

      let y = 62;
      doc.setFontSize(11);
      doc.text('Key Findings', 14, y);
      y += 7;
      doc.setFontSize(9);
      for (const f of s.topFindings || []) {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        doc.text(`[${f.severity.toUpperCase()}] ${f.ruleId}: ${f.title.slice(0, 75)}`, 14, y);
        y += 5;
        doc.text(`  ${f.filePath}:${f.lineStart} (${f.status})`, 14, y);
        y += 7;
      }

      doc.save(`repo-health-report-${report.id}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PDF.');
    }
  };

  return (
    <AppShell title="Reports">
      <div className="space-y-6">
        {error ? (
          <div role="alert" className="p-3 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
        <form
          onSubmit={handleGenerate}
          className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] flex flex-wrap items-end gap-4"
        >
          <div className="min-w-[200px] flex-1">
            <label htmlFor="report-repo" className="block text-xs font-semibold mb-1">Scope</label>
            <select
              id="report-repo"
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm"
            >
              <option value="">All Workspace Repositories</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>{r.fullName}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[160px]">
            <label htmlFor="report-type" className="block text-xs font-semibold mb-1">Report Type</label>
            <select
              id="report-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm"
            >
              <option value="health">Health Report</option>
              <option value="security">Security Audit Report</option>
              <option value="scan_summary">Scan Summary</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={generating}
            className="glass-btn-primary px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
        </form>

        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#777783]">Loading reports...</div>
          ) : reports.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#777783]">
              Generate a workspace or repository report above to inspect and export as PDF.
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-4 w-4 text-[#7656D6] mt-0.5 shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{r.title}</div>
                    <div className="text-xs text-[#777783] font-mono tabular-nums mt-0.5">
                      {new Date(r.createdAt).toLocaleString()} · {r.summaryJson.totalFindings} findings · Health{' '}
                      {r.summaryJson.healthScore ?? '—'}/100
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(r)}
                  className="glass-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
