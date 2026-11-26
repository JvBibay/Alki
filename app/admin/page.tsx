import type { Metadata } from "next";
import Admin from "@/components/Admin";

// Not for search engines; the database only answers admins anyway.
export const metadata: Metadata = { title: "Feedback admin – Kwenta", robots: { index: false, follow: false } };

export default function Page() {
  return <Admin />;
}
