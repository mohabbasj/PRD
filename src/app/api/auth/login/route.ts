import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  authConfig,
  checkCredentials,
  createSession,
  sessionCookieOptions,
} from '@/lib/auth';
import { redirectTo } from '@/lib/http';

export async function POST(req: Request) {
  const config = authConfig();
  if (!config) return NextResponse.json({ error: 'Login is not enabled.' }, { status: 400 });

  const form = await req.formData();
  const username = String(form.get('username') ?? '');
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/');
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!checkCredentials(config, username, password)) {
    // A short pause blunts brute-forcing without needing a rate-limit store.
    await new Promise((resolve) => setTimeout(resolve, 600));
    const back = new URLSearchParams({ error: '1' });
    if (safeNext !== '/') back.set('next', safeNext);
    return redirectTo(`/login?${back}`);
  }

  // Relative, so the cookie set here and the page landed on share an origin.
  const response = redirectTo(safeNext);
  const cookie = sessionCookieOptions();
  const parts = [
    `${SESSION_COOKIE}=${await createSession(config.secret)}`,
    `Path=${cookie.path}`,
    `Max-Age=${cookie.maxAge}`,
    `SameSite=Lax`,
    'HttpOnly',
  ];
  if (cookie.secure) parts.push('Secure');
  response.headers.set('Set-Cookie', parts.join('; '));
  return response;
}
