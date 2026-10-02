import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { dashboard } from "@/lib/repository";
import { AdminWorkspace } from "@/components/admin-workspace";
export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const actor = await requireActor("admin");
  const { section } = await params;
  if (
    !["customers", "calendar", "cleaners", "content", "conversations"].includes(
      section,
    )
  )
    notFound();
  return (
    <AdminWorkspace
      initialData={await dashboard(actor)}
      section={section}
      demo={actor.demo}
    />
  );
}
