export function AnalysisSection() {
  return (
    <section id="analysis" className="py-20 sm:py-24 bg-white border-b border-[#E8E8ED] scroll-mt-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="max-w-2xl space-y-3 reveal-block">
          <div className="text-xs font-medium text-[#7656D6]">Repository intelligence</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111114] text-balance">
            A deeper understanding of your codebase.
          </h2>
          <p className="text-base text-[#555562] leading-relaxed">
            Deterministic static checks, OSV dependency lookups, and module boundary analysis work together before AI diagnosis ever runs.
          </p>
        </div>

        {/* Asymmetric Composed Grid (no repetitive 6 identical cards) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 reveal-block">
          {/* 1. Security Analysis (Wide 7-col) */}
          <div className="lg:col-span-7 border border-[#E8E8ED] rounded-xl p-6 bg-[#F8F8FA] flex flex-col justify-between gap-6">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#111114]">Security analysis</h3>
              <p className="mt-1.5 text-sm text-[#555562] max-w-xl">
                Identify relevant vulnerabilities, insecure patterns, exposed secrets, and configuration problems with exact file and line evidence.
              </p>
            </div>
            <div className="border border-[#E8E8ED] rounded-lg bg-white divide-y divide-[#E8E8ED] text-xs">
              {[
                { rule: 'hardcoded-secret-literal', status: 'Redacted before prompt', severity: 'Critical' },
                { rule: 'sql-string-interpolation', status: 'Flagged in orders.ts:42', severity: 'Critical' },
                { rule: 'unsafe-dynamic-eval', status: '0 matches across 142 files', severity: 'Pass' },
              ].map((item) => (
                <div key={item.rule} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <code className="font-mono text-[#17171C] truncate">{item.rule}</code>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[#73737D] hidden sm:inline">{item.status}</span>
                    <span className={`font-medium ${item.severity === 'Pass' ? 'text-emerald-700' : 'text-red-700'}`}>
                      {item.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Code Quality (5-col) */}
          <div className="lg:col-span-5 border border-[#E8E8ED] rounded-xl p-6 bg-white flex flex-col justify-between gap-6">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#111114]">Code quality</h3>
              <p className="mt-1.5 text-sm text-[#555562]">
                Understand complexity, duplication, maintainability problems, and potential bugs.
              </p>
            </div>
            <div className="space-y-3 text-xs">
              {[
                { label: 'Cyclomatic complexity hotspots', value: '2 functions > 15 branches', pct: 72 },
                { label: 'Duplicate AST blocks', value: '1.8% across src/', pct: 88 },
                { label: 'Strict TypeScript coverage', value: '96.4% typed modules', pct: 96 },
              ].map((m) => (
                <div key={m.label} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-[#17171C]">{m.label}</span>
                    <span className="font-mono text-[11px] text-[#73737D] tabular-nums">{m.value}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#F8F8FA] overflow-hidden border border-[#E8E8ED]">
                    <div className="h-full bg-[#7656D6]" style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Dependency Intelligence (5-col) */}
          <div className="lg:col-span-5 border border-[#E8E8ED] rounded-xl p-6 bg-white flex flex-col justify-between gap-6">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#111114]">Dependency intelligence</h3>
              <p className="mt-1.5 text-sm text-[#555562]">
                Review package health, known vulnerabilities, version information, and dependency risks via OSV advisories.
              </p>
            </div>
            <div className="border border-[#E8E8ED] rounded-lg divide-y divide-[#E8E8ED] text-xs font-mono">
              {[
                { pkg: 'tar@6.1.15', note: 'OSV advisory · upgrade to 6.2.1', state: 'Advisory' },
                { pkg: 'drizzle-orm@0.45.4', note: '0 known advisories', state: 'Clean' },
                { pkg: 'express@4.21.2', note: '0 known advisories', state: 'Clean' },
              ].map((dep) => (
                <div key={dep.pkg} className="px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[#17171C] font-medium truncate">{dep.pkg}</div>
                    <div className="text-[11px] text-[#73737D] font-sans">{dep.note}</div>
                  </div>
                  <span className={`font-sans text-[11px] font-medium shrink-0 ${dep.state === 'Advisory' ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {dep.state}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Architecture Understanding (Wide 7-col) */}
          <div className="lg:col-span-7 border border-[#E8E8ED] rounded-xl p-6 bg-[#F8F8FA] flex flex-col justify-between gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#111114]">Architecture understanding</h3>
                <p className="mt-1.5 text-sm text-[#555562] max-w-xl">
                  Explore repository structure, module relationships, entry points, and circular dependencies.
                </p>
              </div>
              <span className="font-mono text-[11px] text-[#555562]">0 circular imports detected</span>
            </div>

            <div className="border border-[#E8E8ED] rounded-lg bg-white p-4 overflow-x-auto">
              <svg
                viewBox="0 0 600 130"
                className="w-full min-w-[440px] h-[112px]"
                role="img"
                aria-label="Sample module dependency graph showing routes calling orders service and database client"
              >
                <line x1="140" y1="65" x2="225" y2="65" stroke="#E8E8ED" strokeWidth="1.5" />
                <line x1="365" y1="65" x2="445" y2="40" stroke="#E8E8ED" strokeWidth="1.5" />
                <line x1="365" y1="65" x2="445" y2="95" stroke="#E8E8ED" strokeWidth="1.5" />

                <rect x="12" y="42" width="128" height="46" rx="6" fill="#F8F8FA" stroke="#E8E8ED" />
                <text x="76" y="62" textAnchor="middle" fill="#17171C" fontSize="11" fontFamily="JetBrains Mono, monospace">routes.ts</text>
                <text x="76" y="78" textAnchor="middle" fill="#73737D" fontSize="10" fontFamily="DM Sans, sans-serif">Entry point</text>

                <rect x="225" y="42" width="140" height="46" rx="6" fill="#111116" stroke="#111116" />
                <text x="295" y="62" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontFamily="JetBrains Mono, monospace">orders.ts</text>
                <text x="295" y="78" textAnchor="middle" fill="#B7A6F6" fontSize="10" fontFamily="DM Sans, sans-serif">Domain service</text>

                <rect x="445" y="16" width="142" height="42" rx="6" fill="#F8F8FA" stroke="#E8E8ED" />
                <text x="516" y="34" textAnchor="middle" fill="#17171C" fontSize="11" fontFamily="JetBrains Mono, monospace">db/client.ts</text>
                <text x="516" y="49" textAnchor="middle" fill="#73737D" fontSize="10" fontFamily="DM Sans, sans-serif">Persistence</text>

                <rect x="445" y="74" width="142" height="42" rx="6" fill="#F8F8FA" stroke="#E8E8ED" />
                <text x="516" y="92" textAnchor="middle" fill="#17171C" fontSize="11" fontFamily="JetBrains Mono, monospace">webhooks.ts</text>
                <text x="516" y="107" textAnchor="middle" fill="#73737D" fontSize="10" fontFamily="DM Sans, sans-serif">External events</text>
              </svg>
            </div>
          </div>

          {/* 5. Health Monitoring (6-col) */}
          <div className="lg:col-span-6 border border-[#E8E8ED] rounded-xl p-6 bg-white flex flex-col justify-between gap-5">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#111114]">Health monitoring</h3>
              <p className="mt-1.5 text-sm text-[#555562]">
                Understand how the repository changes across scans with transparent category score deltas.
              </p>
            </div>
            <div className="border border-[#E8E8ED] rounded-lg px-4 py-3 bg-[#F8F8FA] flex items-center justify-between gap-4 text-xs">
              <div>
                <div className="font-mono text-[#73737D]">Scan #18 → #19 (main)</div>
                <div className="mt-0.5 font-medium text-[#17171C]">2 critical findings verified resolved</div>
              </div>
              <div className="font-mono font-semibold text-[#7656D6] tabular-nums">78 → 91 (+13)</div>
            </div>
          </div>

          {/* 6. Pull Request Intelligence (6-col) */}
          <div className="lg:col-span-6 border border-[#E8E8ED] rounded-xl p-6 bg-white flex flex-col justify-between gap-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-lg font-semibold text-[#111114]">Pull request intelligence</h3>
                <p className="mt-1.5 text-sm text-[#555562]">
                  Review proposed changes, generate verified branch diffs, and open developer-approved pull requests.
                </p>
              </div>
              <span className="text-[11px] font-medium text-[#73737D] whitespace-nowrap shrink-0">
                PR workflow
              </span>
            </div>
            <div className="border border-[#E8E8ED] rounded-lg px-4 py-3 bg-[#F8F8FA] flex items-center justify-between gap-4 text-xs">
              <div className="min-w-0">
                <div className="font-mono text-[#17171C] truncate">fix/parameterize-order-lookup</div>
                <div className="mt-0.5 text-[#73737D]">Created only after human approval</div>
              </div>
              <span className="font-mono text-emerald-700 font-medium shrink-0">Verified diff</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
