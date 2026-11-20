import { Link } from 'react-router-dom';
import { RepoHealthLogo } from './RepoHealthLogo';

export function Footer() {
  return (
    <footer className="bg-white border-t border-[#E8E8ED]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-8 lg:gap-10">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-4 space-y-3">
            <Link to="/" className="inline-flex focus-visible:outline-2 focus-visible:outline-[#7656D6] rounded">
              <RepoHealthLogo />
            </Link>
            <p className="text-sm text-[#555562] max-w-xs leading-relaxed">
              Deterministic code scanning paired with structured AI diagnosis and human-approved remediation.
            </p>
          </div>

          {/* Product */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-xs font-semibold text-[#111114]">Product</div>
            <ul className="space-y-2.5 text-sm text-[#555562]">
              <li><Link to="/features" className="hover:text-[#17171C] transition-colors">Features</Link></li>
              <li><a href="/#ai-doctor" className="hover:text-[#17171C] transition-colors">AI Doctor</a></li>
              <li><a href="/#workflow" className="hover:text-[#17171C] transition-colors">Repository Scanner</a></li>
              <li><Link to="/security" className="hover:text-[#17171C] transition-colors">Security</Link></li>
              <li><a href="/#analysis" className="hover:text-[#17171C] transition-colors">Integrations</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-xs font-semibold text-[#111114]">Resources</div>
            <ul className="space-y-2.5 text-sm text-[#555562]">
              <li><Link to="/documentation" className="hover:text-[#17171C] transition-colors">Documentation</Link></li>
              <li><Link to="/register" className="hover:text-[#17171C] transition-colors">Getting started</Link></li>
              <li><Link to="/documentation" className="hover:text-[#17171C] transition-colors">Support</Link></li>
              <li><Link to="/documentation" className="hover:text-[#17171C] transition-colors">FAQ</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-xs font-semibold text-[#111114]">Company</div>
            <ul className="space-y-2.5 text-sm text-[#555562]">
              <li><a href="/#workflow" className="hover:text-[#17171C] transition-colors">About</a></li>
              <li><Link to="/pricing" className="hover:text-[#17171C] transition-colors">Pricing</Link></li>
              <li><Link to="/security" className="hover:text-[#17171C] transition-colors">Privacy</Link></li>
              <li><Link to="/security" className="hover:text-[#17171C] transition-colors">Terms</Link></li>
            </ul>
          </div>

          {/* Social / GitHub */}
          <div className="md:col-span-2 space-y-3">
            <div className="text-xs font-semibold text-[#111114]">Platform</div>
            <ul className="space-y-2.5 text-sm text-[#555562]">
              <li><Link to="/register?connect=github" className="hover:text-[#17171C] transition-colors">GitHub Workflow</Link></li>
              <li><Link to="/login" className="hover:text-[#17171C] transition-colors">Sign in</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#E8E8ED] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#73737D]">
          <span>
            © 2026 Repo Health · Created &amp; engineered by{' '}
            <strong className="font-semibold text-[#17171C]">Olasunkanmi Obasola</strong>
          </span>
          <span>Deterministic analysis · Human-approved remediation</span>
        </div>
      </div>
    </footer>
  );
}
