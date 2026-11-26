import type { State } from "./types";
import { DAY, forecast, installmentDues, monthRange, startOfDay, streak, sumRange, upcoming } from "./stats";
import { fmt } from "./format";
import { budgetList, periodInfo } from "./budgets";
import { activeDeposits, depositStatus } from "./deposits";
import { cardsDue } from "./cards";

export type Mood = "excited" | "happy" | "neutral" | "sleepy" | "worried" | "sad" | "angry";

export interface AlkiMood {
  mood: Mood;
  /** Expression for the mascot. */
  face: "love" | "happy" | "normal" | "sleepy" | "worried" | "sad" | "angry" | "excited";
  /** What Alki says about it. */
  line: string;
  emoji: string;
}

/**
 * How Alki feels about your money right now, most important first:
 * angry (way over budget) › sad (over budget / running short) › worried (bill due) ›
 * excited (sweldo day / goal done) › sleepy (nothing logged lately) › happy (streak, saving) › neutral.
 */
export function alkiMood(state: State, now = Date.now()): AlkiMood {
  const d = new Date(now);
  const [from, to] = monthRange(d.getFullYear(), d.getMonth());
  const s = sumRange(state, from, to);

  // Budgets (each in its own period: daily, weekly, monthly…)
  const worst = budgetList(state, now).sort((a, b) => b.pct - a.pct)[0];
  const per = worst ? (worst.period === "monthly" ? "" : `${periodInfo(worst.period).label.toLowerCase()} `) : "";
  if (worst && worst.pct >= 125) {
    return { mood: "angry", face: "angry", emoji: "😤", line: `Grr! ${worst.cat} is at ${Math.round(worst.pct)}% of its ${per}budget. Hinay-hinay lang!` };
  }
  if (s.income > 0 && s.expense > s.income * 1.1) {
    return { mood: "angry", face: "angry", emoji: "😤", line: `We spent ${fmt(s.expense - s.income)} more than came in this month. Not cool!` };
  }
  if (worst && worst.pct > 100) {
    return { mood: "sad", face: "sad", emoji: "😢", line: `We went over the ${per}${worst.cat} budget… Let’s be careful ${periodInfo(worst.period).this === "today" ? "for the rest of the day" : `for the rest of ${periodInfo(worst.period).this}`}.` };
  }
  const f = forecast(state, now);
  if (state.txs.length >= 5 && f.projected < 0) {
    return { mood: "sad", face: "sad", emoji: "😢", line: `At this pace we might run short by ${fmt(-f.projected)} before sweldo.` };
  }

  // Credit card bills: overdue is sad, due within 2 days is worrying.
  const cards = cardsDue(state, now);
  const overdueCard = cards.find(({ c }) => c.status === "overdue");
  if (overdueCard) {
    return { mood: "sad", face: "sad", emoji: "😢", line: `${overdueCard.a.name} payment is overdue! Pay soon to avoid late fees and interest.` };
  }
  if (cards.length) {
    const { a, c } = cards[0];
    return { mood: "worried", face: "worried", emoji: "😟", line: `${a.name} payment ${c.daysLeft === 0 ? "is due today" : c.daysLeft === 1 ? "is due tomorrow" : `is due in ${c.daysLeft} days`}. ${fmt(c.left)} to clear it.` };
  }

  // Bills and installments due very soon
  const bill = upcoming(state, now).find((u) => u.item.type === "expense" && u.daysLeft <= 2);
  if (bill) {
    const when = bill.daysLeft < 0 ? "is overdue" : bill.daysLeft === 0 ? "is due today" : bill.daysLeft === 1 ? "is due tomorrow" : "is due in 2 days";
    return { mood: "worried", face: "worried", emoji: "😟", line: `${bill.item.name} ${when}. Don’t forget!` };
  }
  const inst = installmentDues(state, now).find((x) => x.daysLeft <= 2);
  if (inst) {
    return { mood: "worried", face: "worried", emoji: "😟", line: `${inst.plan.name} installment ${inst.daysLeft < 0 ? "is due" : inst.daysLeft === 0 ? "is due today" : `is due in ${inst.daysLeft} day${inst.daysLeft === 1 ? "" : "s"}`}.` };
  }

  // Good news
  if (f.pay.daysLeft === 0) return { mood: "excited", face: "excited", emoji: "🤩", line: "Sweldo day! 🎉 Pay yourself first: save before you spend!" };
  const matured = activeDeposits(state).find((a) => depositStatus(a, now)?.matured);
  if (matured) return { mood: "excited", face: "excited", emoji: "🤩", line: `${matured.name} has matured! Collect your money plus interest in Wallet. 🎉` };
  const done = state.goals.find((g) => g.saved >= g.target);
  if (done && now - done.created < 30 * DAY) return { mood: "excited", face: "love", emoji: "🤩", line: `We reached “${done.name}”! I’m so proud! 🎉` };

  // Nothing logged lately
  if (state.txs.length > 0) {
    const last = Math.max(...state.txs.map((t) => t.date));
    const days = Math.floor((startOfDay(now) - startOfDay(last)) / DAY);
    if (days >= 2) return { mood: "sleepy", face: "sleepy", emoji: "😴", line: `Zzz… it’s been ${days} days. Log something to wake me up?` };
  }

  const st = streak(state.txs, now);
  if (st.count >= 3) return { mood: "happy", face: "happy", emoji: "😊", line: `${st.count}-day streak! You’re on a roll! 🔥` };
  if (s.income > 0 && s.expense < s.income * 0.7) return { mood: "happy", face: "happy", emoji: "😊", line: "We’re spending well under what comes in. Love it!" };

  return { mood: "neutral", face: "normal", emoji: "🙂", line: "All calm. Keep logging and I’ll keep watch." };
}
