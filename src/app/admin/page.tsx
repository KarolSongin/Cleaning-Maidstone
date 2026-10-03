import { requireActor } from "@/lib/auth";
import { dashboard } from "@/lib/repository";
import { AdminWorkspace } from "@/components/admin-workspace";
import { londonToday } from "@/lib/recurring-bookings";
export default async function Admin() {
  const actor = await requireActor("admin");
  return (
    <AdminWorkspace
      initialData={await dashboard(actor)}
      section="overview"
      demo={actor.demo}
      initialToday={londonToday()}
    />
  );
}
