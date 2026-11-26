/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// Optional cloud backup: allow connections to this one Supabase project (and nothing else).
let supabaseOrigin = "";
try {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin;
} catch {
  /* invalid URL: leave cloud connections blocked */
}

// Optional sign-in captcha (Cloudflare Turnstile): only when a site key is set, allow its script and its box.
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? " https://challenges.cloudflare.com" : "";

// Content Security Policy: only this site's own code, images and connections are allowed.
// Next.js needs inline scripts/styles; dev mode also needs eval and a websocket for hot reload.
const csp = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the on-device receipt reader (WebAssembly) run; it doesn't allow eval().
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${turnstile}${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  // open.er-api.com: optional exchange-rate updates (public rates only, no user data).
  // data: lets the receipt reader load its built-in WebAssembly the fast way (no network involved).
  // The Supabase origin is only for the optional encrypted cloud backup (sign-in and ciphertext).
  `connect-src 'self' data: https://open.er-api.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}${isDev ? " ws: wss:" : ""}`,
  `frame-src ${turnstile ? "https://challenges.cloudflare.com" : "'none'"}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
