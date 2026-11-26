import type { MetadataRoute } from "next";

/** Makes Kwenta installable ("Add to Home screen") as a full-screen app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kwenta – Budget Tracker",
    short_name: "Kwenta",
    description: "Log money by typing or talking to Alki. Your data stays on your device.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the opening animation, so the phone's own launch screen flows into it.
    background_color: "#2f7a4d",
    theme_color: "#2f7a4d",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
