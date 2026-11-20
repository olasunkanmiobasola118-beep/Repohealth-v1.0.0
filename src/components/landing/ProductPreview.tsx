import { useEffect, useState } from 'react';
import { CheckCircle2, FileCode2, ShieldAlert, Stethoscope, Wrench } from 'lucide-react';

type PreviewStage = 'scan' | 'detect' | 'diagnose' | 'verify';

const STAGES: Array<{ id: PreviewStage; step: string; label: string }> = [
  { id: 'scan', step: '01', label: 'Scan' },
  { id: 'detect', step: '02', label: 'Detect' },
  { id: 'diagnose', step: '03', label: 'AI Doctor' },
  { id: 'verify', step: '04', label: 'Fix & Verify' },
];

const SAMPLE_FINDINGS = [
  {
    id: 'rh-sql',
    severity: 'Critical',
    rule: 'sql-string-interpolation',
    title: 'Unparameterized SQL query in order lookup',
    file: 'src/db/orders.ts:42',
    category: 'Security',
  },
  {
    id: 'rh-dep',
    severity: 'High',
    rule: 'osv-advisory-check',
    title: 'Known path-traversal advisory in tar <= 6.2.0',
    file: 'package-lock.json',
    category: 'Dependency',
  },
  {
    id: 'rh-cx',
    severity: 'Medium',
    rule: 'cyclomatic-complexity',
    title: 'High branching complexity in settleInvoice()',
    file: 'src/billing/settle.ts:118',
    category: 'Code quality',
  },
];

export function ProductPreview() {
  const [stage, setStage] = useState<PreviewStage>('diagnose');
  const [autoAdvance, setAutoAdvance] = useState(true);

  useEffect(() => {
    if (!autoAdvance) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const order: PreviewStage[] = ['scan', 'detect', 'diagnose', 'verify'];
    const timer = window.setInterval(() => {
      setStage((prev) => order[(order.indexOf(prev) + 1) % order.length]);
    }, 4600);
    return () => window.clearInterval(timer);
  }, [autoAdvance]);

  const handleSelectStage = (next: PreviewStage) => {
    setAutoAdvance(false);
    setStage(next);
  };

  const scoreValue = stage === 'verify' ? 96 : 84;

  return (
    <div
      id="product-preview"
      className="border border-[#E8E8ED] rounded-xl bg-white overflow-hidden shadow-[0_1px_3px_rgba(17,17,20,0.04)]"
      aria-label="Repo Health interactive product preview"
    >
      {/* Top Workbench Chrome */}
      <div className="px-4 py-3 bg-[#F8F8FA] border-b border-[#E8E8ED] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#17171C] min-w-0">
          <FileCode2 className="h-3.5 w-3.5 text-[#7656D6] shrink-0" aria-hidden="true" />
          <span className="font-mono font-medium truncate">acme/payments-service</span>
          <span className="text-[#73737D]" aria-hidden="true">/</span>
          <span className="font-mono text-[#73737D]">main</span>
        </div>
        <span className="text-[11px] font-medium text-[#73737D] whitespace-nowrap">
          Demonstration preview
        </span>
      </div>

      {/* Stage Switcher Tabs */}
      <div className="px-4 py-2.5 border-b border-[#E8E8ED] bg-white">
        <div
          role="tablist"
          aria-label="Workflow preview stages"
          className="glass-tab-bar p-1 rounded-lg grid grid-cols-2 sm:flex sm:items-center gap-1.5"
        >
          {STAGES.map((item) => {
            const active = stage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectStage(item.id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap text-left sm:text-center transition-all focus-visible:outline-2 focus-visible:outline-[#7656D6] ${
                  active
                    ? 'glass-tab-active'
                    : 'text-[#555562] hover:text-[#17171C] hover:bg-white/75'
                }`}
              >
                <span className="font-mono mr-1.5 opacity-70">{item.step}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="px-5 py-4 border-b border-[#E8E8ED] grid grid-cols-3 gap-4 bg-white">
        <div>
          <div className="text-[11px] text-[#73737D]">Health score</div>
          <div className="mt-0.5 font-display text-2xl font-bold tabular-nums text-[#111114]">
            {scoreValue}
            <span className="text-sm font-normal text-[#73737D]">/100</span>
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#73737D]">Open findings</div>
          <div className="mt-0.5 font-display text-2xl font-bold tabular-nums text-[#111114]">
            {stage === 'verify' ? 2 : 3}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#73737D]">Active state</div>
          <div className="mt-1 text-xs font-medium text-[#17171C]">
            {stage === 'scan' && 'Indexing 142 files'}
            {stage === 'detect' && '1 critical · 1 high'}
            {stage === 'diagnose' && 'AI Doctor diagnosis'}
            {stage === 'verify' && 'Re-scan passed'}
          </div>
        </div>
      </div>

      {/* Dynamic Stage Body */}
      <div className="p-5 bg-[#FFFFFF] min-h-[278px] flex flex-col justify-between">
        {stage === 'scan' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#17171C]">Deterministic repository checks</span>
              <span className="font-mono text-[#73737D] tabular-nums">142 / 142 files</span>
            </div>
            <div className="divide-y divide-[#E8E8ED] border border-[#E8E8ED] rounded-lg">
              {[
                ['Repository tree & entry points', 'Completed · 142 files mapped'],
                ['Secret & static AST rules', 'Completed · 1 critical hit'],
                ['OSV package advisory lookup', 'Completed · 48 manifests checked'],
                ['Complexity & module graph', 'Completed · 0 circular imports'],
              ].map(([name, result]) => (
                <div key={name} className="px-3.5 py-2.5 flex items-center justify-between gap-4 text-xs">
                  <span className="text-[#17171C] font-medium">{name}</span>
                  <span className="font-mono text-[#73737D] text-[11px] shrink-0">{result}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#73737D]">
              Read-only tree inspection computes weighted category scores without executing repository code.
            </p>
          </div>
        )}

        {stage === 'detect' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#17171C]">Prioritized findings</span>
              <span className="text-[#73737D]">Sorted by severity</span>
            </div>
            <div className="divide-y divide-[#E8E8ED] border border-[#E8E8ED] rounded-lg">
              {SAMPLE_FINDINGS.map((f) => (
                <div key={f.id} className="p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-medium text-[#17171C]">
                      <ShieldAlert
                        className={`h-3.5 w-3.5 shrink-0 ${
                          f.severity === 'Critical'
                            ? 'text-red-600'
                            : f.severity === 'High'
                              ? 'text-amber-600'
                              : 'text-[#73737D]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{f.title}</span>
                    </div>
                    <div className="mt-1 font-mono text-[11px] text-[#73737D] truncate">
                      {f.file} · {f.rule}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-[#555562] shrink-0">
                    {f.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === 'diagnose' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-[#17171C]">
                <Stethoscope className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
                <span>AI Doctor · Root-cause analysis</span>
              </div>
              <span className="font-mono text-[11px] text-[#73737D]">src/db/orders.ts:42</span>
            </div>

            <div className="rounded-lg bg-[#111116] text-[#F4F4F6] p-3.5 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
              <div className="text-[#8E8E9E]">// Scanner evidence · sql-string-interpolation</div>
              <div className="text-red-300 mt-1">
                - return db.execute(`SELECT * FROM orders WHERE id = &apos;${'{orderId}'}&apos;`);
              </div>
              <div className="text-emerald-300">
                + return db.execute(sql`SELECT * FROM orders WHERE id = ${'{orderId}'}`);
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#F8F8FA] border border-[#E8E8ED] space-y-1.5 text-xs">
              <div className="font-semibold text-[#17171C]">Why it matters</div>
              <p className="text-[#555562] leading-relaxed">
                Interpolating <code className="font-mono text-[11px]">orderId</code> directly into SQL allows crafted inputs to alter query structure. Parameterized bindings separate SQL syntax from user values.
              </p>
            </div>
          </div>
        )}

        {stage === 'verify' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-[#17171C]">
                <Wrench className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
                <span>Approved patch &amp; deterministic verification</span>
              </div>
              <span className="font-mono text-[11px] text-emerald-700 font-medium">Verified resolved</span>
            </div>

            <div className="border border-[#E8E8ED] rounded-lg divide-y divide-[#E8E8ED] text-xs">
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[#555562]">Developer approval</span>
                <span className="font-medium text-[#17171C]">Reviewed &amp; approved</span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[#555562]">Re-scan rule sql-string-interpolation</span>
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>0 hits remaining</span>
                </span>
              </div>
              <div className="px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-[#555562]">Projected score delta</span>
                <span className="font-mono font-semibold text-[#111114] tabular-nums">84 → 96 (+12)</span>
              </div>
            </div>

            <p className="text-xs text-[#73737D]">
              Patches remain staged until you explicitly approve and verify them before opening a Pull Request.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
