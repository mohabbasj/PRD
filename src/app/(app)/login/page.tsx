import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, authConfig, verifySession } from '@/lib/auth';
import { cookies } from 'next/headers';

export const metadata: Metadata = { title: 'Sign in — PRD Editor' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const config = authConfig();
  if (!config) redirect('/');

  const { next, error } = await searchParams;
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (await verifySession(session, config.secret)) redirect(next && next.startsWith('/') ? next : '/');

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-8">
      <h1 className="border-b-[3px] border-ink pb-3 text-[22pt] font-bold leading-tight">
        PRD Editor
      </h1>
      <p className="mt-3 text-hint text-hint">Sign in to read and edit the documents.</p>

      <form action="/api/auth/login" method="post" className="mt-6">
        {next && <input type="hidden" name="next" value={next} />}

        <label className="block text-[11px] text-muted" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          className="mt-1 w-full rounded border border-rule px-3 py-2 text-[12px] focus:border-ink"
        />

        <label className="mt-4 block text-[11px] text-muted" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded border border-rule px-3 py-2 text-[12px] focus:border-ink"
        />

        {error && (
          <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700">
            That username and password did not match.
          </p>
        )}

        <button
          type="submit"
          className="mt-5 w-full rounded bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-black"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
