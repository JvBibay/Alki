import type { ParsedTx, State } from "./types";
import { catNames } from "./categories";
import { debtLeft } from "./debts";
import { cardCycle, cycleLabel } from "./cards";
import { activeDeposits, depositMath, depositStatus } from "./deposits";
import { budgetList, periodInfo } from "./budgets";
import { parseEntry } from "./parser";
import { detectIntent, namedAccount, usualAccount, type Intent } from "./intents";
import { accCurrency, addDays, balance, balanceBase, baseCurrency, DAY, forecast, installmentDues, toBase, monthRange, netWorth, periodRange, startOfDay, sumRange, upcoming } from "./stats";
import { fmt, fmtIn } from "./format";

export interface Reply {
  text: string;
  /** A transaction the assistant wants to log. */
  tx?: ParsedTx;
  /** How Alki looks while saying it. */
  face?: "happy" | "confused";
  /** Something bigger than one entry: paying a bill, a split, settling a debt, several entries. */
  intent?: Intent;
  /** Why an account was picked when the message didn't name one (“your usual for Food”). */
  hint?: string;
}

const HELP =
  "I can log things like “spent 225 on lunch”, “salary 15000 bank”, “lunch 180 and jeep 24”, or “transfer 500 from bank to gcash”. " +
  "Try “bayad meralco 3400 bpi” to pay a bill, “hati kami ni Migs 1200” to split, or “binayaran ko si Ate Rica 500” to pay someone back. " +
  "You can also ask me “what’s my balance?”, “how much did I spend this week on food?”, “what bills are coming up?”, or “can I afford 2000?”.";

function rangeFromText(low: string, now: number): { from: number; to: number; label: string } {
  if (/\byesterday\b/.test(low)) {
    const d = addDays(startOfDay(now), -1);
    return { from: d, to: addDays(d, 1), label: "yesterday" };
  }
  if (/\btoday\b/.test(low)) {
    const [from, to] = periodRange("day", now);
    return { from, to, label: "today" };
  }
  if (/\b(this )?week\b/.test(low)) {
    const [from, to] = periodRange("week", now);
    return { from, to, label: "this week" };
  }
  if (/\blast month\b/.test(low)) {
    const d = new Date(now);
    const [from, to] = monthRange(d.getFullYear(), d.getMonth() - 1);
    return { from, to, label: "last month" };
  }
  const [from, to] = periodRange("month", now);
  return { from, to, label: "this month" };
}

const NO_ACCOUNT = "I’d love to log that, but you don’t have an account yet. Add one in Wallet → Add account (like Cash or GCash), then tell me again. 🙂";

/** One line saying what Alki is about to do (or did) for an intent. */
export function describeIntent(i: Intent, state: State): string {
  const name = (id?: string) => state.accounts.find((a) => a.id === id)?.name ?? "your account";
  switch (i.kind) {
    case "bill": {
      const month = i.item.due.toLocaleDateString("en-PH", { month: "long" });
      const income = i.item.item.type === "income";
      return `Marked ${i.item.item.name} ${income ? "received" : "paid"} for ${month}: ${fmtIn(i.amount, accCurrency(state, i.acc))} ${income ? "into" : "from"} ${name(i.acc)}.`;
    }
    case "split": {
      const others = i.people.map((p) => p.name).join(", ");
      return `Split ${i.title} (${fmt(i.total)}) with ${others}. Your share is ${fmt(i.myShare)}; ${i.people.length === 1 ? `${others} owes` : "they owe"} you ${fmt(i.total - i.myShare)}.`;
    }
    case "settle": {
      const total = i.pays.reduce((s, p) => s + p.amount, 0);
      const extra = i.leftover > 0 ? ` That was ${fmt(i.leftover)} more than the ${fmt(total)} on record, so I only recorded ${fmt(total)}.` : "";
      return i.direction === "owe" ? `Recorded: you paid ${i.person} ${fmt(total)}.${extra}` : `Recorded: ${i.person} paid you ${fmt(total)}.${extra}`;
    }
    case "multi":
      return `Logged ${i.txs.length} entries.`;
    case "say":
      return i.text;
  }
}

/** Answers a chat message. Everything runs locally; nothing leaves the device. */
export function respond(input: string, state: State, now = Date.now()): Reply {
  const text = input.trim();
  const low = text.toLowerCase();
  if (!text) return { text: HELP };

  if (/^(hi|hello|hey|kumusta|musta|yo)\b/.test(low)) {
    const name = state.settings.name ? `, ${state.settings.name}` : "";
    return { text: `Hi${name}! What did you spend on today? ${"Or ask me about your money."}` };
  }
  if (/\b(thanks|thank you|salamat|ty)\b/.test(low)) return { text: "Anytime! Keep that streak going. 🔥" };
  if (/\b(help|what can you do|paano)\b/.test(low)) return { text: HELP };

  const isQuestion = /\?|^(how|what|when|where|which|can|do|am|is|magkano|ilan)\b/.test(low);

  // "can I afford 2000?"
  const afford = low.match(/afford\s+(?:a\s+|an\s+)?[^\d]*(\d[\d,]*(?:\.\d+)?)(k\b)?/);
  if (afford) {
    const amt = parseFloat(afford[1].replace(/,/g, "")) * (afford[2] ? 1000 : 1);
    if (!(amt > 0)) return { text: "Tell me how much, like “can I afford 2000?”." };
    const f = forecast(state, now);
    const left = f.available - amt;
    if (left < 0) return { text: `Not right now. After your upcoming bills you’d be ${fmt(-left)} short before payday.` };
    const perDay = Math.floor(f.pay.daysLeft ? left / f.pay.daysLeft : left);
    return {
      text: `Yes, but after ${fmt(amt)} and your upcoming bills you’d have ${fmt(left)} left, about ${fmt(perDay)} a day until payday (${f.pay.daysLeft} days).`,
    };
  }

  if (/\b(balance|how much (do|have) i|money do i have|net worth|pera ko)\b/.test(low)) {
    const named = state.accounts.find((a) => low.includes(a.name.toLowerCase()));
    if (named) {
      const c = accCurrency(state, named.id);
      const conv = c !== baseCurrency(state) ? ` (≈ ${fmt(balanceBase(state, named))})` : "";
      return { text: `${named.name} has ${fmtIn(balance(state, named), c)}${conv}.` };
    }
    const nw = netWorth(state);
    const lines = state.accounts.map((a) => `• ${a.name}: ${fmtIn(balance(state, a), accCurrency(state, a.id))}`).join("\n");
    return { text: `Your net worth is ${fmt(nw.net)}.\n${lines}` };
  }

  // "what's my biggest expense?" (before the general spending answer, which would also match "expense")
  if (/\b(biggest|largest|highest|most expensive)\b/.test(low) && /\b(expense|expenses|spend|spending|purchase|gastos)\b/.test(low)) {
    const r = rangeFromText(low, now);
    const top = state.txs.filter((t) => t.type === "expense" && t.date >= r.from && t.date <= r.to).sort((a, b) => b.amount - a.amount)[0];
    if (!top) return { text: `I don’t see any expenses ${r.label}.` };
    const day = new Date(top.date).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
    return { text: `Your biggest expense ${r.label} was ${fmt(top.amount)}: ${top.note} (${top.cat}) on ${day}.` };
  }

  if (/\b(spen[dt]|spending|gastos|expenses?|nagastos)\b/.test(low) && isQuestion) {
    const r = rangeFromText(low, now);
    const s = sumRange(state, r.from, r.to);
    const cat = catNames(state.customCats ?? []).find((c) => low.includes(c.toLowerCase()));
    if (cat) return { text: `You spent ${fmt(s.cats[cat] ?? 0)} on ${cat} ${r.label}.` };
    const top = Object.entries(s.cats).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const detail = top.length ? ` Mostly ${top.map(([c, v]) => `${c} (${fmt(v)})`).join(", ")}.` : "";
    return { text: `You spent ${fmt(s.expense)} ${r.label}.${detail}` };
  }

  if (/\b(earn|income|made|kita)\b/.test(low) && isQuestion) {
    const r = rangeFromText(low, now);
    const s = sumRange(state, r.from, r.to);
    return { text: `You brought in ${fmt(s.income)} ${r.label}.` };
  }

  if (/\bbudgets?\b/.test(low)) {
    const list = budgetList(state, now);
    if (!list.length) return { text: "You haven’t set any budgets yet. Open Plan → Budgets to add one." };
    const lines = list.map(
      (x) => `• ${x.cat} (${periodInfo(x.period).label.toLowerCase()}): ${fmt(x.spent)} of ${fmt(x.limit)}${x.left < 0 ? " ⚠️ over" : ` (${fmt(x.left)} left ${periodInfo(x.period).this})`}`,
    );
    return { text: `Your budgets:\n${lines.join("\n")}` };
  }

  if (/\bgoals?\b|\bsav(e|ing)/.test(low) && isQuestion) {
    if (!state.goals.length) return { text: "No savings goals yet. Add one in Plan → Goals." };
    const lines = state.goals.map((g) => `• ${g.emoji} ${g.name}: ${fmt(g.saved)} of ${fmt(g.target)} (${Math.round((g.saved / g.target) * 100)}%)`);
    return { text: lines.join("\n") };
  }

  if (/\b(credit cards?|cards?)\b/.test(low) && /\b(due|pay|bayad|statement|bill|minimum)\b/.test(low)) {
    const cards = state.accounts.filter((a) => !a.archived && a.kind === "credit");
    if (!cards.length) return { text: "You don’t have a credit card account yet. Add one in Wallet → Add account." };
    const lines = cards.map((a) => {
      const c = cardCycle(state, a, now);
      if (!c) return `• ${a.name}: set the statement and due days in Wallet → ${a.name} to track it`;
      const when = new Date(c.dueDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
      if (c.status === "none") return `• ${a.name}: no payment due ✨`;
      if (c.status === "paid") return `• ${a.name}: paid for this statement ✅`;
      const state2 = c.status === "overdue" ? `overdue since ${when} ⚠️` : c.status === "min" ? `minimum paid, due ${when}` : c.daysLeft <= 7 ? `due ${when} (${cycleLabel(c).toLowerCase()})` : `due ${when}`;
      return `• ${a.name}: ${fmt(c.left)} left of ${fmt(c.statementBalance)}, minimum ${fmt(c.minDue)}, ${state2}`;
    });
    return { text: `Your cards:\n${lines.join("\n")}` };
  }

  if (/\b(bills?|upcoming|due|recurring|bayarin)\b/.test(low) && isQuestion) {
    const up = upcoming(state, now).slice(0, 5);
    if (!up.length) return { text: "Nothing planned yet. Add recurring bills in Plan → Upcoming." };
    const lines = up.map(
      (u) =>
        `• ${u.item.name}: ${fmtIn(u.item.amount, accCurrency(state, u.item.acc))} ${u.daysLeft < 0 ? "overdue" : u.daysLeft === 0 ? "today" : `in ${u.daysLeft} day${u.daysLeft === 1 ? "" : "s"}`}`,
    );
    return { text: `Coming up:\n${lines.join("\n")}` };
  }

  if (/\b(locked|time deposits?|deposits?|naka-?lock|matur\w*)\b/.test(low) && !/\d/.test(low)) {
    const deps = activeDeposits(state);
    if (!deps.length) return { text: "Nothing locked right now. Wallet → 🔒 Locked savings → Lock savings to track a time deposit." };
    const lines = deps.map((a) => {
      const st = depositStatus(a, now)!;
      const m = depositMath(a.deposit!.principal, a.deposit!.rate, a.deposit!.months, a.deposit!.tax);
      return `• ${a.name}: ${fmt(a.deposit!.principal)} → ${fmt(m.atMaturity)} ${st.matured ? "(ready to collect 🎉)" : `on ${new Date(st.maturity).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} (${st.left})`}`;
    });
    return { text: `Your locked savings:\n${lines.join("\n")}` };
  }

  if (/\b(utang|debts?|owes? me|i owe|who owes|pautang)\b/.test(low) && !/\d/.test(low)) {
    const open = (state.debts ?? []).filter((d) => debtLeft(d) > 0);
    if (!open.length) return { text: "No open debts. Add one in Plan → Debts, or split a bill there. 🤝" };
    const lines = [
      ...open.filter((d) => d.direction === "owed").map((d) => `• ${d.person} owes you ${fmt(debtLeft(d))}${d.note ? ` (${d.note})` : ""}`),
      ...open.filter((d) => d.direction === "owe").map((d) => `• You owe ${d.person} ${fmt(debtLeft(d))}${d.note ? ` (${d.note})` : ""}`),
    ];
    return { text: lines.join("\n") };
  }

  if (/\b(installments?|hulugan|hulog|amortization)\b/.test(low)) {
    const dues = installmentDues(state, now);
    if (!dues.length) return { text: "No active installments. Add one in Plan → Installments to see the monthly payment and real interest." };
    const total = dues.reduce((s, d) => s + toBase(state, d.monthly, d.plan.acc), 0);
    const lines = dues.map(
      (d) => `• ${d.plan.name}: ${fmtIn(d.monthly, accCurrency(state, d.plan.acc))}/mo, ${d.plan.months - d.plan.paid} left (next ${d.due.toLocaleDateString("en-PH", { month: "short", day: "numeric" })})`,
    );
    return { text: `You pay ${fmt(total)} a month in installments:\n${lines.join("\n")}` };
  }

  if (/\b(payday|sweldo day|forecast|safe to spend|until pay)\b/.test(low)) {
    const f = forecast(state, now);
    return {
      text: `Payday is in ${f.pay.daysLeft} day${f.pay.daysLeft === 1 ? "" : "s"}. To stay on track, keep spending under ${fmt(f.safeDaily)} a day. At your current pace you’ll have about ${fmt(f.projected)} left.`,
    };
  }

  if (!isQuestion) {
    const intent = detectIntent(text, state, now);
    if (intent) {
      if (intent.kind !== "say" && state.accounts.length === 0) return { text: NO_ACCOUNT };
      return { text: describeIntent(intent, state), intent, face: intent.kind === "say" ? "confused" : "happy" };
    }
  }

  const tx = parseEntry(text, state.accounts.filter((a) => !a.archived), state.defAcc, now, state.customCats ?? [], state.settings.payeeCats);
  if (tx && state.accounts.length === 0) return { text: NO_ACCOUNT };
  let hint: string | undefined;
  if (tx && tx.type !== "transfer" && !namedAccount(state, low)) {
    // No account said: use the one you usually use for this payee or category.
    const u = usualAccount(state, tx.type, tx.cat, tx.note);
    if (u) {
      tx.acc = u.acc;
      hint = u.why;
    }
  }
  if (tx) {
    const acc = state.accounts.find((a) => a.id === tx.acc)?.name ?? "";
    const to = state.accounts.find((a) => a.id === tx.to)?.name ?? "";
    const when = startOfDay(tx.date) === startOfDay(now) ? "" : ` on ${new Date(tx.date).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" })}`;
    const line =
      tx.type === "transfer"
        ? `Transfer: ${fmtIn(tx.amount, accCurrency(state, tx.acc))} from ${acc} to ${to}`
        : tx.type === "income"
          ? `Income: ${fmtIn(tx.amount, accCurrency(state, tx.acc))} to ${acc}`
          : `Expense: ${fmtIn(tx.amount, accCurrency(state, tx.acc))} in ${tx.cat} from ${acc}`;
    return { text: `Logged it! ${line}${when}.`, tx, face: "happy", hint };
  }

  return { text: `I didn’t catch an amount there. ${HELP}`, face: "confused" };
}
