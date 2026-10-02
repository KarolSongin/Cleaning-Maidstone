import { requireActor } from "@/lib/auth";
import { cleanerData } from "@/lib/repository";
import { CleanerPortal } from "@/components/cleaner-portal";
export default async function Cleaner() {
  const actor = await requireActor("cleaner");
  return (
    <CleanerPortal initialData={await cleanerData(actor)} demo={actor.demo} />
  );
}
