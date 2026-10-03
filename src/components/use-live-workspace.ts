"use client";
import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
export function useLiveWorkspace(
  enabled: boolean,
  onChange: () => Promise<void>,
  cleanerOnly = false,
) {
  useEffect(() => {
    if (
      !enabled ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
      return;
    const client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void onChange().catch(() => {
          /* Manual refresh remains available if connectivity drops. */
        });
      }, 300);
    };
    const channel = client.channel("workspace");
    if (cleanerOnly) {
      // Avoid DELETE payloads: Supabase does not evaluate row policies for old deleted rows.
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "visits" },
          changed,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "visits" },
          changed,
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "cleaners" },
          changed,
        );
    } else
      channel.on("postgres_changes", { event: "*", schema: "public" }, changed);
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [enabled, onChange, cleanerOnly]);
}
