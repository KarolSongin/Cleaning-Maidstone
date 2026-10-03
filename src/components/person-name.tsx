import type { ReactNode } from "react";

export type PersonKind = "cleaner" | "customer";
export function PersonName({
  kind,
  children,
}: {
  kind: PersonKind;
  children: ReactNode;
}) {
  return (
    <span className={`person-name person-name-${kind}`} data-person-kind={kind}>
      {children}
    </span>
  );
}
