import { catEmoji } from "./categories";

/**
 * A fitting icon for a recurring bill from its name, so Internet isn't a lightbulb and the gym isn't a pill.
 * Falls back to the category's icon. (Saved data is unchanged; this is only how a bill is drawn.)
 */
const RULES: [RegExp, string][] = [
  [/\b(wi-?fi|internet|fiber|fibre|pldt|converge|sky\s?cable|globe at home|home prepaid)\b/, "📶"],
  [/\b(meralco|electric\w*|kuryente|power|veco|davao light)\b/, "💡"],
  [/\b(water|maynilad|manila water|tubig)\b/, "💧"],
  [/\b(rent|upa|condo|association|hoa|dues|dorm)\b/, "🏠"],
  [/\b(gym|fitness|crossfit|anytime|yoga|pilates)\b/, "🏋️"],
  [/\b(spotify|apple music|music|tidal|deezer)\b/, "🎵"],
  [/\b(netflix|disney\+?|hbo|prime video|viu|youtube|iwant|tv\+?|cable)\b/, "📺"],
  [/\b(subscription|icloud|google one|chatgpt|claude|canva|adobe|dropbox|membership)\b/, "🔁"],
  [/\b(insurance|philhealth|sun life|manulife|pru\w*|axa|life plan)\b/, "🛡️"],
  [/\b(loan|mortgage|amortization|financing|sss|pag-?ibig|hulog)\b/, "🏦"],
  [/\b(phone|postpaid|prepaid|mobile|smart|dito|tnt|load|plan)\b/, "📱"],
  [/\b(credit card|card)\b/, "💳"],
];

export function billEmoji(name: string, cat: string): string {
  const n = name.toLowerCase();
  for (const [re, e] of RULES) if (re.test(n)) return e;
  return catEmoji(cat);
}
