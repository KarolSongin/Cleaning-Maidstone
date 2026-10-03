import type { Visit } from "./models";

export type ProfileKind = "customer" | "cleaner";
export function profileBlockingVisits(
  visits: Visit[],
  kind: ProfileKind,
  id: string,
  now: number,
) {
  return visits
    .filter(
      (visit) =>
        visit[`${kind}_id`] === id &&
        (visit.status === "started" ||
          (visit.status === "scheduled" && Date.parse(visit.ends_at) > now)),
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
