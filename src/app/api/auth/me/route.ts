import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [user, demoUsers, buyers] = await Promise.all([
      getSessionUser(),
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          assignedUnit: true,
          preferredLang: true,
        },
        orderBy: { role: 'asc' },
      }),
      prisma.buyer.findMany({
        select: {
          id: true,
          name: true,
          country: true,
          accessToken: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      user,
      demoAccounts: demoUsers,
      buyerPortals: buyers,
    });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current user session.' },
      { status: 500 }
    );
  }
}

