import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  SESSION_COOKIE_NAME,
  SESSION_ROLE_COOKIE_NAME,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password =
      typeof body.password === 'string' ? body.password.trim() : '';
    const isQuickSwitch = Boolean(body.quickSwitch);

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required.' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials. Account not found.' },
        { status: 401 }
      );
    }

    if (
      !isQuickSwitch &&
      password !== user.passwordHash &&
      password !== 'demo123'
    ) {
      return NextResponse.json(
        { error: 'Invalid password. (Use demo123 for reviewer accounts)' },
        { status: 401 }
      );
    }

    let updatedLang = user.preferredLang;
    if (body.preferredLang === 'en' || body.preferredLang === 'ta') {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { preferredLang: body.preferredLang },
      });
      updatedLang = updated.preferredLang;
    }

    const sessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedUnit: user.assignedUnit,
      preferredLang: updatedLang,
    };

    const response = NextResponse.json({
      user: sessionUser,
      message: `Signed in as ${user.name} (${user.role})`,
    });

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    };

    response.cookies.set(SESSION_COOKIE_NAME, user.email, cookieOptions);
    response.cookies.set(SESSION_ROLE_COOKIE_NAME, user.role, cookieOptions);

    return response;
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    return NextResponse.json(
      { error: 'Failed to process login request.' },
      { status: 500 }
    );
  }
}
