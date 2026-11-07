'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    name: 'Karthik Rajan',
    email: 'merchandiser@tiruppurknit.com',
    role: 'MERCHANDISER',
    unit: 'All Units',
    targetPath: '/',
    description: 'Order Board, TNA setup, compliance audit & AI review.',
  },
  {
    name: 'Murugan K',
    email: 'supervisor1@tiruppurknit.com',
    role: 'SUPERVISOR',
    unit: 'Unit 1',
    targetPath: '/supervisor',
    description: 'Mobile floor entry · தமிழ் / EN · Stitching & Printing.',
  },
  {
    name: 'Senthil V',
    email: 'supervisor2@tiruppurknit.com',
    role: 'SUPERVISOR',
    unit: 'Unit 2',
    targetPath: '/supervisor',
    description: 'Mobile floor entry · தமிழ் / EN · Finishing & Packing.',
  },
];

const DEMO_BUYER_TOKENS = [
  'uk-company-b-readonly-2026',
  'de-company-c-readonly-2026',
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('merchandiser@tiruppurknit.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyerToken, setBuyerToken] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);

  const handleOpenBuyerPortal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = buyerToken.trim();
    if (!cleaned) {
      setTokenError('Please enter a buyer access token.');
      return;
    }
    setTokenError(null);
    router.push(`/buyer/${encodeURIComponent(cleaned)}`);
  };

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
      setError('Network error while signing in.');
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
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-zinc-950 font-mono text-xs font-bold text-white">
            T
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-950">
            TiruppurKnit
          </span>
          <span className="font-mono text-[11px] text-zinc-400">
            / Export TNA &amp; Floor Tracker
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Sign in to TiruppurKnit
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Use password{' '}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-900">
            demo123
          </code>{' '}
          or select a demo account below.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-12">
        {/* Left: Credentials Form */}
        <div className="md:col-span-5">
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              Credentials
            </h2>

            {error && (
              <div className="mt-4 rounded-md border border-[#FECDD3] bg-[#FFF1F2] p-3 text-xs text-[#BE123C]">
                {error}
              </div>
            )}

            <form onSubmit={onFormSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-950 focus:border-zinc-950 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right: 1-Click Role Switcher & Buyer Links */}
        <div className="space-y-6 md:col-span-7">
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 bg-zinc-100/60 px-5 py-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Instant Demo Accounts
              </h2>
            </div>

            <div className="divide-y divide-zinc-200">
              {DEMO_ACCOUNTS.map((acct) => (
                <div
                  key={acct.email}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-950">
                        {acct.name}
                      </span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-zinc-600">
                        {acct.role} · {acct.unit}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {acct.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      handleSignIn(acct.email, 'demo123', acct.targetPath, true)
                    }
                    className="shrink-0 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-zinc-950 hover:text-white"
                  >
                    Switch
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <div className="border-b border-zinc-200 bg-zinc-100/60 px-5 py-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                External Buyer Portal · Token Access
              </h3>
            </div>
            <div className="p-5">
              <form
                onSubmit={handleOpenBuyerPortal}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={buyerToken}
                  onChange={(e) => {
                    setBuyerToken(e.target.value);
                    if (tokenError) setTokenError(null);
                  }}
                  placeholder="Enter buyer access token..."
                  className="h-9 flex-1 rounded-md border border-zinc-200 bg-white px-3 font-mono text-xs text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-zinc-950 px-3.5 text-xs font-medium text-white transition hover:bg-zinc-800"
                >
                  Open Portal
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>

              {tokenError && (
                <div className="mt-2 font-mono text-[11px] text-[#BE123C]">
                  {tokenError}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-zinc-400">Demo tokens:</span>
                {DEMO_BUYER_TOKENS.map((tok) => (
                  <button
                    key={tok}
                    type="button"
                    onClick={() => {
                      setBuyerToken(tok);
                      setTokenError(null);
                      router.push(`/buyer/${tok}`);
                    }}
                    className="rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-700 transition hover:border-zinc-950 hover:bg-white hover:text-zinc-950"
                  >
                    {tok}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
