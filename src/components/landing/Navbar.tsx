import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { RepoHealthLogo } from './RepoHealthLogo';

const NAV_LINKS = [
  { label: 'Product', href: '#product-preview', type: 'anchor' as const },
  { label: 'Features', href: '#analysis', type: 'anchor' as const },
  { label: 'How it works', href: '#workflow', type: 'anchor' as const },
  { label: 'Security', href: '#security', type: 'anchor' as const },
  { label: 'Documentation', href: '/documentation', type: 'route' as const },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  const handleAnchorClick = (href: string) => {
    setMobileOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-200 ${
        scrolled ? 'glass-nav' : 'glass-nav-top'
      }`}
    >
      <div className="max-w-[1200px] mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          }}
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7656D6] rounded"
        >
          <RepoHealthLogo />
        </a>

        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7 text-sm font-medium text-[#555562]">
          {NAV_LINKS.map((item) =>
            item.type === 'route' ? (
              <Link
                key={item.label}
                to={item.href}
                className="whitespace-nowrap shrink-0 hover:text-[#17171C] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7656D6] rounded"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleAnchorClick(item.href);
                }}
                className="whitespace-nowrap shrink-0 hover:text-[#17171C] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7656D6] rounded"
              >
                {item.label}
              </a>
            )
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link
            to="/login"
            className="glass-btn-secondary px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7656D6]"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="glass-btn-primary px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7656D6]"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-landing-nav"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="md:hidden glass-btn-secondary inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg focus-visible:outline-2 focus-visible:outline-[#7656D6]"
        >
          {mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen ? (
        <div
          id="mobile-landing-nav"
          className="md:hidden glass-drawer px-4 py-4 space-y-3"
        >
          <nav aria-label="Mobile navigation" className="flex flex-col space-y-1">
            {NAV_LINKS.map((item) =>
              item.type === 'route' ? (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-[#17171C] hover:bg-[#F8F8FA]"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={(e) => {
                    e.preventDefault();
                    handleAnchorClick(item.href);
                  }}
                  className="px-3 py-2.5 rounded-md text-sm font-medium text-[#17171C] hover:bg-[#F8F8FA]"
                >
                  {item.label}
                </a>
              )
            )}
          </nav>
          <div className="pt-3 border-t border-[#E8E8ED]/80 grid grid-cols-2 gap-3">
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="glass-btn-secondary py-2.5 px-4 rounded-lg text-center text-sm font-medium"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              onClick={() => setMobileOpen(false)}
              className="glass-btn-primary py-2.5 px-4 rounded-lg text-center text-sm font-semibold"
            >
              Get started
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
