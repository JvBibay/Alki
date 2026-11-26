import type { Account } from "@/lib/types";
import { getInst, type Institution } from "@/lib/institutions";
import { LOGOS } from "@/lib/logos.generated";
import { coinScale, coinSymbol } from "@/lib/currency";
import { getBaseCurrency } from "@/lib/format";

/**
 * Logo for an account or institution: an uploaded logo, then the bank's logo file,
 * then a monogram in the brand color.
 */
export default function BankLogo({ account, inst, size = 36 }: { account?: Account; inst?: Institution; size?: number }) {
  const i = inst ?? getInst(account?.inst);
  const radius = Math.round(size * 0.28);
  const box = { width: size, height: size, borderRadius: radius, flex: "none" as const };
  const label = i?.name ?? account?.name ?? "Account";

  if (account?.logo) {
    return <img src={account.logo} alt={label} style={{ ...box, objectFit: "cover", background: "#fff" }} />;
  }
  if (i && LOGOS[i.logo]) {
    // App icons (<id>.app.png) fill the tile edge to edge; website logos get a little padding.
    const app = LOGOS[i.logo].includes(".app.");
    return (
      <span className={`banklogo${app ? " app" : ""}`} style={{ ...box, padding: app ? 0 : Math.round(size * 0.08) }}>
        <img src={`/logos/${LOGOS[i.logo]}`} alt={label} width={size} height={size} loading="lazy" />
      </span>
    );
  }
  if (!i && account?.kind === "cash") {
    // The cash account's own currency sign (₱, $, ¥, RM…).
    const mark = coinSymbol(account.currency || getBaseCurrency());
    if (mark === "₱") {
      // Drawn, not typed: fonts often lack ₱ or lose its two bars at this weight, which leaves a plain "P".
      return (
        <span className="banklogo mono" style={{ ...box, background: "#0f766e" }} role="img" aria-label="Cash">
          <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8.5 20V4.5h5a4.25 4.25 0 0 1 0 8.5H8.5" />
            <path d="M5.5 8h12M5.5 11h12" strokeWidth="1.9" />
          </svg>
        </span>
      );
    }
    return (
      <span className="banklogo mono" style={{ ...box, background: "#0f766e", color: "#fff", fontSize: size * 0.5 * coinScale(mark) }} aria-label="Cash">
        {mark}
      </span>
    );
  }
  const text = i?.short ?? (account?.name ?? "?").replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return (
    <span
      className="banklogo mono"
      style={{ ...box, background: i?.color ?? account?.color ?? "#64748b", color: i?.ink ?? "#fff", fontSize: size * (text.length > 3 ? 0.27 : text.length > 2 ? 0.3 : 0.38), textTransform: text === text.toLowerCase() ? "none" : undefined }}
      aria-label={label}
    >
      {text}
    </span>
  );
}
