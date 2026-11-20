import { type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { RepoHealthLogo } from './landing/RepoHealthLogo';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { theme } = useTheme();

  const navLinks = [
    { to: '/features', label: 'Features' },
    { to: '/security', label: 'Security' },
    { to: '/documentation', label: 'Documentation' },
    { to: '/pricing', label: 'Pricing' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#101014] text-[#17171C] dark:text-[#F4F4F6]">
      <header className="sticky top-0 z-40 glass-nav transition-all duration-200">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#7656D6] rounded"
          >
            <RepoHealthLogo inverted={theme === 'dark'} />
          </Link>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 text-sm font-medium text-[#555562] dark:text-[#9898A6]">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#17171C] dark:hover:text-white ${
                  pathname === link.to ? 'text-[#17171C] dark:text-white underline underline-offset-8 decoration-[#7656D6]' : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/login"
              className="glass-btn-secondary px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#7656D6]"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="glass-btn-primary px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#7656D6]"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="font-display font-bold text-base text-[#17171C] dark:text-[#F4F4F6]">
                Repo Health
              </div>
              <p className="mt-2 text-sm text-[#777783] dark:text-[#9898A6] max-w-xs">
                Deterministic code scanning paired with verifiable multi-model AI diagnosis and human-approved remediation.
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#17171C] dark:text-[#F4F4F6] mb-3">Platform</div>
              <ul className="space-y-2 text-sm text-[#777783] dark:text-[#9898A6]">
                <li><Link to="/features" className="hover:text-[#17171C] dark:hover:text-white">Features</Link></li>
                <li><Link to="/security" className="hover:text-[#17171C] dark:hover:text-white">Security</Link></li>
                <li><Link to="/pricing" className="hover:text-[#17171C] dark:hover:text-white">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#17171C] dark:text-[#F4F4F6] mb-3">Resources</div>
              <ul className="space-y-2 text-sm text-[#777783] dark:text-[#9898A6]">
                <li><Link to="/documentation" className="hover:text-[#17171C] dark:hover:text-white">Documentation</Link></li>
                <li><Link to="/login" className="hover:text-[#17171C] dark:hover:text-white">Sign in</Link></li>
                <li><Link to="/register" className="hover:text-[#17171C] dark:hover:text-white">Create account</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#17171C] dark:text-[#F4F4F6] mb-3">Trust</div>
              <p className="text-xs text-[#777783] dark:text-[#9898A6] leading-relaxed">
                Zero client-side AI keys. No unapproved code writes. Explicit consent required before transmitting private source files.
              </p>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-[#E8E8ED] dark:border-[#2B2B34] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#777783] dark:text-[#9898A6]">
            <span>
              © 2026 Repo Health · Created &amp; engineered by{' '}
              <strong className="font-semibold text-[#17171C] dark:text-[#F4F4F6]">Olasunkanmi Obasola</strong>
            </span>
            <span>Deterministic analysis · Human-approved remediation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
