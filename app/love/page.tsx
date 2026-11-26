import type { Metadata } from "next";
import Love from "@/components/Love";

export const metadata: Metadata = {
  title: "What people say – Kwenta",
  description: "Real words from people who track their money with Kwenta and Alki.",
  openGraph: { title: "What people say about Kwenta", description: "Real words from people who track their money with Kwenta and Alki.", type: "website" },
};

export default function Page() {
  return <Love />;
}
