import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Phone,
  FileText,
  UserRound,
  ArrowUpRight,
} from "lucide-react";
import type { Actor } from "@/lib/models";
const links = [
  ["", "Overview", LayoutDashboard],
  ["customers", "Customers", Users],
  ["calendar", "Calendar", CalendarDays],
  ["cleaners", "Cleaners", UserRound],
  ["conversations", "Conversations", Phone],
  ["content", "Content", FileText],
] as const;
export function OpsShell({
  actor,
  children,
}: {
  actor: Actor;
  children: React.ReactNode;
}) {
  return (
    <div className="ops-layout">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="ops-sidebar">
        <Link className="ops-logo" href="/">
          Cleaning
          <br />
          Maidstone
          <span>
            {actor.role === "admin"
              ? "BUSINESS WORKSPACE"
              : "YOUR CLEANER PORTAL"}
          </span>
        </Link>
        <nav aria-label="Workspace navigation">
          {actor.role === "admin" ? (
            links.map(([path, label, Icon]) => (
              <Link key={path} href={"/admin/" + (path ? path + "/" : "")}>
                <Icon size={17} />
                {label}
              </Link>
            ))
          ) : (
            <Link href="/cleaner/">
              <CalendarDays size={17} />
              My rota
            </Link>
          )}
          <Link href="/">
            <ArrowUpRight size={17} />
            Public website
          </Link>
        </nav>
        <form method="post" action="/api/auth/logout/">
          <button className="button button-ghost button-sm">Sign out</button>
        </form>
      </aside>
      <div className="ops-main">
        <header className="ops-topbar">
          <p>Hello, {actor.name}</p>
          <span>
            Europe/London · {actor.role === "admin" ? "Admin" : "Cleaner"}
          </span>
        </header>
        {actor.demo && (
          <div className="demo-banner">
            LOCAL DEMO · Synthetic data only. No live customers, calls or
            bookings.
          </div>
        )}
        <main id="main">{children}</main>
      </div>
    </div>
  );
}
