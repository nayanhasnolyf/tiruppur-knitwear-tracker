'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, RefreshCw } from 'lucide-react';

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
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user ?? null);
      }
    } catch {
      // Ignore network errors during initial load
    }
  };

  useEffect(() => {
    fetchSession();
  }, [pathname]);

  const handleQuickSwitch = async (
    email: string,
    targetPath: string,
    label: string
  ) => {
    try {
      setSwitchingTo(label);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, quickSwitch: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        window.dispatchEvent(new Event('tk-auth-changed'));
        if (pathname === targetPath) {
          router.refresh();
        } else {
          router.push(targetPath);
        }
      }
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.dispatchEvent(new Event('tk-auth-changed'));
    router.push('/login');
  };

  const isMerchandiserView =
    pathname === '/' || pathname.startsWith('/orders/');
  const isSupervisorView = pathname.startsWith('/supervisor');
  const isBuyerUK = pathname.includes('uk-company-b-readonly-2026');
  const isBuyerDE = pathname.includes('de-company-c-readonly-2026');

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-zinc-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Minimal Monochrome Brand + Primary Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-950 transition hover:opacity-80"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-950 font-mono text-xs font-bold text-white">
              T
            </span>
            <span className="text-sm font-semibold tracking-tight">
              TiruppurKnit
            </span>
            <span className="hidden font-mono text-[11px] text-zinc-400 sm:inline">
              / Export TNA
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                isMerchandiserView
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-500 hover:text-zinc-950'
              }`}
            >
              Orders
            </Link>
            <Link
              href="/supervisor"
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                isSupervisorView
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-500 hover:text-zinc-950'
              }`}
            >
              Floor Entry
            </Link>
          </nav>
        </div>

        {/* Right: Compact Segmented Role/Portal Switcher + Active User */}
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-zinc-200 bg-zinc-100/80 p-0.5 text-xs">
            <button
              type="button"
              disabled={switchingTo !== null}
              onClick={() =>
                handleQuickSwitch(
                  'merchandiser@tiruppurknit.com',
                  '/',
                  'merchandiser'
                )
              }
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                isMerchandiserView && user?.role === 'MERCHANDISER'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {switchingTo === 'merchandiser' && (
                <RefreshCw className="h-3 w-3 animate-spin" />
              )}
              Merchandiser
            </button>

            <button
              type="button"
              disabled={switchingTo !== null}
              onClick={() =>
                handleQuickSwitch(
                  'supervisor1@tiruppurknit.com',
                  '/supervisor',
                  'supervisor'
                )
              }
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
                isSupervisorView
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {switchingTo === 'supervisor' && (
                <RefreshCw className="h-3 w-3 animate-spin" />
              )}
              Supervisor
            </button>

            <Link
              href="/buyer/uk-company-b-readonly-2026"
              className={`rounded-md px-2.5 py-1 font-medium transition ${
                isBuyerUK
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Buyer: UK
            </Link>

            <Link
              href="/buyer/de-company-c-readonly-2026"
              className={`hidden rounded-md px-2.5 py-1 font-medium transition sm:inline-block ${
                isBuyerDE
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-950'
              }`}
            >
              Buyer: DE
            </Link>
          </div>

          <div className="hidden h-4 w-px bg-zinc-200 lg:block" />

          {user ? (
            <div className="hidden items-center gap-2 lg:flex">
              <Link
                href="/login"
                className="font-mono text-xs text-zinc-600 hover:text-zinc-950"
              >
                {user.name}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-950"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-zinc-950 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
