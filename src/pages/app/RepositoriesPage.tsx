import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { FolderPlus, GitBranch, Github, Search, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { StatusLabel } from '../../components/SeverityTag';
import { useAuth } from '../../context/AuthContext';

interface RepoItem {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  defaultBranch: string;
  language: string;
  isPrivate: boolean;
  healthScore: number | null;
  status: string;
  lastScanAt: string | null;
}

interface GitHubAvailableRepo {
  id: string;
  fullName: string;
  description: string;
  language: string;
  defaultBranch: string;
  isPrivate: boolean;
}

export function RepositoriesPage() {
  const { apiFetch, session, refreshSession } = useAuth();
  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [importInput, setImportInput] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [ghRepos, setGhRepos] = useState<GitHubAvailableRepo[]>([]);
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [savingPat, setSavingPat] = useState(false);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ repositories: RepoItem[] }>('/api/repositories');
      setRepos(res.repositories);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load repositories.' });
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const handleSaveToken = async (e: FormEvent) => {
    e.preventDefault();
    if (!patInput.trim()) return;
    setSavingPat(true);
    setMessage(null);
    try {
      const res = await apiFetch<{ ok: boolean; username: string }>('/api/github/token', {
        method: 'POST',
        body: JSON.stringify({ token: patInput.trim() }),
      });
      setPatInput('');
      setShowTokenForm(false);
      await refreshSession();
      setMessage({ type: 'success', text: `Connected GitHub access token for @${res.username}.` });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to verify GitHub Personal Access Token.',
      });
    } finally {
      setSavingPat(false);
    }
  };

  const handleLoadGitHubList = async () => {
    try {
      const data = await apiFetch<{ connected: boolean; repos: GitHubAvailableRepo[] }>('/api/github/repos');
      setGhRepos(data.repos || []);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load GitHub repositories.' });
    }
  };

  const handleImport = async (e: FormEvent, explicitName?: string) => {
    e.preventDefault();
    const target = explicitName || importInput.trim();
    if (!target) {
      setMessage({ type: 'error', text: 'Enter a repository as owner/name or GitHub URL.' });
      return;
    }
    setImporting(true);
    setMessage(null);
    try {
      const res = await apiFetch<{ repository: RepoItem; alreadyConnected?: boolean }>('/api/github/import', {
        method: 'POST',
        body: JSON.stringify({ fullName: target }),
      });
      setImportInput('');
      setMessage({
        type: 'success',
        text: res.alreadyConnected
          ? `${res.repository.fullName} is already connected.`
          : `Imported ${res.repository.fullName}. Ready to scan.`,
      });
      await loadRepos();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Import failed.' });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (repo: RepoItem) => {
    try {
      await apiFetch(`/api/repositories/${repo.id}`, { method: 'DELETE' });
      setRepos((prev) => prev.filter((r) => r.id !== repo.id));
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to remove repository.' });
    }
  };

  const filtered = repos.filter((r) => {
    const matchesSearch =
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.language.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell title="Repositories">
      <div className="space-y-6">
        {/* Connect & Import Panel */}
        <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-base font-semibold">Import GitHub Repository</h2>
              <p className="text-xs text-[#777783] dark:text-[#9898A6] mt-0.5">
                {session?.github.connected
                  ? `Connected to GitHub as @${session.github.githubUsername}`
                  : 'Import any public GitHub repository by owner/name, or add a Personal Access Token for private repositories and PRs.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {session?.github.connected ? (
                <button
                  type="button"
                  onClick={handleLoadGitHubList}
                  className="glass-btn-secondary inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span>Browse Authorized Repos</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTokenForm((v) => !v)}
                  className="glass-btn-secondary inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
                >
                  <Github className="h-3.5 w-3.5" />
                  <span>{showTokenForm ? 'Hide Token Form' : 'Add Access Token'}</span>
                </button>
              )}
            </div>
          </div>

          {showTokenForm && !session?.github.connected ? (
            <form onSubmit={handleSaveToken} className="flex flex-col sm:flex-row gap-3 pt-1">
              <label htmlFor="github-pat-input" className="sr-only">
                GitHub Personal Access Token
              </label>
              <input
                id="github-pat-input"
                type="password"
                value={patInput}
                onChange={(e) => setPatInput(e.target.value)}
                placeholder="Paste GitHub Personal Access Token (ghp_... or github_pat_...)"
                className="flex-1 px-3.5 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm focus:outline-none focus:border-[#7656D6]"
              />
              <button
                type="submit"
                disabled={savingPat}
                className="glass-btn-secondary px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0"
              >
                {savingPat ? 'Verifying...' : 'Save Token'}
              </button>
            </form>
          ) : null}

          <form onSubmit={(e) => handleImport(e)} className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="repo-import-input" className="sr-only">
              GitHub repository owner/name or URL
            </label>
            <input
              id="repo-import-input"
              type="text"
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="e.g. expressjs/express or https://github.com/owner/repo"
              className="flex-1 px-3.5 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm focus:outline-none focus:border-[#7656D6]"
            />
            <button
              type="submit"
              disabled={importing}
              className="glass-btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg disabled:opacity-60 text-sm font-semibold whitespace-nowrap shrink-0"
            >
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              <span>{importing ? 'Importing...' : 'Import Repository'}</span>
            </button>
          </form>

          {message ? (
            <div
              role={message.type === 'error' ? 'alert' : 'status'}
              className={`p-3 rounded-md text-xs border ${
                message.type === 'error'
                  ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                  : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {message.text}
            </div>
          ) : null}

          {ghRepos.length > 0 ? (
            <div className="pt-2 border-t border-[#E8E8ED] dark:border-[#2B2B34]">
              <div className="text-xs font-semibold mb-2">Authorized GitHub Repositories</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {ghRepos.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={(e) => handleImport(e, g.fullName)}
                    className="p-2.5 text-left rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] hover:border-[#7656D6] text-xs"
                  >
                    <div className="font-semibold truncate">{g.fullName}</div>
                    <div className="text-[#777783] mt-0.5 truncate">{g.language} · {g.isPrivate ? 'Private' : 'Public'}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#777783]" aria-hidden="true" />
            <label htmlFor="repo-search" className="sr-only">Search repositories</label>
            <input
              id="repo-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter repositories by name or language..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm focus:outline-none focus:border-[#7656D6]"
            />
          </div>

          <div className="glass-tab-bar flex flex-wrap items-center gap-1 p-1 rounded-lg">
            {[
              { id: 'all', label: 'All' },
              { id: 'healthy', label: 'Healthy' },
              { id: 'needs_attention', label: 'Needs Attention' },
              { id: 'critical', label: 'Critical' },
              { id: 'unscanned', label: 'Unscanned' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                  statusFilter === tab.id
                    ? 'glass-tab-active'
                    : 'text-[#777783] hover:text-[#17171C] dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Repositories Table */}
        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#777783]">Loading repositories...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#777783]">
              No repositories match your current filter. Import a repository above to begin scanning.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] text-xs text-[#777783] dark:text-[#9898A6]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Repository</th>
                    <th className="py-3 px-4 font-semibold">Language</th>
                    <th className="py-3 px-4 font-semibold">Branch</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Health Score</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                  {filtered.map((repo) => (
                    <tr key={repo.id} className="hover:bg-[#F8F8FA]/60 dark:hover:bg-[#19191F]/60">
                      <td className="py-3 px-4">
                        <Link to={`/app/repositories/${repo.id}`} className="font-semibold hover:text-[#7656D6]">
                          {repo.fullName}
                        </Link>
                        <div className="text-xs text-[#777783] dark:text-[#9898A6] truncate max-w-md">
                          {repo.description || 'Connected GitHub repository'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs">{repo.language}</td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <span className="inline-flex items-center gap-1">
                          <GitBranch className="h-3 w-3 text-[#777783]" aria-hidden="true" />
                          {repo.defaultBranch}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusLabel status={repo.status} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums">
                        {repo.healthScore !== null ? `${repo.healthScore}/100` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-3">
                          <Link
                            to={`/app/scanner?repoId=${repo.id}`}
                            className="text-xs font-semibold text-[#7656D6] hover:underline whitespace-nowrap"
                          >
                            Scan
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDelete(repo)}
                            aria-label={`Remove ${repo.fullName}`}
                            className="p-1 text-[#777783] hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
