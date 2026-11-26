/** Helpers for typing peso amounts with commas. */

/** Keeps digits and one decimal point (max 2 decimals): "₱25,000.5x" → "25000.5". */
export function cleanMoney(text: string, maxDecimals = 2): string {
  let out = "";
  let dot = false;
  let decimals = 0;
  for (const ch of text) {
    if (ch >= "0" && ch <= "9") {
      if (dot) {
        if (decimals >= maxDecimals) continue;
        decimals++;
      }
      out += ch;
    } else if (ch === "." && maxDecimals === 0) {
      break; // currencies like JPY have no decimals: ignore what follows the point
    } else if (ch === "." && !dot) {
      dot = true;
      out += out ? "." : "0.";
    }
  }
  // Drop leading zeros like "0005" but keep "0" and "0.5".
  return out.replace(/^0+(?=\d)/, "");
}

/** Adds thousands commas while keeping what's being typed: "25000." → "25,000." */
export function formatMoneyTyping(raw: string): string {
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  const withCommas = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec !== undefined ? `${withCommas}.${dec}` : withCommas;
}
