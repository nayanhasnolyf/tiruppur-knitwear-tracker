'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Factory,
  Smartphone,
  ExternalLink,
  LogIn,
  LogOut,
  ShieldCheck,
  UserCheck,
  RefreshCw,
} from 'lucide-react';

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
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      {/* Top Main Bar */}
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-slate-900 hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
              <Factory className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold tracking-tight text-slate-900">
                  TiruppurKnit Ops
                </span>
                <span className="hidden rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-slate-600 sm:inline-block">
                  Export TNA &amp; Floor AI
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Company A · Tiruppur Knitwear Production &amp; Delay Projection
              </p>
            </div>
          </Link>
        </div>

        {/* Primary Nav Links + Current User Badge */}
        <div className="flex items-center gap-2.5">
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              href="/"
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                isMerchandiserView
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Order Board
            </Link>
            <Link
              href="/supervisor"
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                isSupervisorView
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              Supervisor Mobile
            </Link>
          </nav>

          <div className="h-4 w-px bg-slate-200 hidden md:block" />

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs">
                {user.role === 'MERCHANDISER' ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                )}
                <span className="font-medium text-slate-800">{user.name}</span>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                    user.role === 'MERCHANDISER'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {user.role}
                  {user.assignedUnit ? ` · ${user.assignedUnit}` : ''}
                </span>
              </div>
              <Link
                href="/login"
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              >
                Switch User
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 hover:text-rose-600"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Reviewer 1-Click Role & Portal Switcher Bar */}
      <div className="border-t border-slate-100 bg-slate-50/90 px-4 py-1.5 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-slate-400 mr-1">
              1-Click Demo Switcher:
            </span>

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
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                isMerchandiserView && user?.role === 'MERCHANDISER'
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {switchingTo === 'merchandiser' ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <ShieldCheck className="h-3 w-3" />
              )}
              1. Merchandiser Board
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
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                isSupervisorView
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {switchingTo === 'supervisor' ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Smartphone className="h-3 w-3" />
              )}
              2. Supervisor Floor Mobile (Tamil/EN)
            </button>

            <Link
              href="/buyer/uk-company-b-readonly-2026"
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                isBuyerUK
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ExternalLink className="h-3 w-3" />
              3. Buyer Portal: Company B (UK)
            </Link>

            <Link
              href="/buyer/de-company-c-readonly-2026"
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                isBuyerDE
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ExternalLink className="h-3 w-3" />
              4. Buyer Portal: Company C (DE)
            </Link>
          </div>

          <div className="hidden items-center gap-1.5 font-mono text-[11px] text-slate-500 lg:flex">
            <span>Demo Anchor Date:</span>
            <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-semibold text-slate-800">
              02 Nov 2026
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

