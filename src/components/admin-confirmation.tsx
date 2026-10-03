"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ConfirmationRequest } from "@/lib/admin-confirmation";
import { PersonName } from "./person-name";
import { Button } from "./ui/button";

const ConfirmationContext = createContext<
  ((request: ConfirmationRequest) => Promise<boolean>) | null
>(null);
export function useAdminConfirmation() {
  return useContext(ConfirmationContext);
}

export function AdminConfirmationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const resolver = useRef<((approved: boolean) => void) | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useCallback((next: ConfirmationRequest) => {
    // Repeated clicks must never replace an outstanding decision or queue a second write.
    if (resolver.current) return Promise.resolve(false);
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setRequest(next);
    });
  }, []);
  const finish = useCallback((approved: boolean) => {
    const resolve = resolver.current;
    if (!resolve) return;
    resolver.current = null;
    setRequest(null);
    resolve(approved);
    const target = opener.current;
    requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  }, []);
  useEffect(() => {
    if (request) {
      dialog.current?.showModal();
      cancel.current?.focus();
    } else dialog.current?.close();
  }, [request]);
  useEffect(
    () => () => {
      resolver.current?.(false);
      resolver.current = null;
    },
    [],
  );
  const Icon = request?.danger ? AlertTriangle : CheckCircle2;
  return (
    <ConfirmationContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialog}
        className="admin-confirmation"
        data-admin-confirmation
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="admin-confirmation-title"
        aria-describedby="admin-confirmation-description"
        onCancel={(event) => {
          event.preventDefault();
          finish(false);
        }}
        onClose={() => {
          if (!dialog.current?.open) finish(false);
        }}
      >
        {request && (
          <>
            <div
              className={`confirmation-icon${request.danger ? " is-danger" : ""}`}
            >
              <Icon size={24} aria-hidden="true" />
            </div>
            <h2 id="admin-confirmation-title">{request.title}</h2>
            {(request.customerName || request.cleanerName) && (
              <p className="confirmation-people">
                {request.customerName && (
                  <PersonName kind="customer">
                    {request.customerName}
                  </PersonName>
                )}
                {request.cleanerName && (
                  <PersonName kind="cleaner">{request.cleanerName}</PersonName>
                )}
              </p>
            )}
            <p id="admin-confirmation-description">{request.description}</p>
            <div className="confirmation-actions">
              <Button
                ref={cancel}
                type="button"
                variant="outline"
                onClick={() => finish(false)}
              >
                Go back
              </Button>
              <Button
                type="button"
                className={request.danger ? "button-danger" : undefined}
                data-confirm-accept
                onClick={() => finish(true)}
              >
                {request.confirmLabel}
              </Button>
            </div>
          </>
        )}
      </dialog>
    </ConfirmationContext.Provider>
  );
}
