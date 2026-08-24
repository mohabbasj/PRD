import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { redirectTo } from '@/lib/http';

export async function POST() {
  const response = redirectTo('/login');
  const cookie = sessionCookieOptions();
  const parts = [`${SESSION_COOKIE}=`, `Path=${cookie.path}`, 'Max-Age=0', 'SameSite=Lax', 'HttpOnly'];
  if (cookie.secure) parts.push('Secure');
  response.headers.set('Set-Cookie', parts.join('; '));
  return response;
}
