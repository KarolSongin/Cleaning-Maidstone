import { PublicHeader, PublicFooter } from "@/components/public-shell";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <PublicHeader />
      {children}
      <PublicFooter />
    </>
  );
}
