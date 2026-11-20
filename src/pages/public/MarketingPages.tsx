import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/PublicLayout';

export function FeaturesPage() {
  const sections = [
    {
      title: 'Deterministic Multi-Category Scanner',
      body: 'Scans repository files for exposed secrets, SQL injection, unsafe eval/exec patterns, weak cryptography, TypeScript type escapes, high cyclomatic complexity, duplicate code blocks, circular imports, and OSV dependency advisories.',
    },
    {
      title: 'AI Doctor & Root-Cause Diagnostics',
      body: 'Pairs confirmed scanner findings with source context to generate structured diagnoses: root cause, security/operational impact, recommended fix strategy, and verification criteria.',
    },
    {
      title: 'AI Fix Center & Diff Approval',
      body: 'Generates minimal patches displayed in unified or side-by-side diff views. Every patch requires explicit human approval before verification checks or GitHub Pull Request creation.',
    },
    {
      title: 'Multi-Model Intelligence',
      body: 'Switch seamlessly between Google Gemini 4, Gemma 3, DeepSeek Coder/Reasoner, and custom OpenAI-compatible gateways per workflow.',
    },
  ];

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Platform Features</h1>
        <p className="mt-3 text-base text-[#555562] dark:text-[#9898A6] max-w-2xl">
          Every stage of repository health management integrated into one engineering workspace.
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {sections.map((s) => (
            <div key={s.title} className="p-6 rounded-xl border border-[#E8E8ED] dark:border-[#2B2B34]">
              <h2 className="font-display text-lg font-semibold">{s.title}</h2>
              <p className="mt-2 text-sm text-[#555562] dark:text-[#9898A6] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <Link to="/login" className="glass-btn-primary inline-flex px-5 py-2.5 rounded-lg text-sm font-semibold">
            Launch workspace
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}

export function SecurityPage() {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Security &amp; Architecture Trust</h1>
          <p className="mt-3 text-base text-[#555562] dark:text-[#9898A6]">
            Repo Health is built to analyze untrusted source code safely without exposing secrets or allowing unapproved repository mutations.
          </p>
        </div>

        <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34] border-y border-[#E8E8ED] dark:border-[#2B2B34]">
          {[
            ['Server-Side Secret Encryption', 'Third-party AI provider credentials and GitHub access tokens are encrypted at rest with AES-256-GCM and never transmitted back to browser clients.'],
            ['Prompt-Injection Isolation', 'Scanned source code, comments, and README files are encapsulated inside untrusted data boundaries so repository content cannot override model system directives.'],
            ['Secret Redaction', 'Detected AWS keys, GitHub tokens, and credentials are masked before excerpt storage, logging, or AI prompt construction.'],
            ['Human-in-the-Loop Remediation', 'No automatic repository writes. Approved patches are verified via deterministic re-scan before opening a branch or Pull Request.'],
          ].map(([title, desc]) => (
            <div key={title} className="py-5">
              <h2 className="font-display text-base font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-[#555562] dark:text-[#9898A6]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}

export function DocumentationPage() {
  return (
    <PublicLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-10">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Documentation</h1>
          <p className="mt-3 text-base text-[#555562] dark:text-[#9898A6]">
            Quickstart guide for connecting repositories, configuring AI providers, and verifying code fixes.
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-[#E8E8ED] dark:border-[#2B2B34]">
            <h2 className="font-display text-lg font-semibold">1. Connecting Repositories</h2>
            <p className="mt-2 text-sm text-[#555562] dark:text-[#9898A6] leading-relaxed">
              Import any public GitHub repository directly by <code className="font-mono text-xs">owner/name</code>, or add a GitHub Personal Access Token on the Repositories page to browse private repositories and open Pull Requests from the Fix Center.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[#E8E8ED] dark:border-[#2B2B34]">
            <h2 className="font-display text-lg font-semibold">2. Health Scoring Methodology</h2>
            <p className="mt-2 text-sm text-[#555562] dark:text-[#9898A6] leading-relaxed">
              Overall score is weighted deterministically: Security (30%), Code Quality (20%), Dependency Health (20%), Maintainability (15%), Testing &amp; Docs (10%), and Configuration (5%). Confirmed issues carry full severity penalties; potential issues carry a 0.65x factor.
            </p>
          </div>
          <div className="p-6 rounded-xl border border-[#E8E8ED] dark:border-[#2B2B34]">
            <h2 className="font-display text-lg font-semibold">3. Configuring Multi-Model AI</h2>
            <p className="mt-2 text-sm text-[#555562] dark:text-[#9898A6] leading-relaxed">
              Navigate to <code className="font-mono text-xs">/app/settings/ai</code> to assign separate default models for AI Doctor Diagnosis, AI Fix Center, and Repository Assistant, and test live provider connectivity.
            </p>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export function PricingPage() {
  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Pricing &amp; Plan Matrix</h1>
        <p className="mt-3 text-base text-[#555562] dark:text-[#9898A6]">
          Transparent engineering limits with zero surprise token markups when bringing your own provider keys.
        </p>

        <div className="mt-10 overflow-x-auto border border-[#E8E8ED] dark:border-[#2B2B34] rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34]">
              <tr>
                <th className="py-3 px-4 font-semibold">Capability</th>
                <th className="py-3 px-4 font-semibold">Individual ($0)</th>
                <th className="py-3 px-4 font-semibold">Team Pro ($29/seat)</th>
                <th className="py-3 px-4 font-semibold">Enterprise (Custom)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
              {[
                ['Connected Repositories', 'Up to 5', 'Unlimited', 'Unlimited'],
                ['Deterministic Scanners', 'Full Suite', 'Full Suite', 'Full Suite + Custom Rules'],
                ['AI Model Providers', 'Gemini 4 & Gemma', 'Gemini, Gemma, DeepSeek', 'All + Private Gateways'],
                ['GitHub Pull Requests', 'Manual Diff Copy', 'Automated Branch & PR', 'Automated + Branch Policy'],
                ['PDF Reports & Audit Logs', 'Basic Summary', 'Full Export + 90d Logs', 'Unlimited + SIEM Export'],
              ].map((row) => (
                <tr key={row[0]}>
                  <td className="py-3 px-4 font-medium">{row[0]}</td>
                  <td className="py-3 px-4 text-[#555562] dark:text-[#9898A6]">{row[1]}</td>
                  <td className="py-3 px-4 text-[#555562] dark:text-[#9898A6]">{row[2]}</td>
                  <td className="py-3 px-4 text-[#555562] dark:text-[#9898A6]">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PublicLayout>
  );
}
