import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { dashboard } from "@/lib/repository";
import { AdminWorkspace } from "@/components/admin-workspace";
import { londonToday } from "@/lib/recurring-bookings";
export default async function AdminSection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const actor = await requireActor("admin");
  const { section } = await params;
  if (
    ![
      "customers",
      "calendar",
      "recurring",
      "cleaners",
      "content",
      "conversations",
    ].includes(section)
  )
    notFound();
  return (
    <AdminWorkspace
      initialData={await dashboard(actor)}
      section={section}
      demo={actor.demo}
      initialToday={londonToday()}
    />
  );
}
