import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Cpu, Plug, ShieldAlert } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface ProviderRecord {
  id: number;
  providerKey: string;
  displayName: string;
  baseUrl: string;
  defaultModel: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  lastTestStatus: string;
  lastTestMessage: string;
}

interface AiPreferences {
  diagnosisProvider: string;
  diagnosisModel: string;
  fixProvider: string;
  fixModel: string;
  assistantProvider: string;
  assistantModel: string;
  sendPrivateCodeConsent: boolean;
}

interface CatalogItem {
  providerKey: string;
  modelId: string;
  label: string;
  tier: string;
  notes: string;
}

export function AiSettingsPage() {
  const { apiFetch, refreshSession } = useAuth();
  const [providers, setProviders] = useState<ProviderRecord[]>([]);
  const [prefs, setPrefs] = useState<AiPreferences | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [keyDrafts, setKeyDrafts] = useState<Record<string, { apiKey: string; baseUrl: string; defaultModel: string }>>({});
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<{
        providers: ProviderRecord[];
        preferences: AiPreferences;
        catalog: CatalogItem[];
      }>('/api/ai/settings');
      setProviders(res.providers);
      setPrefs(res.preferences);
      setCatalog(res.catalog);
      const drafts: Record<string, { apiKey: string; baseUrl: string; defaultModel: string }> = {};
      for (const p of res.providers) {
        drafts[p.providerKey] = {
          apiKey: '',
          baseUrl: p.baseUrl || '',
          defaultModel: p.defaultModel || '',
        };
      }
      setKeyDrafts(drafts);
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to load AI model settings.' });
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveProvider = async (providerKey: string) => {
    setSaving(true);
    setFeedback(null);
    try {
      const draft = keyDrafts[providerKey];
      await apiFetch(`/api/ai/providers/${providerKey}`, {
        method: 'PUT',
        body: JSON.stringify({
          baseUrl: draft.baseUrl,
          defaultModel: draft.defaultModel,
          ...(draft.apiKey ? { apiKey: draft.apiKey } : {}),
          isEnabled: true,
        }),
      });
      setFeedback({ type: 'success', text: `Saved ${providerKey} configuration securely on server.` });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (providerKey: string) => {
    setTestingKey(providerKey);
    setFeedback(null);
    try {
      const draft = keyDrafts[providerKey];
      const res = await apiFetch<{ ok: boolean; message: string; latencyMs: number }>(
        `/api/ai/providers/${providerKey}/test`,
        {
          method: 'POST',
          body: JSON.stringify({ model: draft?.defaultModel }),
        }
      );
      setFeedback({
        type: res.ok ? 'success' : 'error',
        text: `${res.message} (${res.latencyMs}ms)`,
      });
      await load();
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Test failed.' });
    } finally {
      setTestingKey(null);
    }
  };

  const handleSavePrefs = async (e: FormEvent) => {
    e.preventDefault();
    if (!prefs) return;
    setSaving(true);
    setFeedback(null);
    try {
      await apiFetch('/api/ai/preferences', {
        method: 'PUT',
        body: JSON.stringify(prefs),
      });
      await refreshSession();
      setFeedback({ type: 'success', text: 'Default workflow models saved to workspace preferences.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save preferences.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="AI Model Settings">
      <div className="space-y-8">
        {feedback ? (
          <div
            role={feedback.type === 'error' ? 'alert' : 'status'}
            className={`p-3.5 rounded-md text-xs border ${
              feedback.type === 'error'
                ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {feedback.text}
          </div>
        ) : null}

        {/* Workflow Model Routing */}
        {prefs ? (
          <form
            onSubmit={handleSavePrefs}
            className="p-6 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] space-y-5"
          >
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[#7656D6]" />
              <h2 className="font-display text-base font-semibold">Default Workflow Model Routing</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  title: 'AI Doctor Diagnosis',
                  pKey: 'diagnosisProvider' as const,
                  mKey: 'diagnosisModel' as const,
                },
                {
                  title: 'AI Fix Center Generation',
                  pKey: 'fixProvider' as const,
                  mKey: 'fixModel' as const,
                },
                {
                  title: 'Repository Assistant',
                  pKey: 'assistantProvider' as const,
                  mKey: 'assistantModel' as const,
                },
              ].map((wf) => (
                <div key={wf.title} className="p-4 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] space-y-3">
                  <div className="text-xs font-semibold">{wf.title}</div>
                  <div>
                    <label className="block text-[11px] text-[#777783] mb-1">Provider</label>
                    <select
                      value={prefs[wf.pKey]}
                      onChange={(e) => {
                        const nextProvider = e.target.value;
                        const firstModel = catalog.find((c) => c.providerKey === nextProvider)?.modelId || prefs[wf.mKey];
                        setPrefs({ ...prefs, [wf.pKey]: nextProvider, [wf.mKey]: firstModel });
                      }}
                      className="w-full px-2.5 py-1.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#19191F] text-xs"
                    >
                      {providers.map((p) => (
                        <option key={p.providerKey} value={p.providerKey}>{p.displayName}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#777783] mb-1">Model ID</label>
                    <input
                      type="text"
                      list={`catalog-models-${wf.pKey}`}
                      value={prefs[wf.mKey]}
                      onChange={(e) => setPrefs({ ...prefs, [wf.mKey]: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#19191F] text-xs font-mono"
                    />
                    <datalist id={`catalog-models-${wf.pKey}`}>
                      {catalog
                        .filter((c) => c.providerKey === prefs[wf.pKey])
                        .map((c) => (
                          <option key={c.modelId} value={c.modelId}>{c.label}</option>
                        ))}
                    </datalist>
                  </div>
                </div>
              ))}
            </div>

            <label className="flex items-start gap-2.5 text-xs text-[#555562] dark:text-[#9898A6] cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.sendPrivateCodeConsent}
                onChange={(e) => setPrefs({ ...prefs, sendPrivateCodeConsent: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                Allow transmitting redacted code excerpts from private repositories to the selected server-side AI provider when explicitly requesting Diagnosis, Fix Generation, or Assistant answers.
              </span>
            </label>

            <button
              type="submit"
              disabled={saving}
              className="glass-btn-primary px-4 py-2 rounded-lg text-xs font-semibold"
            >
              {saving ? 'Saving...' : 'Save Model Preferences'}
            </button>
          </form>
        ) : null}

        {/* Provider Credentials & Connectivity */}
        <div className="space-y-4">
          <h2 className="font-display text-base font-semibold">AI Providers &amp; Server-Side Credentials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map((p) => {
              const draft = keyDrafts[p.providerKey] || { apiKey: '', baseUrl: p.baseUrl, defaultModel: p.defaultModel };
              const isPlatformGemini = p.providerKey === 'gemini';
              return (
                <div key={p.providerKey} className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-sm font-semibold">{p.displayName}</h3>
                      <div className="text-xs text-[#777783] mt-0.5">{p.lastTestMessage || 'Not tested yet'}</div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium ${
                        p.lastTestStatus === 'ok'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : p.lastTestStatus === 'error'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-[#777783]'
                      }`}
                    >
                      {p.lastTestStatus === 'ok' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                      {p.lastTestStatus === 'ok' ? 'Connected' : p.lastTestStatus === 'error' ? 'Error' : 'Untested'}
                    </span>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block text-[#777783] mb-1">Default Model ID</label>
                      <input
                        type="text"
                        list={`provider-models-${p.providerKey}`}
                        value={draft.defaultModel}
                        onChange={(e) =>
                          setKeyDrafts((prev) => ({
                            ...prev,
                            [p.providerKey]: { ...draft, defaultModel: e.target.value },
                          }))
                        }
                        className="w-full px-3 py-1.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#19191F] font-mono"
                      />
                      <datalist id={`provider-models-${p.providerKey}`}>
                        {catalog
                          .filter((c) => c.providerKey === p.providerKey)
                          .map((c) => (
                            <option key={c.modelId} value={c.modelId}>{c.label}</option>
                          ))}
                      </datalist>
                    </div>

                    {!isPlatformGemini ? (
                      <>
                        <div>
                          <label className="block text-[#777783] mb-1">API Base URL</label>
                          <input
                            type="url"
                            value={draft.baseUrl}
                            placeholder={p.providerKey === 'gemma' ? 'https://your-vllm-or-ollama-host/v1' : 'https://api.deepseek.com/v1'}
                            onChange={(e) =>
                              setKeyDrafts((prev) => ({
                                ...prev,
                                [p.providerKey]: { ...draft, baseUrl: e.target.value },
                              }))
                            }
                            className="w-full px-3 py-1.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#19191F] font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[#777783] mb-1">
                            API Credential {p.hasApiKey ? '(Stored encrypted on server)' : '(Not set)'}
                          </label>
                          <input
                            type="password"
                            value={draft.apiKey}
                            placeholder={p.hasApiKey ? '•••••••••••••••• (enter new value to rotate)' : 'Paste provider token (encrypted server-side)'}
                            onChange={(e) =>
                              setKeyDrafts((prev) => ({
                                ...prev,
                                [p.providerKey]: { ...draft, apiKey: e.target.value },
                              }))
                            }
                            className="w-full px-3 py-1.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#19191F] font-mono"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="p-2.5 rounded bg-[#F8F8FA] dark:bg-[#19191F] text-[#777783]">
                        Managed securely via platform environment secret <code className="font-mono">GEMINI_API_KEY</code>.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => handleSaveProvider(p.providerKey)}
                      className="glass-btn-primary px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      Save Config
                    </button>
                    <button
                      type="button"
                      disabled={testingKey === p.providerKey}
                      onClick={() => handleTest(p.providerKey)}
                      className="glass-btn-secondary inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                    >
                      <Plug className="h-3.5 w-3.5" />
                      <span>{testingKey === p.providerKey ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model Comparison Catalog */}
        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
          <div className="px-5 py-3 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] font-display text-sm font-semibold">
            Supported Model Reference
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E8E8ED] dark:border-[#2B2B34] text-[#777783]">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Model</th>
                  <th className="py-2.5 px-4 font-semibold">API Identifier</th>
                  <th className="py-2.5 px-4 font-semibold">Provider</th>
                  <th className="py-2.5 px-4 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                {catalog.map((c) => (
                  <tr key={c.modelId}>
                    <td className="py-2.5 px-4 font-semibold">{c.label}</td>
                    <td className="py-2.5 px-4 font-mono">{c.modelId}</td>
                    <td className="py-2.5 px-4 capitalize">{c.providerKey}</td>
                    <td className="py-2.5 px-4 text-[#555562] dark:text-[#9898A6]">{c.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
