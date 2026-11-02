'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  UserCheck,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    name: 'Karthik Rajan',
    email: 'merchandiser@tiruppurknit.com',
    role: 'MERCHANDISER',
    unit: 'All Units (Head Office)',
    lang: 'English',
    targetPath: '/',
    description:
      'Full Order Board, TNA schedule setup, compliance date-change audit, and Tamil AI blocker confirmation.',
  },
  {
    name: 'Murugan K',
    email: 'supervisor1@tiruppurknit.com',
    role: 'SUPERVISOR',
    unit: 'Unit 1 (Stitching & Printing)',
    lang: 'தமிழ் / English',
    targetPath: '/supervisor',
    description:
      'Mobile floor entry for B-PO-88213 & C-PO-0488 with Tamil voice/text blocker notes and offline sync queue.',
  },
  {
    name: 'Senthil V',
    email: 'supervisor2@tiruppurknit.com',
    role: 'SUPERVISOR',
    unit: 'Unit 2 (Finishing & Packing)',
    lang: 'தமிழ் / English',
    targetPath: '/supervisor',
    description:
      'Mobile floor entry for B-PO-88240 (White Polo) with Tamil quality rework reporting and photo logging.',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('merchandiser@tiruppurknit.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (
    targetEmail: string,
    targetPassword: string,
    redirectTo = '/',
    quickSwitch = false
  ) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: targetEmail,
          password: targetPassword,
          quickSwitch,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
        return;
      }

      window.dispatchEvent(new Event('tk-auth-changed'));
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Network error while signing in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = DEMO_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase()
    );
    handleSignIn(
      email,
      password,
      matched ? matched.targetPath : '/',
      false
    );
  };

  return (
    <div className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 font-mono text-xs font-medium text-slate-600">
          Role-Based Access Control · Company A (Tiruppur)
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
          Sign in to TiruppurKnit Ops
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Use the form below with password{' '}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-800">
            demo123
          </code>{' '}
          or click any Instant Demo Role Card to switch accounts immediately.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Standard Sign-In Form */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Credentials Sign-In
            </h2>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={onFormSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Work Email
                </label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="merchandiser@tiruppurknit.com"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Password
                </label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="demo123"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 font-mono text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  Demo password for all accounts: <strong>demo123</strong>
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: 1-Click Instant Demo Sign-In Cards */}
        <div className="space-y-4 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              1-Click Instant Demo Sign-In
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Select a role below to test role-specific views and permissions:
            </p>

            <div className="mt-4 space-y-3">
              {DEMO_ACCOUNTS.map((acct) => (
                <div
                  key={acct.email}
                  className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300 hover:bg-white sm:flex-row sm:items-center"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">
                        {acct.name}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                          acct.role === 'MERCHANDISER'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {acct.role === 'MERCHANDISER' ? (
                          <ShieldCheck className="h-3 w-3" />
                        ) : (
                          <UserCheck className="h-3 w-3" />
                        )}
                        {acct.role}
                      </span>
                      <span className="rounded bg-slate-200/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-700">
                        {acct.unit}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-500">
                      {acct.email}
                    </p>
                    <p className="text-xs text-slate-600">{acct.description}</p>
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleSignIn(acct.email, 'demo123', acct.targetPath, true)
                    }
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    Enter as {acct.name.split(' ')[0]}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Buyer Read-Only Links Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Isolated Read-Only Buyer Portals (Token-Based, No Login Required)
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Each buyer link is strictly scoped to that buyer&apos;s orders and
              shows only merchandiser-confirmed warnings.
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <Link
                href="/buyer/uk-company-b-readonly-2026"
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 hover:border-slate-300 hover:bg-slate-100"
              >
                <div>
                  <div className="font-semibold">Company B (UK)</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    2 Orders: B-PO-88213, B-PO-88240
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
              </Link>

              <Link
                href="/buyer/de-company-c-readonly-2026"
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-medium text-slate-800 hover:border-slate-300 hover:bg-slate-100"
              >
                <div>
                  <div className="font-semibold">Company C (Germany)</div>
                  <div className="font-mono text-[10px] text-slate-500">
                    1 Order: C-PO-0488
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

