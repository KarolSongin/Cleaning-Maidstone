import "@/app/operations.css";
import Link from "next/link";
import { demoEnabled } from "@/lib/local-db";
export const metadata = {
  title: "Staff sign in | Cleaning Maidstone",
  robots: { index: false, follow: false },
};
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="login-page" id="main">
      <div className="login-card">
        <Link href="/" className="eyebrow">
          Cleaning Maidstone
        </Link>
        <h1>
          A place for
          <br />
          the people who care.
        </h1>
        <p>Invite-only access for admins and cleaners.</p>
        {error && (
          <p className="alert alert-error" role="alert">
            {error === "configuration"
              ? "Live accounts are not connected yet."
              : "We couldn’t sign you in. Check your details and try again."}
          </p>
        )}
        <form className="ops-form" method="post" action="/api/auth/login/">
          <label>
            Email
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="current-password"
            />
          </label>
          <button className="button button-primary">Sign in</button>
        </form>
        {demoEnabled() && (
          <div className="login-demo">
            <p>
              <strong>Local demo</strong>
              <br />
              Synthetic accounts, stored only on this machine.
            </p>
            <form method="post" action="/api/auth/demo/">
              <input type="hidden" name="role" value="admin" />
              <button className="button button-outline button-sm">
                Admin demo
              </button>
            </form>
            <form method="post" action="/api/auth/demo/">
              <input type="hidden" name="role" value="cleaner" />
              <button className="button button-outline button-sm">
                Cleaner demo
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
