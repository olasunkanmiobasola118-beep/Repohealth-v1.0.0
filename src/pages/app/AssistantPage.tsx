import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Bot, Send } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface RepoOption {
  id: number;
  fullName: string;
}

interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  evidenceFiles?: string[];
  timestamp: string;
}

interface ThreadRecord {
  id: number;
  repositoryId: number | null;
  title: string;
  messagesJson: ThreadMessage[];
}

export function AssistantPage() {
  const { apiFetch, session } = useAuth();
  const [repos, setRepos] = useState<RepoOption[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [threads, setThreads] = useState<ThreadRecord[]>([]);
  const [activeThread, setActiveThread] = useState<ThreadRecord | null>(null);
  const [question, setQuestion] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ repositories: RepoOption[] }>('/api/repositories'),
      apiFetch<{ threads: ThreadRecord[] }>('/api/assistant/threads'),
    ])
      .then(([r, t]) => {
        setRepos(r.repositories);
        if (r.repositories.length > 0) setSelectedRepoId(String(r.repositories[0].id));
        setThreads(t.threads);
        if (t.threads.length > 0) setActiveThread(t.threads[0]);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load assistant workspace data.');
      });
  }, [apiFetch]);

  const handleAsk = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !selectedRepoId) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch<{ thread: ThreadRecord }>('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({
          repositoryId: Number(selectedRepoId),
          threadId: activeThread?.id || null,
          question: question.trim(),
        }),
      });
      setQuestion('');
      setActiveThread(res.thread);
      setThreads((prev) => [res.thread, ...prev.filter((t) => t.id !== res.thread.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant query failed.');
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="AI Assistant">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] space-y-3">
            <label htmlFor="assistant-repo" className="block text-xs font-semibold">
              Repository Context
            </label>
            <select
              id="assistant-repo"
              value={selectedRepoId}
              onChange={(e) => {
                setSelectedRepoId(e.target.value);
                setActiveThread(null);
              }}
              className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm"
            >
              {repos.length === 0 ? (
                <option value="">No repositories imported yet</option>
              ) : (
                repos.map((r) => (
                  <option key={r.id} value={r.id}>{r.fullName}</option>
                ))
              )}
            </select>
            {repos.length === 0 ? (
              <Link to="/app/repositories" className="block text-xs font-semibold text-[#7656D6] hover:underline">
                Import a repository first →
              </Link>
            ) : null}
            <div className="text-xs text-[#777783]">
              Model: <span className="font-mono">{session?.aiPreferences?.assistantModel || 'gemini-4-hydrogen'}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveThread(null)}
              className="glass-btn-secondary w-full py-2 rounded-lg text-xs font-semibold"
            >
              Start New Conversation
            </button>
          </div>

          <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] text-xs font-semibold">
              Recent Threads
            </div>
            <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34] max-h-80 overflow-y-auto">
              {threads.length === 0 ? (
                <div className="p-4 text-xs text-[#777783]">No previous threads.</div>
              ) : (
                threads.map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => {
                      setActiveThread(th);
                      if (th.repositoryId) setSelectedRepoId(String(th.repositoryId));
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs truncate ${
                      activeThread?.id === th.id ? 'bg-[#7656D6]/10 font-semibold' : 'hover:bg-[#F8F8FA] dark:hover:bg-[#19191F]'
                    }`}
                  >
                    {th.title}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg flex flex-col min-h-[65vh] bg-white dark:bg-[#101014]">
          <div className="px-5 py-3 border-b border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
            <span className="font-display text-sm font-semibold">Grounded Repository Intelligence</span>
          </div>

          <div className="flex-1 p-5 space-y-4 overflow-y-auto">
            {!activeThread || activeThread.messagesJson.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <p className="text-sm font-medium">Ask about architecture, findings, files, or remediation strategy.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'Which critical findings should we fix first and why?',
                    'Explain the module structure and any circular dependencies.',
                    'Summarize the security risks in the retrieved files.',
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setQuestion(prompt)}
                      className="px-3 py-1.5 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] text-xs hover:border-[#7656D6]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              activeThread.messagesJson.map((m, i) => (
                <div
                  key={i}
                  className={`p-4 rounded-lg border text-sm ${
                    m.role === 'user'
                      ? 'border-[#7656D6]/30 bg-[#7656D6]/5 ml-8'
                      : 'border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] mr-8'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-[#777783] mb-1.5">
                    {m.role === 'user' ? 'Developer' : `AI Assistant · ${m.model || ''}`}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  {m.evidenceFiles?.length ? (
                    <div className="mt-2.5 pt-2 border-t border-[#E8E8ED] dark:border-[#2B2B34] text-[11px] font-mono text-[#777783]">
                      Retrieved context: {m.evidenceFiles.join(', ')}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>

          {error ? (
            <div role="alert" className="mx-5 mb-2 p-2.5 rounded border border-red-300 text-xs text-red-600">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleAsk} className="p-4 border-t border-[#E8E8ED] dark:border-[#2B2B34] flex gap-3">
            <label htmlFor="assistant-input" className="sr-only">Ask repository question</label>
            <input
              id="assistant-input"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question grounded in the selected repository..."
              className="flex-1 px-3.5 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#19191F] text-sm focus:outline-none focus:border-[#7656D6]"
            />
            <button
              type="submit"
              disabled={sending || !question.trim() || !selectedRepoId}
              className="glass-btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-60 text-sm font-semibold whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{sending ? 'Thinking...' : 'Ask'}</span>
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
