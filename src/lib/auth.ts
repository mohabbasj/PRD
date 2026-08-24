/**
 * Session handling for the hosted deployment.
 *
 * Running locally with no PRD_PASSWORD set, this is inert and the app behaves exactly as
 * the brief described: no login, single user, nothing in the way. Set a password and every
 * route requires a session — which is what putting a CRUD app on the public internet
 * demands, since anyone with the URL could otherwise read, edit and delete every PRD.
 *
 * The session is an expiry stamp signed with HMAC-SHA256. There is nothing to look up, so
 * it works in the Edge middleware and in Node route handlers alike, and a stolen cookie
 * stops working on its own. Web Crypto only — no Node built-ins — so middleware can use it.
 */

export const SESSION_COOKIE = 'prd_session';
const SESSION_DAYS = 7;

export interface AuthConfig {
  username: string;
  password: string;
  secret: string;
}

/** Returns null when no password is configured, meaning the app runs unprotected. */
export function authConfig(): AuthConfig | null {
  const password = process.env.PRD_PASSWORD;
  if (!password) return null;
  return {
    username: process.env.PRD_USERNAME || 'admin',
    password,
    // Falling back to the password keeps a one-variable setup working; setting
    // PRD_SESSION_SECRET separately means changing the password does not have to
    // invalidate every existing session, and vice versa.
    secret: process.env.PRD_SESSION_SECRET || password,
  };
}

/** True when this looks like a deployment rather than someone's laptop. */
export function isHosted(): boolean {
  return !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
}

const encoder = new TextEncoder();

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(payload: string, secret: string): Promise<string> {
  return toBase64Url(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload)));
}

/** Comparison that does not leak how much of the value matched. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSession(secret: string, ttlSeconds?: number): Promise<string> {
  const expires = Math.floor(Date.now() / 1000) + (ttlSeconds ?? SESSION_DAYS * 86_400);
  const payload = String(expires);
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf('.');
  if (separator < 1) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(payload)) return false;
  if (Number(payload) < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, await sign(payload, secret));
}

export function checkCredentials(
  config: AuthConfig,
  username: string,
  password: string
): boolean {
  // Both compared in constant time so neither reveals itself through response timing.
  const userOk = safeEqual(username, config.username);
  const passOk = safeEqual(password, config.password);
  return userOk && passOk;
}

export function sessionCookieOptions(maxAgeSeconds = SESSION_DAYS * 86_400) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isHosted(),
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
