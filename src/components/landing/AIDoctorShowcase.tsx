import { useState } from 'react';
import { CheckCircle2, FileWarning, Search, Stethoscope, Wrench } from 'lucide-react';

interface DiagnosisCase {
  id: string;
  label: string;
  title: string;
  severity: 'Critical' | 'High';
  category: string;
  ruleId: string;
  file: string;
  line: number;
  excerpt: string[];
  rootCause: string;
  recommendation: string;
  proposedPatch: string[];
  verificationRequirements: string[];
}

const CASES: DiagnosisCase[] = [
  {
    id: 'sql',
    label: 'SQL Query Interpolation',
    title: 'Unparameterized SQL query construction',
    severity: 'Critical',
    category: 'Security',
    ruleId: 'sql-string-interpolation',
    file: 'src/db/orders.ts',
    line: 42,
    excerpt: [
      '40 | export async function findOrder(orderId: string) {',
      '41 |   const query = `SELECT * FROM orders WHERE id = \'${orderId}\'`;',
      '42 |   return db.execute(query);',
      '43 | }',
    ],
    rootCause:
      'User-controlled string orderId is concatenated directly into a raw SQL template literal before calling db.execute(), allowing query structure manipulation when unvalidated input reaches the data layer.',
    recommendation:
      'Replace string interpolation with parameterized SQL bindings (sql tagged template) and validate incoming identifier format at the route boundary.',
    proposedPatch: [
      '- const query = `SELECT * FROM orders WHERE id = \'${orderId}\'`;',
      '- return db.execute(query);',
      '+ return db.execute(sql`SELECT * FROM orders WHERE id = ${orderId}`);',
    ],
    verificationRequirements: [
      'Re-run deterministic rule sql-string-interpolation on src/db/orders.ts (expect 0 matches).',
      'Confirm parameterized query compiles cleanly under tsc --noEmit.',
    ],
  },
  {
    id: 'secret',
    label: 'Hardcoded Signing Secret',
    title: 'Hardcoded webhook signing secret in source file',
    severity: 'High',
    category: 'Security',
    ruleId: 'hardcoded-secret-literal',
    file: 'src/webhooks/stripe.ts',
    line: 18,
    excerpt: [
      '16 | export function verifySignature(payload: string, sig: string) {',
      '17 |   const secret = process.env.WEBHOOK_SECRET || "whsec_demo_94f2a1";',
      '18 |   return constructEvent(payload, sig, secret);',
      '19 | }',
    ],
    rootCause:
      'A hardcoded fallback literal is assigned when process.env.WEBHOOK_SECRET is undefined, committing credential material to version history and weakening signature verification if env configuration is missing.',
    recommendation:
      'Remove the fallback literal, require process.env.WEBHOOK_SECRET explicitly at runtime, and fail closed when the environment variable is absent.',
    proposedPatch: [
      '- const secret = process.env.WEBHOOK_SECRET || "whsec_demo_94f2a1";',
      '+ const secret = process.env.WEBHOOK_SECRET;',
      '+ if (!secret) throw new Error("WEBHOOK_SECRET is required");',
    ],
    verificationRequirements: [
      'Re-run secret scanner rule hardcoded-secret-literal (expect 0 literal secret matches).',
      'Verify error thrown when WEBHOOK_SECRET is unset in test environment.',
    ],
  },
];

const SUPPORTING_CAPABILITIES = [
  {
    title: 'Understand the issue',
    description: 'Get an explanation of what happened and why it matters.',
    icon: FileWarning,
  },
  {
    title: 'Investigate the cause',
    description: 'Explore related code and dependencies to understand the likely source.',
    icon: Search,
  },
  {
    title: 'Generate a correction',
    description: 'Receive a proposed patch with an explanation of the changes.',
    icon: Wrench,
  },
  {
    title: 'Verify the result',
    description: 'Check whether the issue has actually been resolved.',
    icon: CheckCircle2,
  },
];

export function AIDoctorShowcase() {
  const [activeCaseId, setActiveCaseId] = useState<string>(CASES[0].id);
  const current = CASES.find((c) => c.id === activeCaseId) || CASES[0];

  return (
    <section id="ai-doctor" className="py-20 sm:py-24 bg-white border-b border-[#E8E8ED] scroll-mt-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Section Intro */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end reveal-block">
          <div className="lg:col-span-7 space-y-3">
            <div className="text-xs font-medium text-[#7656D6] tracking-wide">
              Repo Health Intelligence
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111114] text-balance">
              Meet your repository&apos;s AI Doctor.
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-base text-[#555562] leading-relaxed">
              Understanding a code issue should not require hours of investigation. AI Doctor helps developers interpret findings, investigate likely causes, and generate practical solutions backed by repository context.
            </p>
          </div>
        </div>

        {/* Supporting Capabilities Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2 border-t border-[#E8E8ED] reveal-block">
          {SUPPORTING_CAPABILITIES.map(({ title, description, icon: Icon }) => (
            <div key={title} className="pt-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#17171C]">
                <Icon className="h-4 w-4 text-[#7656D6] shrink-0" aria-hidden="true" />
                <span>{title}</span>
              </div>
              <p className="text-sm text-[#555562] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Realistic AI Doctor Engineering Workbench */}
        <div className="border border-[#E8E8ED] rounded-xl bg-white overflow-hidden reveal-block">
          {/* Header & Case Tabs */}
          <div className="px-5 py-3.5 bg-[#F8F8FA] border-b border-[#E8E8ED] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-[#17171C]">
              <Stethoscope className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
              <span>AI Doctor Diagnostic Record</span>
              <span className="text-[#73737D] font-normal">· Sample demonstration</span>
            </div>

            <div role="tablist" aria-label="Sample diagnosis findings" className="glass-tab-bar p-1 rounded-lg flex flex-wrap items-center gap-1.5">
              {CASES.map((c) => {
                const active = c.id === current.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveCaseId(c.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all focus-visible:outline-2 focus-visible:outline-[#7656D6] ${
                      active
                        ? 'glass-tab-active'
                        : 'glass-btn-secondary'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Finding Title Metadata Bar */}
          <div className="px-5 py-4 border-b border-[#E8E8ED] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-[#111114]">
                {current.title}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#73737D]">
                <span className={current.severity === 'Critical' ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold'}>
                  {current.severity} severity
                </span>
                <span aria-hidden="true">·</span>
                <span>{current.category}</span>
                <span aria-hidden="true">·</span>
                <code className="font-mono text-[#17171C]">
                  {current.file}:{current.line}
                </code>
              </div>
            </div>
            <div className="font-mono text-xs text-[#73737D]">
              Rule: <span className="text-[#17171C]">{current.ruleId}</span>
            </div>
          </div>

          {/* Two-Column Distinction: Deterministic Scanner Evidence vs AI-Generated Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E8E8ED]">
            {/* Left: Scanner Evidence */}
            <div className="lg:col-span-5 p-5 sm:p-6 bg-[#F8F8FA] space-y-5">
              <div>
                <div className="text-xs font-semibold text-[#17171C]">
                  Scanner evidence (Deterministic)
                </div>
                <p className="mt-1 text-xs text-[#555562]">
                  Observed directly in source tree without model inference.
                </p>
              </div>

              <div className="rounded-lg bg-[#111116] text-[#F4F4F6] p-4 font-mono text-[11.5px] leading-6 overflow-x-auto whitespace-pre">
                <div className="text-[#8E8E9E] mb-2">
                  {current.file} (lines {current.line - 2}–{current.line + 1})
                </div>
                {current.excerpt.map((line) => {
                  const isTarget = line.startsWith(`${current.line} |`) || line.startsWith(`${current.line - 1} |`);
                  return (
                    <div
                      key={line}
                      className={isTarget ? 'text-amber-200 bg-white/5 -mx-2 px-2 rounded' : 'text-[#D4D4DC]'}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#17171C]">
                  Verification requirements
                </div>
                <ul className="space-y-2 text-xs text-[#555562]">
                  {current.verificationRequirements.map((req) => (
                    <li key={req} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#7656D6] shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right: AI-Generated Diagnosis & Proposed Patch */}
            <div className="lg:col-span-7 p-5 sm:p-6 bg-white space-y-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-[#7656D6]">
                  AI-generated diagnosis (Context-grounded)
                </div>
                <span className="font-mono text-[11px] text-[#73737D]">Requires developer review</span>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#17171C]">Root-cause explanation</div>
                <p className="text-sm text-[#555562] leading-relaxed">
                  {current.rootCause}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#17171C]">Recommended solution</div>
                <p className="text-sm text-[#555562] leading-relaxed">
                  {current.recommendation}
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-[#17171C]">Proposed fix</div>
                <div className="rounded-lg bg-[#111116] text-[#F4F4F6] p-4 font-mono text-[11.5px] leading-6 overflow-x-auto whitespace-pre">
                  {current.proposedPatch.map((line) => (
                    <div
                      key={line}
                      className={
                        line.startsWith('-')
                          ? 'text-red-300'
                          : line.startsWith('+')
                            ? 'text-emerald-300'
                            : 'text-[#D4D4DC]'
                      }
                    >
                      {line}
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
