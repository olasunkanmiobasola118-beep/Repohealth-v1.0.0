import type { User as FirebaseUser } from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  getUtcDateKey,
  isValidFirestoreId,
  sanitizeDisplayName,
  sanitizeEmail,
} from './admin-metrics';
import { db, handleFirestoreError, OperationType } from './firebase';

const HEARTBEAT_TTL_MS = 5 * 60_000;
const lastSyncByUid = new Map<string, { dateKey: string; syncedAt: number }>();

export async function recordUserActivityHeartbeat(
  user: FirebaseUser,
  force = false
): Promise<boolean> {
  if (!user || !user.emailVerified || !user.email) {
    return false;
  }
  if (!isValidFirestoreId(user.uid)) {
    return false;
  }

  const todayKey = getUtcDateKey();
  const prev = lastSyncByUid.get(user.uid);
  const now = Date.now();
  if (!force && prev && prev.dateKey === todayKey && now - prev.syncedAt < HEARTBEAT_TTL_MS) {
    return true;
  }

  const cleanEmail = sanitizeEmail(user.email);
  const cleanName = sanitizeDisplayName(user.displayName, cleanEmail);
  const hasGoogle = user.providerData.some((p) => p.providerId === 'google.com');
  const provider: 'google' | 'email' = hasGoogle ? 'google' : 'email';

  const userMetricPath = `userMetrics/${user.uid}`;
  const userMetricRef = doc(db, 'userMetrics', user.uid);

  try {
    const existingSnap = await getDoc(userMetricRef);
    if (!existingSnap.exists()) {
      await setDoc(userMetricRef, {
        uid: user.uid,
        email: cleanEmail,
        displayName: cleanName,
        provider,
        lastActiveDate: todayKey,
        registeredAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userMetricRef, {
        displayName: cleanName,
        lastActiveDate: todayKey,
        lastActiveAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userMetricPath);
  }

  const dailyPath = `dailyActivity/${todayKey}/users/${user.uid}`;
  const dailyRef = doc(db, 'dailyActivity', todayKey, 'users', user.uid);

  try {
    const dailySnap = await getDoc(dailyRef);
    if (!dailySnap.exists()) {
      await setDoc(dailyRef, {
        uid: user.uid,
        dateKey: todayKey,
        lastSeenAt: serverTimestamp(),
      });
    } else {
      await updateDoc(dailyRef, {
        lastSeenAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, dailyPath);
  }

  lastSyncByUid.set(user.uid, { dateKey: todayKey, syncedAt: now });
  return true;
}
