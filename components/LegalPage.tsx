import type { ReactNode } from "react";

/** Who runs Kwenta. Set these in .env.local / Vercel; the legal pages show them as the contact. */
export const LEGAL = {
  name: process.env.NEXT_PUBLIC_LEGAL_NAME || "the Kwenta operator",
  email: process.env.NEXT_PUBLIC_LEGAL_EMAIL || "",
};

export const LEGAL_UPDATED = "24 November 2026";

/** Shared look for Terms and Privacy: plain, readable, follows the app's light/dark colors. */
export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 64px", lineHeight: 1.6 }}>
      <p style={{ margin: "0 0 16px" }}>
        <a href="/">← Back to Kwenta</a>
      </p>
      <h1 style={{ margin: "0 0 4px" }}>{title}</h1>
      <p className="sub" style={{ margin: "0 0 20px" }}>
        Last updated {LEGAL_UPDATED}
      </p>
      {children}
      <p className="sub" style={{ marginTop: 32 }}>
        <a href="/terms">Terms of Use</a> · <a href="/privacy">Privacy Notice</a>
      </p>
    </main>
  );
}

export const H = ({ children }: { children: ReactNode }) => <h2 style={{ fontSize: 18, margin: "24px 0 6px" }}>{children}</h2>;

/** The contact line, or a plain fallback until NEXT_PUBLIC_LEGAL_EMAIL is set. */
export const Contact = () => (LEGAL.email ? <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> : <b>the contact shown in the app</b>);
