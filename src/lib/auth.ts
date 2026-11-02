import { cookies, headers } from 'next/headers';
import { Role } from '@prisma/client';
import prisma from './prisma';

export const SESSION_COOKIE_NAME = 'tk_session_email';
export const DEFAULT_DEMO_EMAIL = 'merchandiser@tiruppurknit.com';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  assignedUnit: string | null;
  preferredLang: string;
}

/**
 * Retrieves the currently authenticated user from the HTTP-only session cookie
 * (or optional `x-demo-user-email` header). Defaults to the seeded Merchandiser
 * account on first visit unless explicitly logged out (`LOGGED_OUT`).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const headerStore = headers();
    const headerEmail = headerStore.get('x-demo-user-email');

    const cookieStore = cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (cookieValue === 'LOGGED_OUT' && !headerEmail) {
      return null;
    }

    const targetEmail = (headerEmail || cookieValue || DEFAULT_DEMO_EMAIL)
      .trim()
      .toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedUnit: true,
        preferredLang: true,
      },
    });

    if (user) {
      return user;
    }

    // Fallback to first merchandiser if cookie email is stale
    const fallbackUser = await prisma.user.findFirst({
      where: { role: Role.MERCHANDISER },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        assignedUnit: true,
        preferredLang: true,
      },
    });

    return fallbackUser;
  } catch {
    return null;
  }
}

/**
 * Helper to enforce role-based access control in API route handlers.
 */
export async function requireRole(allowedRoles: Role[]): Promise<
  | { authorized: true; user: SessionUser }
  | { authorized: false; status: number; error: string }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      authorized: false,
      status: 401,
      error: 'Authentication required. Please sign in.',
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      authorized: false,
      status: 403,
      error: `Forbidden: Role ${user.role} does not have permission for this action. Required: ${allowedRoles.join(' or ')}.`,
    };
  }

  return { authorized: true, user };
}

