import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'tk_session_email';
const SESSION_ROLE_COOKIE_NAME = 'tk_session_role';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Always allow public/external routes:
  //    - /login (staff sign-in & reviewer persona launcher)
  //    - /buyer/* (external read-only token-authenticated buyer portal)
  //    - /api/* (API endpoints perform their own database/token auth checks)
  //    - Next.js internals & static assets
  if (
    pathname === '/login' ||
    pathname.startsWith('/buyer/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const emailCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value?.trim();
  const roleCookie = req.cookies.get(SESSION_ROLE_COOKIE_NAME)?.value?.trim();

  // 2. Unauthenticated user visiting protected internal routes (/, /orders/*, /supervisor)
  //    -> Immediately redirect to /login
  if (!emailCookie || emailCookie === 'LOGGED_OUT') {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Fallback role inference from seeded email if role cookie was not yet set
  const effectiveRole =
    roleCookie ||
    (emailCookie.startsWith('supervisor') ? 'SUPERVISOR' : 'MERCHANDISER');

  // 3. Strict Role-Based Route Isolation:
  //    - SUPERVISOR is strictly isolated to /supervisor
  if (
    effectiveRole === 'SUPERVISOR' &&
    (pathname === '/' || pathname.startsWith('/orders'))
  ) {
    const supervisorUrl = req.nextUrl.clone();
    supervisorUrl.pathname = '/supervisor';
    return NextResponse.redirect(supervisorUrl);
  }

  //    - MERCHANDISER is strictly isolated to / and /orders/*
  if (effectiveRole === 'MERCHANDISER' && pathname.startsWith('/supervisor')) {
    const boardUrl = req.nextUrl.clone();
    boardUrl.pathname = '/';
    return NextResponse.redirect(boardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

