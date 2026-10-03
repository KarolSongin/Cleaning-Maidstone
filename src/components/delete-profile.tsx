"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import type { DashboardData, Visit } from "@/lib/models";
import { ActionCancelled } from "@/lib/admin-confirmation";
import {
  profileBlockingVisits,
  type ProfileKind,
} from "@/lib/profile-deletion";
import { londonDate } from "@/lib/scheduling";
import { useConfirmedOperation } from "./operation-form";
import { PersonName } from "./person-name";
import { Button } from "./ui/button";

export function DeleteProfile({
  kind,
  profile,
  data,
  onSaved,
}: {
  kind: ProfileKind;
  profile: { id: string; name: string };
  data: DashboardData;
  onSaved: () => Promise<void>;
}) {
  const save = useConfirmedOperation();
  const trigger = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState("");
  const [reviewData, setReviewData] = useState<DashboardData | null>(null);
  const [blocking, setBlocking] = useState<Visit[]>([]);
  return (
    <div className="profile-deletion">
      <Button
        ref={trigger}
        size="sm"
        variant="outline"
        className="delete-series"
        disabled={busy}
        onClick={async () => {
          setError("");
          setBusy(true);
          try {
            const response = await fetch("/api/operations/", {
              cache: "no-store",
            });
            if (!response.ok)
              throw new Error(
                "Could not check assigned visits. Refresh and try again.",
              );
            const latest: DashboardData = await response.json();
            setReviewData(latest);
            const current = latest[
              kind === "customer" ? "customers" : "cleaners"
            ].find((item) => item.id === profile.id && !item.deleted_at);
            if (!current)
              throw new Error(
                "This profile has already been deleted. Refresh the list.",
              );
            const pending = profileBlockingVisits(
              latest.visits,
              kind,
              profile.id,
              Date.now(),
            );
            setBlocking(pending);
            if (pending.length) {
              setReviewing(true);
              return;
            }
            await save(
              `delete_${kind}`,
              { id: profile.id },
              {
                title: `Delete this ${kind}?`,
                confirmLabel: `Delete ${kind}`,
                danger: true,
                [kind === "customer" ? "customerName" : "cleanerName"]:
                  current.name,
                description:
                  kind === "customer"
                    ? "Remove this customer from active profiles and booking choices, close their pipeline record and stop follow-up reminders. Keep all visits, financial records, contact details and conversation history for reporting."
                    : "Remove this cleaner from active profiles and booking choices, disable their portal access and decline their pending requests. Keep all visits, financial records, working hours and request history for reporting.",
              },
            );
            await onSaved();
          } catch (reason) {
            if (reason instanceof ActionCancelled) {
              // The fresh-data read disables the opener before the modal mounts.
              requestAnimationFrame(() => trigger.current?.focus());
            } else {
              setError(
                reason instanceof Error
                  ? reason.message
                  : "Could not delete this profile.",
              );
              setReviewing(true);
              // A booking may have been added while the confirmation was open.
              try {
                const response = await fetch("/api/operations/", {
                  cache: "no-store",
                });
                if (response.ok) {
                  const latest: DashboardData = await response.json();
                  setReviewData(latest);
                  setBlocking(
                    profileBlockingVisits(
                      latest.visits,
                      kind,
                      profile.id,
                      Date.now(),
                    ),
                  );
                }
              } catch {
                /* Keep the original error if the refresh is unavailable. */
              }
            }
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Deleting…" : `Delete ${kind}`}
        <span className="sr-only"> {profile.name}</span>
      </Button>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {reviewing && blocking.length > 0 && (
        <div
          className="profile-deletion-blockers"
          role="region"
          aria-label={`Visits blocking deletion of ${profile.name}`}
        >
          <p>
            <strong>
              {blocking.length}{" "}
              {blocking.length === 1 ? "clean needs" : "cleans need"} attention
              before deletion.
            </strong>{" "}
            {kind === "cleaner"
              ? "Arrange cover or cancel upcoming visits, and finish in-progress work."
              : "Cancel upcoming visits and finish in-progress work."}{" "}
            All existing records will be kept.
          </p>
          <ul>
            {blocking.map((visit) => (
              <li key={visit.id}>
                <PersonName kind="customer">
                  {(reviewData ?? data).customers.find(
                    (customer) => customer.id === visit.customer_id,
                  )?.name || "Customer"}
                </PersonName>
                <span>
                  {londonDate(visit.starts_at, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {visit.status}
                </span>
                <Link
                  className="text-link"
                  href={`/admin/calendar/?visit=${visit.id}`}
                >
                  Open visit →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
