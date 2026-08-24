/**
 * Working out where a request actually came from.
 *
 * `Request.url` inside a route handler is not reliably the URL the browser used — Next
 * normalises the host, and behind a proxy it is the internal address rather than the
 * public one. Two consequences, both of which have teeth:
 *
 * - A redirect built from it can send the browser to a different origin than the one the
 *   session cookie was just set on, so the user bounces straight back to the login screen.
 *   Relative redirects avoid the question entirely: the browser resolves them itself.
 * - The PDF export has to hand a real, reachable URL to a headless browser, so there it
 *   has to be the public origin, taken from the proxy's forwarded headers.
 */

/** A redirect the browser resolves against its own origin, so the host cannot drift. */
export function redirectTo(path: string, status: 303 | 307 = 303): Response {
  // Only ever within this app: an absolute URL here would be an open redirect.
  const safe = path.startsWith('/') && !path.startsWith('//') ? path : '/';
  return new Response(null, { status, headers: { Location: safe } });
}

/** The origin a client outside this process should use to reach us. */
export function publicOrigin(req: Request): string {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) {
    const proto =
      req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}
