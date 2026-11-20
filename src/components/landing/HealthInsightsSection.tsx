const SCORE_BREAKDOWN = [
  { label: 'Security', weight: '30%', score: 82 },
  { label: 'Code quality', weight: '20%', score: 88 },
  { label: 'Dependency health', weight: '20%', score: 79 },
  { label: 'Maintainability', weight: '15%', score: 90 },
  { label: 'Testing & docs', weight: '10%', score: 85 },
  { label: 'Configuration', weight: '5%', score: 94 },
];

const SAMPLE_SCANS = [
  { id: '#19', commit: '8a41f2c', branch: 'main', findings: '3 open', score: 84, delta: '+5' },
  { id: '#18', commit: '3d90b14', branch: 'main', findings: '5 open', score: 79, delta: '+2' },
  { id: '#17', commit: 'c72e110', branch: 'main', findings: '6 open', score: 77, delta: '-4' },
  { id: '#16', commit: '91ab408', branch: 'main', findings: '4 open', score: 81, delta: '+6' },
];

const TREND_POINTS = [
  { scan: '#14', score: 74, openFindings: 9 },
  { scan: '#15', score: 75, openFindings: 8 },
  { scan: '#16', score: 81, openFindings: 4 },
  { scan: '#17', score: 77, openFindings: 6 },
  { scan: '#18', score: 79, openFindings: 5 },
  { scan: '#19', score: 84, openFindings: 3 },
];

export function HealthInsightsSection() {
  return (
    <section className="py-20 sm:py-24 bg-white border-b border-[#E8E8ED]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 reveal-block">
          <div className="max-w-2xl space-y-3">
            <div className="text-xs font-medium text-[#7656D6]">Health insights</div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111114] text-balance">
              Understand the health of your repository over time.
            </h2>
            <p className="text-base text-[#555562] leading-relaxed">
              A repository&apos;s condition changes as code evolves. Repo Health computes an explainable, weighted score from every scan so teams can track regressions and verify improvements.
            </p>
          </div>
          <span className="text-xs font-mono text-[#73737D] shrink-0">
            Demonstration data · Deterministic formula
          </span>
        </div>

        <div className="border border-[#E8E8ED] rounded-xl bg-white overflow-hidden reveal-block">
          {/* Top KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-[#E8E8ED] bg-[#F8F8FA] border-b border-[#E8E8ED]">
            <div className="p-5">
              <div className="text-xs text-[#73737D]">Overall health score</div>
              <div className="mt-1.5 font-display text-3xl font-bold tabular-nums text-[#111114]">
                84<span className="text-base font-normal text-[#73737D]">/100</span>
              </div>
              <div className="mt-1 text-xs text-[#555562]">Weighted across 6 categories</div>
            </div>
            <div className="p-5">
              <div className="text-xs text-[#73737D]">Security score</div>
              <div className="mt-1.5 font-display text-3xl font-bold tabular-nums text-[#111114]">82</div>
              <div className="mt-1 text-xs text-[#555562]">30% of overall weight</div>
            </div>
            <div className="p-5">
              <div className="text-xs text-[#73737D]">Code quality score</div>
              <div className="mt-1.5 font-display text-3xl font-bold tabular-nums text-[#111114]">88</div>
              <div className="mt-1 text-xs text-[#555562]">20% of overall weight</div>
            </div>
            <div className="p-5">
              <div className="text-xs text-[#73737D]">Dependency health</div>
              <div className="mt-1.5 font-display text-3xl font-bold tabular-nums text-[#111114]">79</div>
              <div className="mt-1 text-xs text-[#555562]">20% of overall weight</div>
            </div>
          </div>

          {/* Middle Breakdown + Finding Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E8E8ED]">
            {/* Weighted Formula Breakdown */}
            <div className="lg:col-span-5 p-6 space-y-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-[#17171C]">
                  Explainable category weights
                </h3>
                <p className="mt-0.5 text-xs text-[#73737D]">
                  Confirmed findings deduct full severity points; potential findings carry a 0.65x factor.
                </p>
              </div>

              <div className="space-y-3">
                {SCORE_BREAKDOWN.map((cat) => (
                  <div key={cat.label} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#17171C] font-medium">
                        {cat.label} <span className="font-mono text-[#73737D]">({cat.weight})</span>
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-[#111114]">{cat.score}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F8F8FA] border border-[#E8E8ED] overflow-hidden">
                      <div className="h-full bg-[#7656D6]" style={{ width: `${cat.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Score & Finding Trend + Scan History */}
            <div className="lg:col-span-7 p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-sm font-semibold text-[#17171C]">
                    Score &amp; open finding trend across scans
                  </h3>
                  <span className="font-mono text-[11px] text-[#73737D]">Scans #14 – #19</span>
                </div>

                <div className="mt-5 grid grid-cols-6 gap-3 items-end h-32 pt-4 border-b border-[#E8E8ED]">
                  {TREND_POINTS.map((pt) => (
                    <div key={pt.scan} className="h-full flex flex-col items-center justify-end gap-1.5">
                      <span className="font-mono text-[11px] tabular-nums text-[#17171C] font-medium">
                        {pt.score}
                      </span>
                      <div
                        className="w-full max-w-[36px] rounded-t bg-[#7656D6]"
                        style={{ height: `${Math.max(20, Math.round((pt.score / 100) * 76))}px` }}
                        title={`${pt.scan}: score ${pt.score}/100, ${pt.openFindings} open findings`}
                      />
                      <span className="font-mono text-[10px] text-[#73737D] pb-1.5">{pt.scan}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-display text-sm font-semibold text-[#17171C] mb-3">
                  Recent scan history (Sample)
                </h3>
                <div className="border border-[#E8E8ED] rounded-lg divide-y divide-[#E8E8ED] text-xs font-mono">
                  {SAMPLE_SCANS.map((s) => (
                    <div key={s.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[#17171C] font-semibold">{s.id}</span>
                        <span className="text-[#73737D]">{s.commit}</span>
                        <span className="text-[#73737D] hidden sm:inline">{s.branch}</span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 tabular-nums">
                        <span className="font-sans text-[#555562]">{s.findings}</span>
                        <span className="font-semibold text-[#111114]">{s.score}/100</span>
                        <span className={s.delta.startsWith('+') ? 'text-emerald-700' : 'text-red-700'}>
                          {s.delta}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
