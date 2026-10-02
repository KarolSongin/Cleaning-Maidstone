import "@/app/operations.css";
import { requireActor } from "@/lib/auth";
import { OpsShell } from "@/components/ops-shell";
export const metadata = {
  title: "My rota | Cleaning Maidstone",
  robots: { index: false, follow: false },
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireActor("cleaner");
  return <OpsShell actor={actor}>{children}</OpsShell>;
}
