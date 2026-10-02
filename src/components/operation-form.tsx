"use client";
import { useState, type ReactNode } from "react";
import { Button } from "./ui/button";
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
export function OperationForm({
  action,
  map,
  children,
  onSaved,
  label = "Save changes",
}: {
  action: string;
  map: (f: FormData) => unknown;
  children: ReactNode;
  onSaved: () => Promise<void> | void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  return (
    <form
      className="ops-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError("");
        setSuccess(false);
        try {
          await sendOperation(action, map(new FormData(event.currentTarget)));
          setSuccess(true);
          await onSaved();
        } catch (e) {
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
      <Button type="submit" disabled={busy}>
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
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} defaultValue={value} required={required} />
    </label>
  );
}
