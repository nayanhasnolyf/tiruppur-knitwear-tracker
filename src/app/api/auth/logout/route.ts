import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({
    user: null,
    message: 'Signed out successfully.',
  });

  response.cookies.set(SESSION_COOKIE_NAME, 'LOGGED_OUT', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
