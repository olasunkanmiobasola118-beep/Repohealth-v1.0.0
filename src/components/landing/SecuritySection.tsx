import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const SECURITY_PRINCIPLES = [
  {
    title: 'Secure GitHub authorization',
    description:
      'Connect repositories through explicit authorization tokens and import public or permitted private repositories without storing credentials in browser clients.',
  },
  {
    title: 'Appropriate repository permissions',
    description:
      'Scanning inspects repository trees in read-only mode. Repository write permissions are only used when an engineer explicitly approves creating a branch or pull request.',
  },
  {
    title: 'Protected credentials',
    description:
      'GitHub tokens and third-party AI provider API keys are encrypted server-side with AES-256-GCM and masked before logging or display.',
  },
  {
    title: 'Controlled AI access',
    description:
      'Private source code transmission requires explicit workspace consent, detected secrets are redacted prior to prompt assembly, and untrusted code is isolated from system instructions.',
  },
  {
    title: 'Human-reviewed code changes',
    description:
      'AI Doctor proposes diffs for inspection rather than mutating branches silently. Developers review every line and approve patches intentionally.',
  },
  {
    title: 'Verification before resolution',
    description:
      'Approved fixes run through deterministic re-scanning so findings are marked resolved only when the underlying pattern is confirmed absent.',
  },
];

export function SecuritySection() {
  return (
    <section id="security" className="py-20 sm:py-24 bg-[#111116] text-[#F4F4F6] scroll-mt-16">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5 space-y-5 reveal-block">
          <div className="text-xs font-medium text-[#A58DF5]">Security &amp; developer control</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
            Your code. Your permissions. Your decisions.
          </h2>
          <p className="text-base text-[#A8A8B6] leading-relaxed">
            Repository access and proposed changes remain under developer control at every step of the scan, diagnosis, and remediation lifecycle.
          </p>
          <div className="pt-2">
            <Link
              to="/security"
              className="inline-flex items-center gap-2 text-sm font-medium text-white hover:text-[#B7A6F6] transition-colors focus-visible:outline-2 focus-visible:outline-[#7656D6] rounded"
            >
              <span>Read architecture &amp; security details</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="lg:col-span-7 divide-y divide-white/10 border-y border-white/10 reveal-block">
          {SECURITY_PRINCIPLES.map((item) => (
            <div key={item.title} className="py-5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6">
              <h3 className="sm:col-span-5 font-display text-sm font-semibold text-white">
                {item.title}
              </h3>
              <p className="sm:col-span-7 text-sm text-[#A8A8B6] leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
