import "@/app/operations.css";
import { requireActor } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
import { dashboard } from "@/lib/repository";
import { adminAttention } from "@/lib/admin-attention";
import { AdminAttentionProvider } from "@/components/admin-navigation";
import { AdminConfirmationProvider } from "@/components/admin-confirmation";
export const metadata = {
  title: "Admin | Cleaning Maidstone",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireActor("admin");
  const counts = adminAttention(
    await dashboard(actor),
    new Date().toISOString(),
  );
  return (
    <AdminAttentionProvider initialCounts={counts}>
      <AdminConfirmationProvider>
        <OpsShell actor={actor}>{children}</OpsShell>
      </AdminConfirmationProvider>
    </AdminAttentionProvider>
  );
}
