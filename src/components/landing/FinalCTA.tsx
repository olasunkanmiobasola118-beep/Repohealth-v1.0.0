import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function FinalCTA() {
  return (
    <section className="py-20 sm:py-24 bg-[#F8F8FA] border-b border-[#E8E8ED]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 reveal-block">
        <div className="border border-[#E8E8ED] rounded-xl bg-white p-8 sm:p-12 lg:p-14 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-xl space-y-3">
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111114] text-balance">
              Build healthier repositories. Starting today.
            </h2>
            <p className="text-base text-[#555562] leading-relaxed">
              Understand your codebase, resolve problems with confidence, and keep your repositories in better shape.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Link
              to="/register"
              className="glass-btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7656D6]"
            >
              <span>Get started with Repo Health</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/features"
              className="glass-btn-secondary inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-semibold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7656D6]"
            >
              Explore the platform
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
