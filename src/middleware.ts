import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, authConfig, isHosted, verifySession } from '@/lib/auth';

/**
 * Gate everything behind a session once a password is configured.
 *
 * Two deliberate exceptions. The login screen and its endpoint, obviously. And a signed
 * one-off token on the print route, because the PDF export drives a headless browser that
 * fetches that page from the outside and carries no cookie of its own.
 */
export async function middleware(req: NextRequest) {
  const config = authConfig();

  if (!config) {
    // A deployment with no password would be a public read-write database. Refuse rather
    // than quietly serve it; running locally, no password is the documented default.
    if (isHosted()) {
      return new NextResponse(
        'This deployment has no PRD_PASSWORD set, so it would be open to anyone with the ' +
          'URL. Set PRD_PASSWORD in the project environment variables and redeploy.',
        { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }
    return NextResponse.next();
  }

  const { pathname, searchParams } = req.nextUrl;

  if (pathname === '/login' || pathname === '/api/auth/login') return NextResponse.next();

  // The export's headless browser authenticates with a short-lived signed token instead.
  if (pathname.endsWith('/print')) {
    const token = searchParams.get('t');
    if (token && (await verifySession(token, config.secret))) return NextResponse.next();
  }

  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value, config.secret)) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  const login = req.nextUrl.clone();
  login.pathname = '/login';
  login.search = '';
  // Send them back where they were headed once they are in.
  if (pathname !== '/') login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next's own static output and the favicon.
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico).*)'],
};
