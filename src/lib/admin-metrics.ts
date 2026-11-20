export const PRIMARY_ADMIN_EMAIL = 'olasunkanmiobasola118@gmail.com';

export const MAX_UID_LENGTH = 128;
export const MAX_EMAIL_LENGTH = 200;
export const MAX_DISPLAY_NAME_LENGTH = 120;
export const UID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;
export const DATE_KEY_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

export interface UserMetricRecord {
  uid: string;
  email: string;
  displayName: string;
  provider: 'google' | 'email';
  lastActiveDate: string;
  registeredAtMs: number;
  lastActiveAtMs: number;
}

export interface DailyMetricPoint {
  dateKey: string;
  label: string;
  activeCount: number;
  newRegistrations: number;
}

export interface AdminMetricsSummary {
  totalRegistrations: number;
  dailyActiveToday: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  activeLast15Min: number;
  newRegistrationsToday: number;
  newRegistrations7d: number;
  providerBreakdown: {
    google: number;
    email: number;
  };
  dailyTrend: DailyMetricPoint[];
}

export function getUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getLastNDaysKeys(days: number, referenceDate: Date = new Date()): string[] {
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)));
  const keys: string[] = [];
  const baseUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate()
  );
  for (let offset = safeDays - 1; offset >= 0; offset -= 1) {
    const d = new Date(baseUtc - offset * 86_400_000);
    keys.push(getUtcDateKey(d));
  }
  return keys;
}

export function sanitizeDisplayName(name: string | null | undefined, email?: string | null): string {
  const fallback = email ? email.split('@')[0] || 'Engineer' : 'Engineer';
  const cleaned = (name || fallback).trim().replace(/\s+/g, ' ');
  return (cleaned || 'Engineer').slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function sanitizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH);
}

export function isValidFirestoreId(id: string): boolean {
  return UID_PATTERN.test(id) && id.length <= MAX_UID_LENGTH;
}

export function isPrimaryAdminEmail(email: string | null | undefined): boolean {
  return sanitizeEmail(email) === PRIMARY_ADMIN_EMAIL;
}

export function summarizeUserMetrics(
  users: UserMetricRecord[],
  dailyCountsByDate: Record<string, number>,
  referenceDate: Date = new Date()
): AdminMetricsSummary {
  const todayKey = getUtcDateKey(referenceDate);
  const last7Keys = getLastNDaysKeys(7, referenceDate);
  const last30Keys = getLastNDaysKeys(30, referenceDate);
  const last7Set = new Set(last7Keys);
  const last30Set = new Set(last30Keys);
  const fifteenMinAgoMs = referenceDate.getTime() - 15 * 60_000;

  let activeLast15Min = 0;
  let weeklyActiveUsers = 0;
  let monthlyActiveUsers = 0;
  let newRegistrationsToday = 0;
  let newRegistrations7d = 0;
  let google = 0;
  let email = 0;

  const newRegsByDay: Record<string, number> = {};
  for (const key of last7Keys) {
    newRegsByDay[key] = 0;
  }

  const activeFromMetricsToday = new Set<string>();

  for (const u of users) {
    if (u.provider === 'google') google += 1;
    else email += 1;

    if (u.lastActiveAtMs >= fifteenMinAgoMs) {
      activeLast15Min += 1;
    }
    if (u.lastActiveDate === todayKey) {
      activeFromMetricsToday.add(u.uid);
    }
    if (last7Set.has(u.lastActiveDate)) {
      weeklyActiveUsers += 1;
    }
    if (last30Set.has(u.lastActiveDate)) {
      monthlyActiveUsers += 1;
    }

    if (u.registeredAtMs > 0) {
      const regKey = getUtcDateKey(new Date(u.registeredAtMs));
      if (regKey === todayKey) newRegistrationsToday += 1;
      if (last7Set.has(regKey)) {
        newRegistrations7d += 1;
        newRegsByDay[regKey] = (newRegsByDay[regKey] || 0) + 1;
      }
    }
  }

  const hasTodayBucket = Object.prototype.hasOwnProperty.call(dailyCountsByDate, todayKey);
  const dailyActiveToday = hasTodayBucket
    ? Math.max(dailyCountsByDate[todayKey] || 0, activeFromMetricsToday.size)
    : activeFromMetricsToday.size;

  const dailyTrend: DailyMetricPoint[] = last7Keys.map((dateKey) => {
    const [, month, day] = dateKey.split('-');
    const bucketCount = dailyCountsByDate[dateKey] || 0;
    return {
      dateKey,
      label: `${month}/${day}`,
      activeCount:
        dateKey === todayKey ? Math.max(bucketCount, activeFromMetricsToday.size) : bucketCount,
      newRegistrations: newRegsByDay[dateKey] || 0,
    };
  });

  return {
    totalRegistrations: users.length,
    dailyActiveToday,
    weeklyActiveUsers,
    monthlyActiveUsers,
    activeLast15Min,
    newRegistrationsToday,
    newRegistrations7d,
    providerBreakdown: { google, email },
    dailyTrend,
  };
}
