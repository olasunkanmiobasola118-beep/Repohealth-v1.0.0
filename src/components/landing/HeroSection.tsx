import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ProductPreview } from './ProductPreview';

export function HeroSection() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleConnectGitHub = () => {
    if (isAuthenticated) {
      navigate('/app/repositories');
    } else {
      navigate('/register?connect=github');
    }
  };

  const handleExploreWorkflow = () => {
    const el = document.getElementById('workflow');
    if (el) {
      el.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    }
  };

  return (
    <section className="bg-white pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <div className="lg:col-span-6 space-y-6">
          <div className="hero-animate text-xs font-medium text-[#7656D6] tracking-wide">
            Repository intelligence · AI Doctor
          </div>

          <h1 className="hero-animate font-display font-bold text-[#111114] text-[clamp(2.25rem,4vw,3.65rem)] leading-[1.08] tracking-tight text-balance">
            Your code deserves better health.
          </h1>

          <p className="hero-animate font-display text-lg sm:text-xl font-semibold text-[#17171C] leading-snug">
            Find problems. Understand their causes. Fix them with confidence.
          </p>

          <p className="hero-animate text-base text-[#555562] leading-relaxed max-w-xl">
            Repo Health analyzes your repositories, uncovers security and code quality issues, and uses AI to help you understand and resolve them.
          </p>

          <div className="hero-animate flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleConnectGitHub}
              className="glass-btn-primary inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7656D6]"
            >
              <span>Connect your GitHub</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleExploreWorkflow}
              className="glass-btn-secondary inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7656D6]"
            >
              Explore how it works
            </button>
          </div>

          <p className="hero-animate text-xs text-[#73737D]">
            Built for developers who care about the quality of their code.
          </p>
        </div>

        <div className="lg:col-span-6 hero-preview-animate">
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}
