"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Phone,
  FileText,
  UserRound,
  Repeat2,
  Banknote,
  GitBranch,
} from "lucide-react";
import type { DashboardData } from "@/lib/models";
import {
  adminAttention,
  attentionReasons,
  type AdminAttention,
} from "@/lib/admin-attention";

const AttentionContext = createContext<{
  counts: AdminAttention;
  publish: (data: DashboardData, now: string) => void;
} | null>(null);

export function AdminAttentionProvider({
  initialCounts,
  children,
}: {
  initialCounts: AdminAttention;
  children: React.ReactNode;
}) {
  const [counts, setCounts] = useState(initialCounts);
  const version = useRef(0);
  const publish = useCallback((data: DashboardData, now: string) => {
    version.current++;
    setCounts(adminAttention(data, now));
  }, []);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState !== "visible" || pending) return;
      pending = true;
      const startedAtVersion = version.current;
      try {
        const response = await fetch("/api/operations/", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data: DashboardData = await response.json();
        // A workspace save may have published newer data while this request ran.
        if (!disposed && startedAtVersion === version.current)
          publish(data, new Date().toISOString());
      } catch {
        // Retain the last confirmed counts when offline; retry on focus or the next tick.
      } finally {
        pending = false;
      }
    };
    const update = () => {
      void refresh();
    };
    const timer = window.setInterval(update, 60000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [publish]);
  const value = useMemo(() => ({ counts, publish }), [counts, publish]);
  return (
    <AttentionContext.Provider value={value}>
      {children}
    </AttentionContext.Provider>
  );
}

export function useAdminAttention() {
  return useContext(AttentionContext);
}

const links = [
  ["overview", "Overview", LayoutDashboard],
  ["pipeline", "Customer pipeline", GitBranch],
  ["customers", "Customers", Users],
  ["calendar", "Calendar", CalendarDays],
  ["recurring", "Recurring bookings", Repeat2],
  ["finances", "Finances", Banknote],
  ["cleaners", "Cleaners", UserRound],
  ["conversations", "Conversations", Phone],
  ["content", "Content", FileText],
] as const;

export function AdminNavigation() {
  const context = useAdminAttention();
  const pathname = usePathname();
  return links.map(([section, label, Icon]) => {
    const href = section === "overview" ? "/admin/" : `/admin/${section}/`;
    const count = context?.counts[section] ?? 0;
    const descriptionId = `attention-${section}`;
    const description = `${count} ${attentionReasons[section]}`;
    return (
      <Link
        key={section}
        href={href}
        aria-current={
          pathname.replace(/\/$/, "") === href.replace(/\/$/, "")
            ? "page"
            : undefined
        }
        aria-describedby={count ? descriptionId : undefined}
        title={count ? description : undefined}
      >
        <Icon size={17} aria-hidden="true" />
        {label}
        {count > 0 && (
          <>
            <span className="nav-attention" aria-hidden="true">
              {count > 99 ? "99+" : count}
            </span>
            <span id={descriptionId} hidden>
              {description}
            </span>
          </>
        )}
      </Link>
    );
  });
}
