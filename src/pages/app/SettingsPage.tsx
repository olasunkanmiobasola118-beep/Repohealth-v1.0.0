import { useEffect, useState, type FormEvent } from 'react';
import { Github, Moon, Sun } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';

export function SettingsPage() {
  const { session, apiFetch, refreshSession } = useAuth();
  const { theme, setTheme } = useTheme();
  const [wsName, setWsName] = useState(session?.workspace.name || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (session?.workspace.name) {
      setWsName(session.workspace.name);
    }
  }, [session?.workspace.name]);

  const handleRename = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch('/api/workspace/name', {
        method: 'PUT',
        body: JSON.stringify({ name: wsName }),
      });
      await refreshSession();
      setMsg('Workspace name updated.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectGh = async () => {
    setMsg(null);
    try {
      await apiFetch('/api/github/disconnect', { method: 'POST' });
      await refreshSession();
      setMsg('GitHub integration disconnected.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Failed to disconnect GitHub.');
    }
  };

  return (
    <AppShell title="General Settings">
      <div className="max-w-3xl space-y-6">
        <div className="p-6 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] space-y-4">
          <h2 className="font-display text-base font-semibold">Profile &amp; Workspace</h2>
          <div className="text-xs text-[#777783] space-y-1">
            <div>Account: <span className="text-[#17171C] dark:text-[#F4F4F6] font-medium">{session?.user.email}</span></div>
            <div>Role: <span className="capitalize font-medium">{session?.user.role}</span></div>
          </div>
          <form onSubmit={handleRename} className="flex flex-col sm:flex-row gap-3 pt-2">
            <label htmlFor="ws-name" className="sr-only">Workspace name</label>
            <input
              id="ws-name"
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#19191F] text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="glass-btn-primary px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
            >
              {saving ? 'Saving...' : 'Save Workspace'}
            </button>
          </form>
          {msg ? <div className="text-xs text-[#7656D6]">{msg}</div> : null}
        </div>

        <div className="p-6 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] space-y-4">
          <h2 className="font-display text-base font-semibold">Appearance</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold ${
                theme === 'light' ? 'glass-tab-active' : 'glass-btn-secondary'
              }`}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Light Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold ${
                theme === 'dark' ? 'glass-tab-active' : 'glass-btn-secondary'
              }`}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Dark Mode</span>
            </button>
          </div>
        </div>

        <div className="p-6 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] space-y-3">
          <div className="flex items-center gap-2">
            <Github className="h-4 w-4 text-[#7656D6]" />
            <h2 className="font-display text-base font-semibold">GitHub Connection</h2>
          </div>
          {session?.github.connected ? (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>Connected as <strong className="font-mono">@{session.github.githubUsername}</strong></span>
              <button
                type="button"
                onClick={handleDisconnectGh}
                className="px-3 py-1.5 rounded border border-red-300 text-red-600 text-xs font-semibold"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="text-xs text-[#777783] space-y-1.5">
              <p>No GitHub Personal Access Token is connected for this workspace.</p>
              <p>Public GitHub repositories can be imported directly by owner/name on the Repositories page, or you can add a Personal Access Token there for private repositories and Pull Requests.</p>
            </div>
          )}
        </div>

        <div className="p-6 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] space-y-2">
          <h2 className="font-display text-base font-semibold">Credits &amp; Authorship</h2>
          <p className="text-xs text-[#555562] dark:text-[#9898A6] leading-relaxed">
            Repo Health was designed, architected, and engineered in full by{' '}
            <strong className="font-semibold text-[#17171C] dark:text-[#F4F4F6]">Olasunkanmi Obasola</strong>.
          </p>
          <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#777783] dark:text-[#8E8E9E]">
            <span>Creator &amp; Lead Engineer: <span className="font-medium text-[#17171C] dark:text-[#F4F4F6]">Olasunkanmi Obasola</span></span>
            <span aria-hidden="true">·</span>
            <span>© 2026 Repo Health</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
