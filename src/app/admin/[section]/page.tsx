import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { dashboard } from "@/lib/repository";
import { AdminWorkspace } from "@/components/admin-workspace";
import { londonToday } from "@/lib/recurring-bookings";
export default async function AdminSection({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{
    lead?: string | string[];
    customer?: string | string[];
    visit?: string | string[];
    due?: string | string[];
  }>;
}) {
  const actor = await requireActor("admin");
  const { section } = await params;
  if (
    ![
      "customers",
      "pipeline",
      "calendar",
      "recurring",
      "finances",
      "cleaners",
      "content",
      "conversations",
    ].includes(section)
  )
    notFound();
  const query = await searchParams;
  return (
    <AdminWorkspace
      key={`${section}:${typeof query.visit === "string" ? query.visit : ""}`}
      initialData={await dashboard(actor)}
      section={section}
      demo={actor.demo}
      initialNow={new Date().toISOString()}
      initialToday={londonToday()}
      initialLeadId={typeof query.lead === "string" ? query.lead : undefined}
      initialCustomerId={
        typeof query.customer === "string" ? query.customer : undefined
      }
      initialDueOnly={query.due === "1"}
      initialVisitId={typeof query.visit === "string" ? query.visit : undefined}
    />
  );
}
