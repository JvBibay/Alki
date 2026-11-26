/** People you split bills with: profiles plus per-person balances built from debts. */
import type { Debt, PersonProfile, State } from "./types";
import { debtLeft, debtPaid, isSettled } from "./debts";

/** Same person whatever the spacing or capitals: "ate  Joy" and "Ate Joy" match. */
export const personKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * What to call someone in a message: usually their first name ("Jose Vincent B." → "Jose"), but a title like
 * Kuya, Ate or Sir is part of the name, so "Kuya Dan" stays "Kuya Dan" and not just "Kuya".
 */
export function greetingName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return name.trim();
  return HONORIFIC.test(parts[0]) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
}

/** Avatar colors that read well with white text in light and dark themes. */
export const PERSON_COLORS = ["#2e7d4f", "#0f8f74", "#2563a8", "#5b50c8", "#b8456b", "#c2410c", "#a16207", "#4b5563"];

/** A stable color picked from the name, used until the person chooses one. */
export function defaultColor(name: string) {
  let h = 0;
  for (const ch of personKey(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PERSON_COLORS[h % PERSON_COLORS.length];
}

const HONORIFIC = /^(ma['’]?am|sir|ate|kuya|tita|tito|lola|lolo|mr\.?|ms\.?|mrs\.?|dr\.?)$/i;

/** "Joy Cruz" → "JC", "Ma'am Joms" → "J" (titles like Ate, Kuya, Ma'am are skipped). */
export const initials = (name: string) => {
  const all = name.trim().split(/\s+/).filter(Boolean);
  const parts = all.filter((p) => !HONORIFIC.test(p));
  const use = parts.length ? parts : all;
  if (use.length === 0) return "?";
  return (use[0].charAt(0) + (use.length > 1 ? use[use.length - 1].charAt(0) : "")).toUpperCase();
};

/**
 * Avatar text for a group of people, so no two look the same: if "Aaron" and "Alex" would
 * both be "A", they become "Aa" and "Al". Returns a map from personKey to label.
 */
export function avatarLabels(names: string[]) {
  const keys = [...new Set(names.map(personKey))].filter(Boolean);
  const nameOf = new Map(names.map((n) => [personKey(n), n.trim()]));
  const out = new Map<string, string>();
  const groups = new Map<string, string[]>();
  for (const k of keys) {
    const base = initials(nameOf.get(k)!);
    groups.set(base, [...(groups.get(base) ?? []), k]);
  }
  for (const [base, group] of groups) {
    if (group.length === 1) {
      out.set(group[0], base);
      continue;
    }
    const used = new Set<string>();
    for (const k of group) {
      const all = nameOf.get(k)!.split(/\s+/);
      const parts = all.filter((p) => !HONORIFIC.test(p));
      const w = (parts[0] ?? all[0]).replace(/[^\p{L}\p{N}]/gu, "");
      let label = base;
      for (let i = 1; i < w.length; i++) {
        const c = w.charAt(0).toUpperCase() + w.charAt(i).toLowerCase();
        if (!used.has(c) && c !== base) {
          label = c;
          break;
        }
      }
      used.add(label);
      out.set(k, label);
    }
  }
  return out;
}

export function findProfile(state: State, name: string): PersonProfile | undefined {
  const key = personKey(name);
  return (state.people ?? []).find((p) => personKey(p.name) === key);
}

export interface PersonSummary {
  key: string;
  /** Display name: the profile's name, else the most recent spelling used on a debt. */
  name: string;
  profile?: PersonProfile;
  color: string;
  /** Avatar initials, made unique among everyone you track. */
  label: string;
  /** Unpaid debts with this person (both directions). */
  open: Debt[];
  settled: Debt[];
  /** What they still owe you. */
  owedLeft: number;
  /** What you still owe them. */
  oweLeft: number;
  /** owedLeft − oweLeft: positive means they owe you overall. */
  net: number;
  /** On their open "owes you" items: amount already paid back, of the total. */
  collected: number;
  collectTarget: number;
  /** Most recent activity, for sorting. */
  last: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** One summary per person who has a debt or a saved profile. */
export function peopleSummary(state: State): PersonSummary[] {
  const map = new Map<string, PersonSummary>();
  const get = (name: string) => {
    const key = personKey(name);
    let p = map.get(key);
    if (!p) {
      const profile = findProfile(state, name);
      p = {
        key,
        name: profile?.name ?? name.trim(),
        profile,
        color: profile?.color ?? defaultColor(name),
        label: "",
        open: [],
        settled: [],
        owedLeft: 0,
        oweLeft: 0,
        net: 0,
        collected: 0,
        collectTarget: 0,
        last: 0,
      };
      map.set(key, p);
    }
    return p;
  };
  for (const prof of state.people ?? []) get(prof.name);
  for (const d of state.debts ?? []) {
    if (!d.person.trim()) continue;
    const p = get(d.person);
    const last = Math.max(d.created, ...d.payments.map((x) => x.date));
    if (last >= p.last) {
      p.last = last;
      if (!p.profile) p.name = d.person.trim();
    }
    if (isSettled(d)) {
      p.settled.push(d);
      continue;
    }
    p.open.push(d);
    const left = debtLeft(d);
    if (d.direction === "owed") {
      p.owedLeft += left;
      p.collected += debtPaid(d);
      p.collectTarget += d.amount;
    } else p.oweLeft += left;
  }
  // Split shares count too, so names on old splits get unique avatars as well.
  const names = [...[...map.values()].map((p) => p.name), ...(state.splits ?? []).flatMap((s) => s.people.map((x) => x.name))];
  const labels = avatarLabels(names);
  return [...map.values()]
    .map((p) => ({ ...p, label: labels.get(p.key) ?? initials(p.name), owedLeft: r2(p.owedLeft), oweLeft: r2(p.oweLeft), net: r2(p.owedLeft - p.oweLeft), collected: r2(p.collected), collectTarget: r2(p.collectTarget) }))
    .sort((a, b) => Number(b.open.length > 0) - Number(a.open.length > 0) || Math.abs(b.net) - Math.abs(a.net) || b.last - a.last);
}

/** A friendly reminder to paste in a chat with one person. */
export function personReminder(p: PersonSummary, fmt: (n: number) => string, payHandle?: string) {
  const owed = p.open.filter((d) => d.direction === "owed");
  const owe = p.open.filter((d) => d.direction === "owe");
  const lines = [`Hi ${greetingName(p.name)}! 👋 Quick tally:`];
  for (const d of owed) lines.push(`• ${d.note || "Utang"}: ${fmt(debtLeft(d))}`);
  for (const d of owe) lines.push(`• Mine to pay you, ${d.note || "utang"}: −${fmt(debtLeft(d))}`);
  if (p.net > 0) lines.push(`Total: ${fmt(p.net)}`);
  else if (p.net < 0) lines.push(`I owe you ${fmt(-p.net)} overall, I'll send it soon 🙏`);
  else lines.push("We're even 🙌");
  if (p.net > 0 && payHandle) lines.push(`You can send it to ${payHandle}. Salamat!`);
  lines.push("— sent from Kwenta");
  return lines.join("\n");
}
