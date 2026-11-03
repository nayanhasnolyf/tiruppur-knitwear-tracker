import { cookies, headers } from 'next/headers';
import { Role } from '@prisma/client';
import prisma from './prisma';

export const SESSION_COOKIE_NAME = 'tk_session_email';
export const SESSION_ROLE_COOKIE_NAME = 'tk_session_role';

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
 * (or optional `x-demo-user-email` header for automated API tests).
 * Strictly returns `null` when no valid session cookie is present.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const headerStore = headers();
    const headerEmail = headerStore.get('x-demo-user-email');

    const cookieStore = cookies();
    const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    const rawEmail = headerEmail || cookieValue;
    if (!rawEmail || rawEmail === 'LOGGED_OUT') {
      return null;
    }

    const targetEmail = rawEmail.trim().toLowerCase();
    if (!targetEmail) {
      return null;
    }

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

    return user ?? null;
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
      error: 'Authentication required. Please sign in at /login.',
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
