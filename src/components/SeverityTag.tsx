import { AlertCircle, AlertTriangle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';

export function SeverityLabel({ severity }: { severity: string }) {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Critical
      </span>
    );
  }
  if (normalized === 'high') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        High
      </span>
    );
  }
  if (normalized === 'medium') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Medium
      </span>
    );
  }
  if (normalized === 'low') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 dark:text-sky-400">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Low
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#777783] dark:text-[#9898A6]">
      <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Info
    </span>
  );
}

export function StatusLabel({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: 'Open', cls: 'text-amber-700 dark:text-amber-400' },
    diagnosed: { label: 'Diagnosed', cls: 'text-[#7656D6] dark:text-[#A58DF5]' },
    patch_proposed: { label: 'Patch Proposed', cls: 'text-sky-700 dark:text-sky-400' },
    approved: { label: 'Approved', cls: 'text-emerald-700 dark:text-emerald-400' },
    verified_resolved: { label: 'Verified Resolved', cls: 'text-emerald-700 dark:text-emerald-400' },
    verified: { label: 'Verified', cls: 'text-emerald-700 dark:text-emerald-400' },
    verification_failed: { label: 'Verification Failed', cls: 'text-red-600 dark:text-red-400' },
    applied: { label: 'PR Opened', cls: 'text-[#7656D6] dark:text-[#A58DF5]' },
    rejected: { label: 'Rejected', cls: 'text-[#777783] dark:text-[#9898A6]' },
    dismissed: { label: 'Dismissed', cls: 'text-[#777783] dark:text-[#9898A6]' },
    healthy: { label: 'Healthy', cls: 'text-emerald-700 dark:text-emerald-400' },
    needs_attention: { label: 'Needs Attention', cls: 'text-amber-700 dark:text-amber-400' },
    critical: { label: 'Critical', cls: 'text-red-600 dark:text-red-400' },
    unscanned: { label: 'Unscanned', cls: 'text-[#777783] dark:text-[#9898A6]' },
  };
  const info = map[status] || { label: status, cls: 'text-[#777783]' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${info.cls}`}>
      {status === 'verified_resolved' || status === 'verified' || status === 'healthy' ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : null}
      {info.label}
    </span>
  );
}
