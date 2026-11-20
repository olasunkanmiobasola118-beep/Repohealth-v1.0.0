import { useState } from 'react';

type WorkflowRole = 'diagnosis' | 'fix' | 'assistant';

const PROVIDERS = [
  {
    key: 'gemini',
    provider: 'Gemini',
    model: 'gemini-4-hydrogen',
    altModel: 'gemini-3.1-flash-lite',
    status: 'Platform key supported',
    availability: 'Ready with configured GEMINI_API_KEY',
  },
  {
    key: 'gemma',
    provider: 'Gemma',
    model: 'gemma-3-27b-it',
    altModel: 'gemma-3-12b-it',
    status: 'Configurable gateway (BYOK)',
    availability: 'OpenAI-compatible endpoint + encrypted key',
  },
  {
    key: 'deepseek',
    provider: 'DeepSeek',
    model: 'deepseek-chat',
    altModel: 'deepseek-reasoner',
    status: 'Configurable API key (BYOK)',
    availability: 'Requires user DeepSeek API credential',
  },
  {
    key: 'openai_compatible',
    provider: 'Additional OpenAI-Compatible',
    model: 'Custom model identifier',
    altModel: 'Self-hosted or VPC gateway',
    status: 'Configurable base URL',
    availability: 'Encrypted at rest on server',
  },
];

export function ModelSelectionShowcase() {
  const [role, setRole] = useState<WorkflowRole>('diagnosis');
  const [selectedByRole, setSelectedByRole] = useState<Record<WorkflowRole, string>>({
    diagnosis: 'gemini',
    fix: 'deepseek',
    assistant: 'gemma',
  });

  const activeProvider = selectedByRole[role];

  return (
    <section className="py-20 sm:py-24 bg-[#F8F8FA] border-b border-[#E8E8ED]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        <div className="lg:col-span-5 space-y-4 reveal-block">
          <div className="text-xs font-medium text-[#7656D6]">Model routing</div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#111114] text-balance">
            Your choice of AI intelligence.
          </h2>
          <p className="text-base text-[#555562] leading-relaxed">
            Repo Health is designed to support multiple AI providers, allowing developers to choose models that suit their diagnosis, patch generation, and repository exploration workflows.
          </p>
          <p className="text-sm text-[#73737D] leading-relaxed">
            Model availability depends on configured API keys, provider endpoints, and explicit workspace consent before private source context is sent.
          </p>
        </div>

        <div className="lg:col-span-7 reveal-block">
          <div className="border border-[#E8E8ED] rounded-xl bg-white overflow-hidden">
            {/* Role Selector Bar */}
            <div className="px-5 py-3.5 bg-[#F8F8FA] border-b border-[#E8E8ED] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#17171C]">
                Workflow model assignment (Preview)
              </span>
              <div role="tablist" aria-label="AI workflow role" className="glass-tab-bar flex items-center gap-1 p-1 rounded-lg">
                {(
                  [
                    ['diagnosis', 'AI Diagnosis'],
                    ['fix', 'AI Fix Center'],
                    ['assistant', 'Assistant'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={role === id}
                    onClick={() => setRole(id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#7656D6] ${
                      role === id
                        ? 'glass-tab-active'
                        : 'text-[#555562] hover:text-[#17171C] hover:bg-white/75'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clean Provider Selection Table */}
            <div className="divide-y divide-[#E8E8ED]">
              {PROVIDERS.map((p) => {
                const isDefault = activeProvider === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() =>
                      setSelectedByRole((prev) => ({ ...prev, [role]: p.key }))
                    }
                    className={`w-full text-left px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#7656D6] ${
                      isDefault ? 'bg-[#F8F8FA]' : 'bg-white hover:bg-[#F8F8FA]/60'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-display text-sm font-semibold text-[#111114]">
                          {p.provider}
                        </span>
                        <code className="font-mono text-xs text-[#555562]">{p.model}</code>
                      </div>
                      <div className="mt-1 text-xs text-[#73737D]">{p.availability}</div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <span className="text-[#555562]">{p.status}</span>
                      <span
                        className={`font-mono text-[11px] font-semibold ${
                          isDefault ? 'text-[#7656D6]' : 'text-[#73737D]'
                        }`}
                      >
                        {isDefault ? 'Active default' : 'Select'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
