import Link from "next/link";
export default function NotFound() {
  return (
    <main className="section page-intro">
      <p className="eyebrow">404 · A little off the beaten track</p>
      <h1>This page isn’t here.</h1>
      <p>Let’s get you back to a calmer place.</p>
      <Link href="/" className="button button-primary">
        Back to home
      </Link>
    </main>
  );
}
