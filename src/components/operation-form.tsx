"use client";
import { useState, useCallback, useRef, type ReactNode } from "react";
import { Button } from "./ui/button";
import type { PersonKind } from "./person-name";
import { useAdminConfirmation } from "./admin-confirmation";
import {
  ActionCancelled,
  adminConfirmation,
  type ConfirmationRequest,
} from "@/lib/admin-confirmation";
export async function sendOperation(action: string, data: unknown) {
  const response = await fetch("/api/operations/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, data }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error);
  return result;
}
export function useConfirmedOperation() {
  const confirm = useAdminConfirmation();
  const pending = useRef(false);
  return useCallback(
    async (action: string, data: unknown, details?: ConfirmationRequest) => {
      if (pending.current) throw new ActionCancelled();
      pending.current = true;
      try {
        if (
          confirm &&
          !(await confirm(details ?? adminConfirmation(action, data)))
        )
          throw new ActionCancelled();
        return await sendOperation(action, data);
      } finally {
        pending.current = false;
      }
    },
    [confirm],
  );
}
export function OperationForm({
  action,
  map,
  children,
  onSaved,
  label = "Save changes",
  disabled = false,
}: {
  action: string;
  map: (f: FormData) => unknown;
  children: ReactNode;
  onSaved: (result?: { id?: string }) => Promise<void> | void;
  label?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const save = useConfirmedOperation();
  return (
    <form
      className="ops-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setSuccess(false);
        try {
          const result = await save(
            action,
            map(new FormData(event.currentTarget)),
          );
          setSuccess(true);
          await onSaved(result);
        } catch (e) {
          if (!(e instanceof ActionCancelled))
            setError(e instanceof Error ? e.message : "The request failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="alert" role="status">
          Saved successfully.
        </p>
      )}
      <Button type="submit" disabled={busy || disabled}>
        {busy ? "Saving…" : label}
      </Button>
    </form>
  );
}
export function Field({
  name,
  label,
  type = "text",
  value = "",
  required = false,
  personKind,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  personKind?: PersonKind;
}) {
  return (
    <label>
      {label}
      <input
        className={personKind ? `person-input-${personKind}` : undefined}
        name={name}
        type={type}
        defaultValue={value}
        required={required}
      />
    </label>
  );
}
