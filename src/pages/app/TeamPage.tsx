import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { UserPlus } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';

interface Member {
  id: number;
  email: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
}

interface AuditLog {
  id: number;
  userUid: string;
  action: string;
  resourceType: string;
  resourceId: string;
  createdAt: string;
}

export function TeamPage() {
  const { apiFetch } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('engineer');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ members: Member[]; auditLogs: AuditLog[] }>('/api/team');
      setMembers(res.members);
      setLogs(res.auditLogs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team details.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/api/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      });
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed.');
    }
  };

  const handleRoleChange = async (id: number, nextRole: string) => {
    setError(null);
    try {
      await apiFetch(`/api/team/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role: nextRole } : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member role.');
    }
  };

  return (
    <AppShell title="Team Management">
      <div className="space-y-6">
        <form
          onSubmit={handleInvite}
          className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="invite-email" className="block text-xs font-semibold mb-1">Invite Teammate</label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="engineer@company.com"
              className="w-full px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-xs font-semibold mb-1">Role</label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-3 py-2 rounded-md border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-sm"
            >
              <option value="admin">Admin</option>
              <option value="engineer">Engineer</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          <button
            type="submit"
            className="glass-btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" />
            <span>Send Invite</span>
          </button>
          {error ? <div role="alert" className="w-full text-xs text-red-600">{error}</div> : null}
        </form>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] font-display text-sm font-semibold">
              Workspace Members ({members.length})
            </div>
            <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
              {loading ? (
                <div className="p-6 text-xs text-[#777783]">Loading workspace members...</div>
              ) : members.map((m) => (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{m.name}</div>
                    <div className="text-xs text-[#777783] truncate">{m.email} · {m.status}</div>
                  </div>
                  <select
                    aria-label={`Role for ${m.email}`}
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value)}
                    className="px-2.5 py-1 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-xs"
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="engineer">Engineer</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] font-display text-sm font-semibold">
              Audit Log
            </div>
            <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34] max-h-96 overflow-y-auto">
              {logs.length === 0 ? (
                <div className="p-6 text-xs text-[#777783]">No audit events recorded yet.</div>
              ) : (
                logs.map((l) => (
                  <div key={l.id} className="px-4 py-2.5 text-xs flex items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-semibold">{l.action}</span>
                      <span className="text-[#777783] ml-2">
                        {l.resourceType} #{l.resourceId}
                      </span>
                    </div>
                    <span className="font-mono text-[#777783] tabular-nums shrink-0">
                      {new Date(l.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
