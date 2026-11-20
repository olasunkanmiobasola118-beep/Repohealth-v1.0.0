import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Code2,
  Cpu,
  FileText,
  FolderGit2,
  GitBranch,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  ScanSearch,
  Settings,
  Shield,
  ShieldCheck,
  Stethoscope,
  Sun,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/app/repositories', label: 'Repositories', icon: FolderGit2 },
      { to: '/app/scanner', label: 'Repository Scanner', icon: ScanSearch },
      { to: '/app/scans', label: 'Scan History', icon: History },
    ],
  },
  {
    label: 'AI Doctor & Fixes',
    items: [
      { to: '/app/diagnosis', label: 'AI Diagnosis', icon: Stethoscope },
      { to: '/app/fix-center', label: 'AI Fix Center', icon: Wrench },
      { to: '/app/assistant', label: 'AI Assistant', icon: Bot },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { to: '/app/security', label: 'Security Center', icon: ShieldCheck },
      { to: '/app/code-quality', label: 'Code Quality', icon: Code2 },
      { to: '/app/dependencies', label: 'Dependencies', icon: Package },
      { to: '/app/architecture', label: 'Architecture', icon: GitBranch },
    ],
  },
  {
    label: 'Reporting & Workspace',
    items: [
      { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/app/reports', label: 'Reports', icon: FileText },
      { to: '/app/notifications', label: 'Notifications', icon: Bell },
      { to: '/app/settings/ai', label: 'AI Model Settings', icon: Cpu },
      { to: '/app/settings', label: 'General Settings', icon: Settings },
      { to: '/app/team', label: 'Team Management', icon: Users },
    ],
  },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { session, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileOpen(false);
    if (!mainRef.current) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    gsap.fromTo(
      mainRef.current,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out', clearProps: 'transform' }
    );
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#F8F8FA] dark:bg-[#19191F] border-r border-[#E8E8ED] dark:border-[#2B2B34]">
      <div className="h-14 px-5 flex items-center justify-between border-b border-[#E8E8ED] dark:border-[#2B2B34]">
        <Link to="/app/dashboard" className="flex items-center gap-2.5 text-[#17171C] dark:text-[#F4F4F6] font-display font-bold text-base tracking-tight whitespace-nowrap">
          <Activity className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
          <span>Repo Health</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-md text-[#777783] hover:text-[#17171C] dark:hover:text-white"
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav aria-label="Workspace navigation" className="flex-1 overflow-y-auto px-3 py-3 space-y-3.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 mb-1 text-[11px] font-semibold text-[#777783] dark:text-[#8E8E9E]">
              {group.label}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.to || (item.to === '/app/repositories' && pathname.startsWith('/app/repositories/'));
                const badge =
                  item.to === '/app/notifications' && (session?.unreadNotifications || 0) > 0
                    ? session?.unreadNotifications
                    : null;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                        active
                          ? 'bg-white dark:bg-[#101014] text-[#17171C] dark:text-[#F4F4F6] border border-[#E8E8ED] dark:border-[#2B2B34]'
                          : 'text-[#555562] dark:text-[#9898A6] hover:text-[#17171C] dark:hover:text-[#F4F4F6] hover:bg-white/60 dark:hover:bg-[#101014]/50'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 truncate">
                        <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#7656D6]' : ''}`} aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {badge ? (
                        <span className="text-[11px] font-mono tabular-nums text-[#7656D6] dark:text-[#A58DF5]">
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {isAdmin ? (
          <div>
            <div className="px-3 mb-1 text-[11px] font-semibold text-[#777783] dark:text-[#8E8E9E]">
              Admin
            </div>
            <ul className="space-y-0.5">
              <li>
                <Link
                  to="/app/admin/metrics"
                  className={`flex items-center justify-between px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    pathname === '/app/admin/metrics'
                      ? 'bg-white dark:bg-[#101014] text-[#17171C] dark:text-[#F4F4F6] border border-[#E8E8ED] dark:border-[#2B2B34]'
                      : 'text-[#555562] dark:text-[#9898A6] hover:text-[#17171C] dark:hover:text-[#F4F4F6] hover:bg-white/60 dark:hover:bg-[#101014]/50'
                  }`}
                >
                  <span className="flex items-center gap-2.5 truncate">
                    <Shield className={`h-4 w-4 shrink-0 ${pathname === '/app/admin/metrics' ? 'text-[#7656D6]' : ''}`} aria-hidden="true" />
                    <span className="truncate">Admin Metrics</span>
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </nav>

      <div className="p-3 border-t border-[#E8E8ED] dark:border-[#2B2B34] space-y-2">
        <div className="px-2 py-1.5">
          <div className="text-xs font-semibold text-[#17171C] dark:text-[#F4F4F6] truncate">
            {session?.workspace.name || 'Workspace'}
          </div>
          <div className="text-[11px] text-[#777783] dark:text-[#9898A6] truncate">
            {session?.user.email || ''}
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-[#555562] dark:text-[#9898A6] hover:text-[#17171C] dark:hover:text-white hover:bg-white dark:hover:bg-[#101014] transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Sign out</span>
        </button>
        <div className="px-2 pt-1 text-[11px] text-[#777783] dark:text-[#8E8E9E] truncate">
          Built by <span className="font-medium text-[#17171C] dark:text-[#F4F4F6]">Olasunkanmi Obasola</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-white dark:bg-[#101014] text-[#17171C] dark:text-[#F4F4F6]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-68 max-w-[82vw] h-full">{sidebarContent}</div>
          <button
            type="button"
            aria-label="Close overlay"
            className="flex-1 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 px-4 sm:px-6 glass-nav sticky top-0 z-30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden glass-btn-secondary p-2 -ml-1 rounded-lg"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-[#777783] dark:text-[#9898A6] hidden sm:inline whitespace-nowrap">
                {session?.workspace.name || 'Workspace'}
              </span>
              <span className="text-[#777783] dark:text-[#9898A6] hidden sm:inline" aria-hidden="true">/</span>
              <h1 className="font-display font-semibold text-[#17171C] dark:text-[#F4F4F6] truncate">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              className="glass-btn-secondary p-2 rounded-lg"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              to="/app/scanner"
              className="glass-btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
            >
              Run Scan
            </Link>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
