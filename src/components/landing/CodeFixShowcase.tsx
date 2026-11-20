import { useState } from 'react';
import { CheckCircle2, RotateCcw } from 'lucide-react';

type DemoReviewState = 'awaiting_review' | 'approved' | 'verified';

export function CodeFixShowcase() {
  const [reviewState, setReviewState] = useState<DemoReviewState>('awaiting_review');

  const handleAdvance = () => {
    if (reviewState === 'awaiting_review') {
      setReviewState('approved');
    } else if (reviewState === 'approved') {
      setReviewState('verified');
    }
  };

  return (
    <section className="py-20 sm:py-24 bg-[#F8F8FA] border-b border-[#E8E8ED]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-3 reveal-block">
          <div className="text-xs font-medium text-[#7656D6]">AI Fix Center</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111114] text-balance">
            Don&apos;t just read the report. Improve the code.
          </h2>
          <p className="text-base text-[#555562] leading-relaxed">
            Inspect minimal, targeted patches side by side before anything changes. Engineers review the diff, explicitly approve the modification, and run deterministic verification before merging.
          </p>
        </div>

        <div className="border border-[#E8E8ED] rounded-xl bg-white overflow-hidden reveal-block">
          {/* Diff Toolbar */}
          <div className="px-5 py-3.5 border-b border-[#E8E8ED] flex flex-wrap items-center justify-between gap-4 bg-white">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <code className="font-mono font-semibold text-[#17171C]">src/db/orders.ts</code>
              <span className="text-[#73737D]" aria-hidden="true">·</span>
              <span className="font-mono text-[#73737D]">-2 / +4 lines</span>
              <span className="text-[#73737D]" aria-hidden="true">·</span>
              <span className="text-[#555562]">
                Status:{' '}
                <strong className="font-medium text-[#17171C]">
                  {reviewState === 'awaiting_review'
                    ? 'Awaiting developer review'
                    : reviewState === 'approved'
                      ? 'Approved for verification'
                      : 'Verification passed (0 rule hits)'}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              {reviewState !== 'verified' ? (
                <button
                  type="button"
                  onClick={handleAdvance}
                  className="glass-btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#7656D6]"
                >
                  {reviewState === 'awaiting_review'
                    ? 'Approve patch (Demo)'
                    : 'Run verification check (Demo)'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setReviewState('awaiting_review')}
                  className="glass-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#7656D6]"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset preview</span>
                </button>
              )}
            </div>
          </div>

          {/* Side-by-Side Before & After Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E8E8ED] bg-[#111116] text-[#F4F4F6] font-mono text-xs leading-6">
            {/* Before */}
            <div className="p-5 overflow-x-auto">
              <div className="text-[11px] text-[#9898A6] pb-3 mb-3 border-b border-white/10">
                Original code · src/db/orders.ts
              </div>
              <div className="space-y-0.5">
                <div className="text-[#9898A6]"><span className="inline-block w-7 select-none opacity-60">39</span>import &#123; db &#125; from &apos;./client&apos;;</div>
                <div className="text-[#9898A6]"><span className="inline-block w-7 select-none opacity-60">40</span></div>
                <div className="text-[#D4D4DC]"><span className="inline-block w-7 select-none opacity-60">41</span>export async function findOrder(orderId: string) &#123;</div>
                <div className="bg-red-500/15 text-red-200 -mx-2 px-2 rounded">
                  <span className="inline-block w-7 select-none text-red-300">-42</span>const query = `SELECT * FROM orders WHERE id = &apos;${'{orderId}'}&apos;`;
                </div>
                <div className="bg-red-500/15 text-red-200 -mx-2 px-2 rounded">
                  <span className="inline-block w-7 select-none text-red-300">-43</span>return db.execute(query);
                </div>
                <div className="text-[#D4D4DC]"><span className="inline-block w-7 select-none opacity-60">44</span>&#125;</div>
              </div>
            </div>

            {/* After */}
            <div className="p-5 overflow-x-auto">
              <div className="text-[11px] text-[#9898A6] pb-3 mb-3 border-b border-white/10">
                Proposed corrected code · src/db/orders.ts
              </div>
              <div className="space-y-0.5">
                <div className="bg-emerald-500/15 text-emerald-200 -mx-2 px-2 rounded">
                  <span className="inline-block w-7 select-none text-emerald-300">+39</span>import &#123; sql &#125; from &apos;drizzle-orm&apos;;
                </div>
                <div className="text-[#9898A6]"><span className="inline-block w-7 select-none opacity-60">40</span>import &#123; db &#125; from &apos;./client&apos;;</div>
                <div className="text-[#D4D4DC]"><span className="inline-block w-7 select-none opacity-60">41</span></div>
                <div className="text-[#D4D4DC]"><span className="inline-block w-7 select-none opacity-60">42</span>export async function findOrder(orderId: string) &#123;</div>
                <div className="bg-emerald-500/15 text-emerald-200 -mx-2 px-2 rounded">
                  <span className="inline-block w-7 select-none text-emerald-300">+43</span>if (!/^[a-zA-Z0-9_-]&#123;1,64&#125;$/.test(orderId)) &#123;
                </div>
                <div className="bg-emerald-500/15 text-emerald-200 -mx-2 px-2 rounded">
                  <span className="inline-block w-7 select-none text-emerald-300">+44</span>  throw new Error(&apos;Invalid order identifier&apos;);
                </div>
                <div className="bg-emerald-500/15 text-emerald-200 -mx-2 px-2 rounded">
                  <span className="inline-block w-7 select-none text-emerald-300">+45</span>&#125;
                </div>
                <div className="bg-emerald-500/15 text-emerald-200 -mx-2 px-2 rounded">
                  <span className="inline-block w-7 select-none text-emerald-300">+46</span>return db.execute(sql`SELECT * FROM orders WHERE id = ${'{orderId}'}`);
                </div>
                <div className="text-[#D4D4DC]"><span className="inline-block w-7 select-none opacity-60">47</span>&#125;</div>
              </div>
            </div>
          </div>

          {/* Explanation & Verification Footer */}
          <div className="px-5 py-4 bg-white border-t border-[#E8E8ED] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
            <p className="text-[#555562] max-w-2xl leading-relaxed">
              <strong className="text-[#17171C] font-semibold">Modification summary:</strong> Validates the <code className="font-mono">orderId</code> format before querying and binds the value via Drizzle&apos;s parameterized <code className="font-mono">sql</code> template so input is never interpreted as SQL syntax.
            </p>
            <div className="flex items-center gap-2 shrink-0 font-medium">
              {reviewState === 'verified' ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Verified: rule sql-string-interpolation cleared</span>
                </span>
              ) : (
                <span className="text-[#73737D]">
                  No repository changes are applied without your approval.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
