import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  aiModelPreferences,
  aiProviders,
  users,
  workspaceMembers,
  workspaces,
} from '../db/schema.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './session-tokens.ts';

export interface AuthContext {
  uid: string;
  email: string;
  name: string;
  userId: number;
  workspaceId: number;
  workspaceName: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  authCtx?: AuthContext;
}

async function seedDefaultAiSetup(workspaceId: number) {
  const existingPrefs = await db
    .select()
    .from(aiModelPreferences)
    .where(eq(aiModelPreferences.workspaceId, workspaceId));

  if (existingPrefs.length === 0) {
    await db.insert(aiModelPreferences).values({
      workspaceId,
      diagnosisProvider: 'gemini',
      diagnosisModel: 'gemini-3.1-flash-lite',
      fixProvider: 'gemini',
      fixModel: 'gemini-3.1-flash-lite',
      assistantProvider: 'gemini',
      assistantModel: 'gemini-3.1-flash-lite',
      sendPrivateCodeConsent: true,
    });
  }

  const existingProviders = await db
    .select()
    .from(aiProviders)
    .where(eq(aiProviders.workspaceId, workspaceId));

  if (existingProviders.length === 0) {
    await db.insert(aiProviders).values([
      {
        workspaceId,
        providerKey: 'gemini',
        displayName: 'Google Gemini (Platform)',
        baseUrl: 'https://generativelanguage.googleapis.com',
        defaultModel: 'gemini-3.1-flash-lite',
        isEnabled: true,
        lastTestStatus: process.env.GEMINI_API_KEY ? 'ok' : 'untested',
        lastTestMessage: process.env.GEMINI_API_KEY
          ? 'Platform GEMINI_API_KEY active'
          : 'Awaiting GEMINI_API_KEY secret',
      },
      {
        workspaceId,
        providerKey: 'gemma',
        displayName: 'Google Gemma Open Models',
        baseUrl: '',
        defaultModel: 'gemma-3-27b-it',
        isEnabled: false,
        lastTestStatus: 'untested',
        lastTestMessage: 'Configure a vLLM, Ollama, or OpenRouter endpoint for Gemma',
      },
      {
        workspaceId,
        providerKey: 'deepseek',
        displayName: 'DeepSeek Coder / Reasoner',
        baseUrl: 'https://api.deepseek.com/v1',
        defaultModel: 'deepseek-chat',
        isEnabled: Boolean(process.env.DEEPSEEK_API_KEY),
        lastTestStatus: process.env.DEEPSEEK_API_KEY ? 'untested' : 'untested',
        lastTestMessage: 'Configure your DeepSeek API key server-side',
      },
      {
        workspaceId,
        providerKey: 'openai_compatible',
        displayName: 'Custom OpenAI-Compatible',
        baseUrl: '',
        defaultModel: 'custom-model',
        isEnabled: false,
        lastTestStatus: 'untested',
        lastTestMessage: 'Optional self-hosted vLLM / LiteLLM / OpenRouter gateway',
      },
    ]);
  }
}

export async function getOrCreateUserAndWorkspace(params: {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}): Promise<AuthContext> {
  const [user] = await db
    .insert(users)
    .values({
      uid: params.uid,
      email: params.email,
      name: params.name,
      avatarUrl: params.avatarUrl || null,
      role: 'owner',
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: params.email,
        name: params.name,
        avatarUrl: params.avatarUrl || null,
        updatedAt: new Date(),
      },
    })
    .returning();

  const slug = `ws-${params.uid.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18)}`;
  let [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));

  if (!ws) {
    const [created] = await db
      .insert(workspaces)
      .values({
        name: `${params.name}'s Engineering Workspace`,
        slug,
        ownerId: user.id,
        plan: 'pro',
      })
      .onConflictDoNothing()
      .returning();

    ws = created || (await db.select().from(workspaces).where(eq(workspaces.slug, slug)))[0];

    await db.insert(workspaceMembers).values({
      workspaceId: ws.id,
      userId: user.id,
      email: params.email,
      name: params.name,
      role: 'owner',
      status: 'active',
    });

    await seedDefaultAiSetup(ws.id);
  } else {
    await seedDefaultAiSetup(ws.id);
  }

  return {
    uid: user.uid,
    email: user.email,
    name: user.name,
    userId: user.id,
    workspaceId: ws.id,
    workspaceName: ws.name,
    role: 'owner',
  };
}

export async function registerLocalAccount(params: {
  name: string;
  email: string;
  password: string;
}): Promise<{ token: string; authCtx: AuthContext }> {
  const cleanName = params.name.trim();
  const cleanEmail = normalizeEmail(params.email);
  const password = params.password;

  if (!cleanName || cleanName.length > 80) {
    throw new AuthRequestError(400, 'Please enter your full name (1–80 characters).');
  }
  if (!isValidEmail(cleanEmail)) {
    throw new AuthRequestError(400, 'Please enter a valid work email address.');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new AuthRequestError(400, 'Password must be between 8 and 128 characters.');
  }

  const localUid = `local:${cleanEmail}`;
  const [byUid] = await db.select().from(users).where(eq(users.uid, localUid));
  if (byUid) {
    throw new AuthRequestError(409, 'An account with this email already exists. Please sign in instead.');
  }

  const [byEmail] = await db.select().from(users).where(eq(users.email, cleanEmail));
  if (byEmail) {
    throw new AuthRequestError(
      409,
      'An account with this email already exists via Google Sign-In. Please sign in with Google.'
    );
  }

  const passwordHash = hashPassword(password);
  await db.insert(users).values({
    uid: localUid,
    email: cleanEmail,
    name: cleanName,
    passwordHash,
    role: 'owner',
  });

  const authCtx = await getOrCreateUserAndWorkspace({
    uid: localUid,
    email: cleanEmail,
    name: cleanName,
  });

  const token = signSessionToken({
    uid: authCtx.uid,
    email: authCtx.email,
    name: authCtx.name,
  });

  return { token, authCtx };
}

export async function authenticateLocalAccount(params: {
  email: string;
  password: string;
}): Promise<{ token: string; authCtx: AuthContext }> {
  const cleanEmail = normalizeEmail(params.email);
  const password = params.password;

  if (!isValidEmail(cleanEmail) || typeof password !== 'string' || password.length === 0) {
    throw new AuthRequestError(400, 'Enter both your email and password.');
  }

  const localUid = `local:${cleanEmail}`;
  let [user] = await db.select().from(users).where(eq(users.uid, localUid));
  if (!user) {
    const [byEmail] = await db.select().from(users).where(eq(users.email, cleanEmail));
    if (byEmail && byEmail.passwordHash) {
      user = byEmail;
    }
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AuthRequestError(401, 'Invalid email or password.');
  }

  const authCtx = await getOrCreateUserAndWorkspace({
    uid: user.uid,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  });

  const token = signSessionToken({
    uid: authCtx.uid,
    email: authCtx.email,
    name: authCtx.name,
  });

  return { token, authCtx };
}

export class AuthRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();

    if (token.startsWith('rh_sess.')) {
      const payload = verifySessionToken(token);
      if (!payload) {
        return res.status(401).json({ error: 'Unauthorized: Session expired or invalid. Please sign in again.' });
      }
      try {
        const [existingUser] = await db.select().from(users).where(eq(users.uid, payload.uid));
        if (!existingUser) {
          return res.status(401).json({ error: 'Unauthorized: Account no longer exists.' });
        }
        req.authCtx = await getOrCreateUserAndWorkspace({
          uid: existingUser.uid,
          email: existingUser.email,
          name: existingUser.name,
          avatarUrl: existingUser.avatarUrl,
        });
        return next();
      } catch (error) {
        console.error('Session token resolution error:', error);
        return res.status(500).json({ error: 'Failed to verify session.' });
      }
    }

    try {
      const decoded = await adminAuth.verifyIdToken(token);
      req.authCtx = await getOrCreateUserAndWorkspace({
        uid: decoded.uid,
        email: (decoded.email || 'user@repohealth.dev').toLowerCase(),
        name: decoded.name || decoded.email?.split('@')[0] || 'Engineer',
        avatarUrl: decoded.picture || null,
      });
      return next();
    } catch (error) {
      console.error('Firebase token verification error:', error);
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
    }
  }

  return res.status(401).json({ error: 'Unauthorized: Sign in to access this workspace.' });
};
