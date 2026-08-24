/** Shown only when a password is configured; a local run has no session to end. */
export default function SignOut() {
  return (
    <form action="/api/auth/logout" method="post">
      <button type="submit" className="text-[11px] text-muted hover:text-ink hover:underline">
        Sign out
      </button>
    </form>
  );
}
