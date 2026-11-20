import { CheckCircle2, Code2, FolderGit2, Package, ShieldCheck, Stethoscope } from 'lucide-react';

const CAPABILITIES = [
  { label: 'Repository analysis', icon: FolderGit2 },
  { label: 'Security intelligence', icon: ShieldCheck },
  { label: 'AI-powered diagnosis', icon: Stethoscope },
  { label: 'Code quality', icon: Code2 },
  { label: 'Dependency analysis', icon: Package },
  { label: 'Verified fixes', icon: CheckCircle2 },
];

export function CapabilityStrip() {
  return (
    <section
      aria-label="Core platform capabilities"
      className="border-y border-[#E8E8ED] bg-[#F8F8FA]"
    >
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-y-3 gap-x-6">
          {CAPABILITIES.map(({ label, icon: Icon }) => (
            <li key={label} className="flex items-center gap-2 text-xs sm:text-[13px] font-medium text-[#17171C]">
              <Icon className="h-4 w-4 text-[#7656D6] shrink-0" aria-hidden="true" />
              <span className="truncate">{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
