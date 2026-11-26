import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import { PALETTES } from "@/lib/themes";

export const metadata: Metadata = {
  title: "Kwenta – Budget Tracker",
  description: "Log money by typing or talking to Alki. Budgets, goals, bills and stats. Your data stays on your device.",
  applicationName: "Kwenta",
  appleWebApp: { capable: true, title: "Kwenta", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png?v=2", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies the saved theme before first paint so there is no light/dark flash,
// and colors the phone's status bar to match the header of the chosen palette.
const BARS = Object.fromEntries(PALETTES.map((p) => [p.id, [p.band, p.bandDark]]));
const themeScript = `try{var B=${JSON.stringify(BARS)};var p=JSON.parse(localStorage.getItem("kwenta-prefs")||"null");if(!p){var s=JSON.parse(localStorage.getItem("kwenta-v2")||"{}");p=s.settings||{};p.custom=p.customColor}var d=document.documentElement;if(p.theme==="light"||p.theme==="dark"||p.theme==="amoled")d.dataset.theme=p.theme;if(p.palette)d.dataset.palette=p.palette;var hx=/^#[0-9a-fA-F]{6}$/.test(p.custom||"");if(p.palette==="custom"&&hx)d.style.setProperty("--custom",p.custom);var dark=p.theme==="dark"||p.theme==="amoled"||(p.theme!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var c=(B[p.palette]||B.forest)[dark?1:0];if(p.palette==="custom"&&hx){var n=function(i){return parseInt(p.custom.slice(1+i*2,3+i*2),16)};var f=dark?0.4:1;c="#"+[0,1,2].map(function(i){return Math.round(n(i)*f).toString(16).padStart(2,"0")}).join("")}if(p.theme==="amoled")c="#000000";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",c)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#2f7a4d" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
