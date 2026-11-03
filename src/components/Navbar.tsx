'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'MERCHANDISER' | 'SUPERVISOR';
  assignedUnit: string | null;
  preferredLang: string;
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const isBuyerRoute = pathname.startsWith('/buyer/');
  const isLoginRoute = pathname === '/login';

  useEffect(() => {
    if (isBuyerRoute || isLoginRoute) {
      return;
    }

    let cancelled = false;
    const fetchSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setUser(data.user ?? null);
        }
      } catch {
        // Ignore network errors during initial load
      }
    };

    fetchSession();
    const onAuthChanged = () => fetchSession();
    window.addEventListener('tk-auth-changed', onAuthChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('tk-auth-changed', onAuthChanged);
    };
  }, [pathname, isBuyerRoute, isLoginRoute]);

  // Do NOT render the internal employee Navbar on external Buyer Portal links or on /login
  if (isBuyerRoute || isLoginRoute) {
    return null;
  }

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      window.dispatchEvent(new Event('tk-auth-changed'));
      router.push('/login');
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const isMerchandiser = user?.role === 'MERCHANDISER';
  const isSupervisor = user?.role === 'SUPERVISOR';

  const roleBadgeLabel = user
    ? user.role === 'SUPERVISOR'
      ? `${user.name} · ${user.assignedUnit ? `${user.assignedUnit} ` : ''}Supervisor`
      : `${user.name} · Merchandiser`
    : '';

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-zinc-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Role-Isolated Brand + Allowed Navigation */}
        <div className="flex items-center gap-6">
          <Link
            href={isSupervisor ? '/supervisor' : '/'}
            className="flex items-center gap-2 text-zinc-950 transition hover:opacity-80"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-950 font-mono text-xs font-bold text-white">
              T
            </span>
            <span className="text-sm font-semibold tracking-tight">
              TiruppurKnit
            </span>
            <span className="font-mono text-[11px] text-zinc-400">
              {isSupervisor ? '/ Floor' : '/ Export TNA'}
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {isMerchandiser && (
              <Link
                href="/"
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  pathname === '/' || pathname.startsWith('/orders/')
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'text-zinc-500 hover:text-zinc-950'
                }`}
              >
                Orders
              </Link>
            )}

            {isSupervisor && (
              <span className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-950">
                Floor Entry
              </span>
            )}
          </nav>
        </div>

        {/* Right: Logged-in Identity Badge + Sign Out Button */}
        <div className="flex items-center gap-3">
          {user && (
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 font-mono text-xs text-zinc-700">
              {roleBadgeLabel}
            </span>
          )}

          <button
            type="button"
            disabled={signingOut}
            onClick={handleLogout}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 transition hover:border-zinc-950 hover:bg-zinc-950 hover:text-white disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
