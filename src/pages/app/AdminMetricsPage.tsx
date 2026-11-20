import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore';
import {
  Activity,
  Download,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import {
  getLastNDaysKeys,
  isValidFirestoreId,
  PRIMARY_ADMIN_EMAIL,
  sanitizeEmail,
  summarizeUserMetrics,
  type UserMetricRecord,
} from '../../lib/admin-metrics';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { recordUserActivityHeartbeat } from '../../lib/user-metrics-sync';

interface AdminDoc {
  uid: string;
  email: string;
  grantedBy: string;
  grantedAtMs: number;
}

function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof (ts as Timestamp).toMillis === 'function') {
    return (ts as Timestamp).toMillis();
  }
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

export function AdminMetricsPage() {
  const { firebaseUser, isAdmin, signInWithGoogle, session } = useAuth();
  const [users, setUsers] = useState<UserMetricRecord[]>([]);
  const [dailyCounts, setDailyCounts] = useState<Record<string, number>>({});
  const [admins, setAdmins] = useState<AdminDoc[]>([]);
  const [loadingStream, setLoadingStream] = useState(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [adminActionMsg, setAdminActionMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const last7Keys = useMemo(() => getLastNDaysKeys(7), []);

  useEffect(() => {
    if (!isAdmin || !firebaseUser || !firebaseUser.emailVerified) {
      setLoadingStream(false);
      return;
    }

    setLoadingStream(true);
    setStreamError(null);

    void recordUserActivityHeartbeat(firebaseUser, true).catch((err) => {
      setStreamError(err instanceof Error ? err.message : 'Unable to sync activity heartbeat.');
    });

    const unsubscribers: Array<() => void> = [];

    const userMetricsQuery = query(collection(db, 'userMetrics'), orderBy('lastActiveAt', 'desc'));
    unsubscribers.push(
      onSnapshot(
        userMetricsQuery,
        (snapshot) => {
          const rows: UserMetricRecord[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              uid: String(data.uid || d.id),
              email: String(data.email || ''),
              displayName: String(data.displayName || 'Engineer'),
              provider: data.provider === 'email' ? 'email' : 'google',
              lastActiveDate: String(data.lastActiveDate || ''),
              registeredAtMs: toMillis(data.registeredAt),
              lastActiveAtMs: toMillis(data.lastActiveAt),
            };
          });
          setUsers(rows);
          setLoadingStream(false);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, 'userMetrics');
          } catch (wrapped) {
            setStreamError(wrapped instanceof Error ? wrapped.message : 'Permission denied reading userMetrics.');
            setLoadingStream(false);
          }
        }
      )
    );

    for (const dateKey of last7Keys) {
      const dauPath = `dailyActivity/${dateKey}/users`;
      unsubscribers.push(
        onSnapshot(
          collection(db, 'dailyActivity', dateKey, 'users'),
          (snapshot) => {
            setDailyCounts((prev) => ({
              ...prev,
              [dateKey]: snapshot.size,
            }));
          },
          (error) => {
            try {
              handleFirestoreError(error, OperationType.LIST, dauPath);
            } catch (wrapped) {
              setStreamError(wrapped instanceof Error ? wrapped.message : `Unable to read ${dauPath}`);
            }
          }
        )
      );
    }

    unsubscribers.push(
      onSnapshot(
        collection(db, 'admins'),
        (snapshot) => {
          const list: AdminDoc[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              uid: String(data.uid || d.id),
              email: String(data.email || ''),
              grantedBy: String(data.grantedBy || ''),
              grantedAtMs: toMillis(data.grantedAt),
            };
          });
          setAdmins(list);
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, 'admins');
          } catch (wrapped) {
            setStreamError(wrapped instanceof Error ? wrapped.message : 'Unable to read admins.');
          }
        }
      )
    );

    return () => {
      for (const unsub of unsubscribers) unsub();
    };
  }, [firebaseUser, isAdmin, last7Keys]);

  const summary = useMemo(
    () => summarizeUserMetrics(users, dailyCounts),
    [users, dailyCounts]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
    );
  }, [users, search]);

  const maxTrendCount = Math.max(
    1,
    ...summary.dailyTrend.map((pt) => pt.activeCount)
  );

  const handleSyncNow = async () => {
    if (!firebaseUser) return;
    setSyncing(true);
    setAdminActionMsg(null);
    try {
      await recordUserActivityHeartbeat(firebaseUser, true);
      setAdminActionMsg({ type: 'success', text: 'Synced your live Firestore heartbeat.' });
    } catch (err) {
      setAdminActionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to sync heartbeat.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleAddAdmin = async (e: FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const cleanUid = newAdminUid.trim();
    const cleanEmail = sanitizeEmail(newAdminEmail);
    if (!isValidFirestoreId(cleanUid)) {
      setAdminActionMsg({
        type: 'error',
        text: 'Enter a valid Firebase UID (1–128 alphanumeric, underscore, or hyphen characters).',
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setAdminActionMsg({ type: 'error', text: 'Enter a valid email address.' });
      return;
    }

    setAdminActionMsg(null);
    const path = `admins/${cleanUid}`;
    try {
      await setDoc(doc(db, 'admins', cleanUid), {
        uid: cleanUid,
        email: cleanEmail,
        grantedBy: firebaseUser.uid,
        grantedAt: serverTimestamp(),
      });
      setNewAdminUid('');
      setNewAdminEmail('');
      setAdminActionMsg({ type: 'success', text: `Granted Firestore admin access to ${cleanEmail}.` });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.WRITE, path);
      } catch (wrapped) {
        setAdminActionMsg({
          type: 'error',
          text: wrapped instanceof Error ? wrapped.message : 'Failed to grant admin access.',
        });
      }
    }
  };

  const handleRemoveAdmin = async (adminUid: string) => {
    if (!firebaseUser || adminUid === firebaseUser.uid) return;
    setAdminActionMsg(null);
    const path = `admins/${adminUid}`;
    try {
      await deleteDoc(doc(db, 'admins', adminUid));
      setAdminActionMsg({ type: 'success', text: `Removed admin ${adminUid}.` });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, path);
      } catch (wrapped) {
        setAdminActionMsg({
          type: 'error',
          text: wrapped instanceof Error ? wrapped.message : 'Failed to revoke admin access.',
        });
      }
    }
  };

  const handleExportCsv = () => {
    const header = 'uid,email,displayName,provider,lastActiveDate,registeredAt,lastActiveAt';
    const rows = filteredUsers.map((u) =>
      [
        u.uid,
        u.email,
        `"${u.displayName.replace(/"/g, '""')}"`,
        u.provider,
        u.lastActiveDate,
        u.registeredAtMs ? new Date(u.registeredAtMs).toISOString() : '',
        u.lastActiveAtMs ? new Date(u.lastActiveAtMs).toISOString() : '',
      ].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repohealth-user-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <AppShell title="Admin Metrics">
        <div className="max-w-xl mx-auto mt-10 p-8 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 space-y-3 text-center">
          <ShieldAlert className="h-8 w-8 mx-auto text-red-600 dark:text-red-400" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold text-red-700 dark:text-red-300">
            Admin Access Required
          </h2>
          <p className="text-sm text-[#555562] dark:text-[#9898A6]">
            Real-time registration and daily active user telemetry in Firestore is restricted to verified workspace administrators.
          </p>
          <p className="text-xs font-mono text-[#777783]">
            Signed in as: {session?.user.email || 'Unknown user'}
          </p>
        </div>
      </AppShell>
    );
  }

  if (!firebaseUser || !firebaseUser.emailVerified) {
    return (
      <AppShell title="Admin Metrics">
        <div className="max-w-xl mx-auto mt-10 p-8 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F] space-y-4 text-center">
          <Shield className="h-8 w-8 mx-auto text-[#7656D6]" aria-hidden="true" />
          <h2 className="font-display text-lg font-bold">
            Verify Admin Session with Google
          </h2>
          <p className="text-sm text-[#555562] dark:text-[#9898A6]">
            Firestore security rules require a verified Firebase Authentication token to stream live collections (<code className="font-mono text-xs">userMetrics</code> &amp; <code className="font-mono text-xs">dailyActivity</code>).
          </p>
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="glass-btn-primary inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
          >
            Continue with Google
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin Metrics">
      <div className="space-y-8">
        {/* Live Stream Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-[#555562] dark:text-[#9898A6]">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Live Firestore listeners connected to <code className="font-mono">userMetrics</code> &amp; <code className="font-mono">dailyActivity</code></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={syncing}
              onClick={handleSyncNow}
              className="glass-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span>{syncing ? 'Syncing...' : 'Sync Heartbeat'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="glass-btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {streamError ? (
          <div role="alert" className="p-3.5 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 font-mono break-all">
            {streamError}
          </div>
        ) : null}

        {adminActionMsg ? (
          <div
            role={adminActionMsg.type === 'error' ? 'alert' : 'status'}
            className={`p-3.5 rounded-md border text-xs ${
              adminActionMsg.type === 'error'
                ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {adminActionMsg.text}
          </div>
        ) : null}

        {/* Primary KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
            <div className="text-xs font-medium text-[#777783] dark:text-[#9898A6]">Total Registrations</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">
              {loadingStream ? '—' : summary.totalRegistrations}
            </div>
            <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6] tabular-nums">
              +{summary.newRegistrationsToday} today · +{summary.newRegistrations7d} in 7d
            </div>
          </div>

          <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
            <div className="text-xs font-medium text-[#777783] dark:text-[#9898A6]">Daily Active Users (Today)</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums text-[#7656D6]">
              {loadingStream ? '—' : summary.dailyActiveToday}
            </div>
            <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6] tabular-nums">
              {summary.activeLast15Min} active in last 15 min
            </div>
          </div>

          <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
            <div className="text-xs font-medium text-[#777783] dark:text-[#9898A6]">Weekly Active Users (7d)</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums">
              {loadingStream ? '—' : summary.weeklyActiveUsers}
            </div>
            <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6] tabular-nums">
              {summary.monthlyActiveUsers} monthly active (30d)
            </div>
          </div>

          <div className="p-5 rounded-lg border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
            <div className="text-xs font-medium text-[#777783] dark:text-[#9898A6]">Auth Breakdown</div>
            <div className="mt-2 font-display text-3xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {loadingStream ? '—' : summary.providerBreakdown.google}
            </div>
            <div className="mt-1 text-xs text-[#777783] dark:text-[#9898A6] tabular-nums">
              Google · {summary.providerBreakdown.email} Email
            </div>
          </div>
        </div>

        {/* 7-Day Daily Active Users Chart + Admin Allowlist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
                  <h2 className="font-display text-sm font-semibold">Daily Active Users (7-Day UTC Trend)</h2>
                </div>
                <p className="mt-1 text-xs text-[#777783] dark:text-[#9898A6]">
                  Streamed live from <code className="font-mono">/dailyActivity/&#123;YYYY-MM-DD&#125;/users</code>
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-7 gap-3 items-end h-40 pt-4 border-b border-[#E8E8ED] dark:border-[#2B2B34]">
              {summary.dailyTrend.map((pt) => {
                const heightPx = pt.activeCount === 0
                  ? 4
                  : Math.max(16, Math.round((pt.activeCount / maxTrendCount) * 112));
                return (
                  <div key={pt.dateKey} className="h-full flex flex-col items-center justify-end gap-1.5">
                    <span className="font-mono text-[11px] tabular-nums text-[#555562] dark:text-[#9898A6]">
                      {pt.activeCount}
                    </span>
                    <div
                      className={`w-full max-w-[36px] rounded-t transition-all ${
                        pt.activeCount > 0 ? 'bg-[#7656D6]' : 'bg-[#E8E8ED] dark:bg-[#2B2B34]'
                      }`}
                      style={{ height: `${heightPx}px` }}
                      title={`${pt.dateKey}: ${pt.activeCount} DAU, ${pt.newRegistrations} new`}
                    />
                    <span className="font-mono text-[10px] text-[#777783] pb-1.5">{pt.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Firestore Admin Allowlist */}
          <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
              <h2 className="font-display text-sm font-semibold">Firestore Admins</h2>
            </div>

            <div className="text-xs p-2.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-[#F8F8FA] dark:bg-[#19191F]">
              <div className="font-semibold truncate">{PRIMARY_ADMIN_EMAIL}</div>
              <div className="text-[#777783] mt-0.5">Primary owner (rule-enforced)</div>
            </div>

            <div className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34] max-h-36 overflow-y-auto">
              {admins.map((adm) => (
                <div key={adm.uid} className="py-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{adm.email}</div>
                    <div className="font-mono text-[11px] text-[#777783] truncate">{adm.uid}</div>
                  </div>
                  {adm.uid !== firebaseUser.uid ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveAdmin(adm.uid)}
                      aria-label={`Revoke admin access for ${adm.email}`}
                      className="p-1 rounded text-[#777783] hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-2 pt-2 border-t border-[#E8E8ED] dark:border-[#2B2B34]">
              <label htmlFor="admin-uid-input" className="block text-[11px] font-semibold text-[#777783]">
                Grant Additional Admin
              </label>
              <input
                id="admin-uid-input"
                type="text"
                value={newAdminUid}
                onChange={(e) => setNewAdminUid(e.target.value)}
                placeholder="Firebase Auth UID"
                className="w-full px-2.5 py-1.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-xs font-mono"
              />
              <input
                id="admin-email-input"
                type="email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="admin@company.com"
                className="w-full px-2.5 py-1.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-xs"
              />
              <button
                type="submit"
                className="glass-btn-primary w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Add Admin</span>
              </button>
            </form>
          </div>
        </div>

        {/* Registered Users Directory Table */}
        <div className="border border-[#E8E8ED] dark:border-[#2B2B34] rounded-lg overflow-hidden">
          <div className="px-5 py-3.5 bg-[#F8F8FA] dark:bg-[#19191F] border-b border-[#E8E8ED] dark:border-[#2B2B34] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#7656D6]" aria-hidden="true" />
              <h2 className="font-display text-sm font-semibold">
                Firestore Registered &amp; Active Users ({filteredUsers.length})
              </h2>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777783]" aria-hidden="true" />
              <label htmlFor="admin-user-search" className="sr-only">Filter users</label>
              <input
                id="admin-user-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by email, name, UID..."
                className="w-full pl-8 pr-3 py-1.5 rounded border border-[#E8E8ED] dark:border-[#2B2B34] bg-white dark:bg-[#101014] text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#E8E8ED] dark:border-[#2B2B34] text-[#777783] dark:text-[#9898A6]">
                <tr>
                  <th className="py-2.5 px-5 font-semibold">User</th>
                  <th className="py-2.5 px-4 font-semibold">UID</th>
                  <th className="py-2.5 px-4 font-semibold">Provider</th>
                  <th className="py-2.5 px-4 font-semibold">Registered</th>
                  <th className="py-2.5 px-4 font-semibold">Last Active</th>
                  <th className="py-2.5 px-5 font-semibold">Active Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8ED] dark:divide-[#2B2B34]">
                {loadingStream ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-5 text-center text-[#777783]">
                      Connecting to live Firestore stream...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-5 text-center text-[#777783]">
                      No matching Firestore user records found yet.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-[#F8F8FA]/60 dark:hover:bg-[#19191F]/60">
                      <td className="py-3 px-5">
                        <div className="font-semibold text-[#17171C] dark:text-[#F4F4F6]">{u.displayName}</div>
                        <div className="text-[#777783]">{u.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-[#777783]">{u.uid}</td>
                      <td className="py-3 px-4 capitalize">{u.provider}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[#555562] dark:text-[#9898A6]">
                        {u.registeredAtMs ? new Date(u.registeredAtMs).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums text-[#555562] dark:text-[#9898A6]">
                        {u.lastActiveAtMs ? new Date(u.lastActiveAtMs).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 px-5 font-mono tabular-nums">{u.lastActiveDate || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
