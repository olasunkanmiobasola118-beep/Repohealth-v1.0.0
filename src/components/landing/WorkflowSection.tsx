const WORKFLOW_STAGES = [
  {
    step: '01',
    name: 'Scan',
    description: 'Analyze repository structure, dependencies, security patterns, and code quality.',
  },
  {
    step: '02',
    name: 'Detect',
    description: 'Identify findings and organize them by category, severity, and affected files.',
  },
  {
    step: '03',
    name: 'Diagnose',
    description: 'Use AI to explain findings, investigate possible root causes, and provide context.',
  },
  {
    step: '04',
    name: 'Fix',
    description: 'Generate proposed code corrections that developers can review and approve.',
  },
  {
    step: '05',
    name: 'Verify',
    description: 'Run relevant checks and determine whether the proposed change resolved the issue.',
  },
  {
    step: '06',
    name: 'Monitor',
    description: 'Track repository health and identify changes over time.',
  },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-20 sm:py-24 bg-[#F8F8FA] border-b border-[#E8E8ED] scroll-mt-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl space-y-3 reveal-block">
          <div className="text-xs font-medium text-[#7656D6]">Workflow</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111114] text-balance">
            From detection to resolution.
          </h2>
          <p className="text-base text-[#555562] leading-relaxed">
            A connected workflow that helps developers move from identifying problems to verifying improvements.
          </p>
        </div>

        {/* Desktop Horizontal Connected Pipeline / Mobile Vertical Timeline */}
        <div className="mt-14 relative reveal-block">
          {/* Desktop connecting hairline */}
          <div
            className="hidden lg:block absolute top-4 left-0 right-0 h-px bg-[#E8E8ED]"
            aria-hidden="true"
          />
          {/* Mobile vertical connecting hairline */}
          <div
            className="lg:hidden absolute top-2 bottom-2 left-4 w-px bg-[#E8E8ED]"
            aria-hidden="true"
          />

          <ol className="grid grid-cols-1 lg:grid-cols-6 gap-8 lg:gap-6">
            {WORKFLOW_STAGES.map((stage) => (
              <li key={stage.step} className="relative pl-12 lg:pl-0">
                {/* Stage index marker */}
                <div className="absolute left-0 top-0 lg:static flex items-center gap-3 lg:mb-5">
                  <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E8E8ED] bg-white font-mono text-xs font-semibold text-[#17171C] tabular-nums">
                    {stage.step}
                  </span>
                </div>

                <h3 className="font-display text-base font-semibold text-[#17171C]">
                  {stage.step} — {stage.name}
                </h3>
                <p className="mt-2 text-sm text-[#555562] leading-relaxed">
                  {stage.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
