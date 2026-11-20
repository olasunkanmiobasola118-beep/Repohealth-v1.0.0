const PROBLEMS = [
  {
    title: 'Scattered findings',
    description:
      'Problems are distributed across tools and reports, forcing engineers to reconcile security advisories, lint errors, and dependency logs manually.',
  },
  {
    title: 'Unclear root causes',
    description:
      'A warning does not always explain what caused it, how it interacts with surrounding modules, or which change resolves it safely.',
  },
  {
    title: 'Time-consuming fixes',
    description:
      'Understanding and correcting issues takes valuable development time away from building product features and reviewing releases.',
  },
];

export function ProblemSection() {
  return (
    <section className="py-20 sm:py-24 bg-white border-b border-[#E8E8ED]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
        {/* Left: Technical Repository Visualization */}
        <div className="lg:col-span-6 order-2 lg:order-1 reveal-block">
          <div className="border border-[#E8E8ED] rounded-xl bg-[#F8F8FA] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E8E8ED] bg-white flex items-center justify-between text-xs">
              <span className="font-mono font-medium text-[#17171C]">sample/checkout-worker</span>
              <span className="text-[#73737D]">Consolidated scan view</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Fragmented sources row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                {[
                  { source: 'Static AST', count: '2 findings', file: 'auth/jwt.ts' },
                  { source: 'OSV Audit', count: '1 advisory', file: 'package-lock.json' },
                  { source: 'Complexity', count: '1 warning', file: 'jobs/retry.ts' },
                ].map((item) => (
                  <div
                    key={item.source}
                    className="p-3 rounded-lg border border-[#E8E8ED] bg-white"
                  >
                    <div className="font-mono text-[11px] text-[#73737D]">{item.source}</div>
                    <div className="mt-1 font-medium text-[#17171C]">{item.count}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-[#73737D] truncate">{item.file}</div>
                  </div>
                ))}
              </div>

              {/* Unified Repo Health Record */}
              <div className="border border-[#E8E8ED] rounded-lg bg-white divide-y divide-[#E8E8ED]">
                <div className="px-4 py-3 flex items-center justify-between gap-2 text-xs bg-[#111116] text-white rounded-t-lg">
                  <span className="font-medium">Unified diagnostic queue</span>
                  <span className="font-mono text-[11px] text-[#B7A6F6]">4 correlated findings</span>
                </div>
                {[
                  {
                    file: 'src/auth/jwt.ts:29',
                    title: 'Hardcoded fallback signing key',
                    severity: 'Critical',
                    action: 'Root cause + env patch ready',
                  },
                  {
                    file: 'package-lock.json',
                    title: 'semver < 7.5.2 ReDoS advisory',
                    severity: 'High',
                    action: 'Constraint bump suggested',
                  },
                  {
                    file: 'src/jobs/retry.ts:84',
                    title: 'Uncaught rejection in retry loop',
                    severity: 'Medium',
                    action: 'Deterministic fix staged',
                  },
                ].map((row) => (
                  <div key={row.file} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-[#17171C] truncate">{row.title}</div>
                      <div className="mt-0.5 font-mono text-[11px] text-[#73737D]">{row.file}</div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-[#555562]">{row.severity}</span>
                      <span className="text-[#E8E8ED]" aria-hidden="true">/</span>
                      <span className="text-[11px] font-medium text-[#7656D6]">{row.action}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Editorial Problem Narrative */}
        <div className="lg:col-span-6 order-1 lg:order-2 space-y-8 reveal-block">
          <div className="space-y-4">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111114] text-balance">
              Finding the problem is only half the work.
            </h2>
            <p className="text-base text-[#555562] leading-relaxed">
              Developers work with increasingly complex codebases. Security vulnerabilities, outdated dependencies, duplicated code, and hidden technical debt can make maintaining a repository difficult.
            </p>
            <p className="text-base text-[#555562] leading-relaxed">
              Traditional scanning tools can identify issues, but understanding their causes and deciding how to fix them still takes time. Repo Health brings detection, diagnosis, and remediation into one workflow.
            </p>
          </div>

          <div className="divide-y divide-[#E8E8ED] border-t border-[#E8E8ED]">
            {PROBLEMS.map((problem) => (
              <div key={problem.title} className="py-4">
                <h3 className="font-display text-base font-semibold text-[#17171C]">
                  {problem.title}
                </h3>
                <p className="mt-1 text-sm text-[#555562] leading-relaxed">
                  {problem.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
