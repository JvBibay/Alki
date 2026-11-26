import type { State } from "./types";
import { forecast, monthRange, streak, sumRange } from "./stats";
import { fmt } from "./format";
import { budgetList, periodInfo } from "./budgets";

/** One short, friendly line from Alki about the current state of your money. */
export function insight(state: State, now = Date.now()): string {
  const d = new Date(now);
  const [from, to] = monthRange(d.getFullYear(), d.getMonth());
  const s = sumRange(state, from, to);

  if (state.txs.length === 0) {
    return "Hi! Tell me what you spent, like “lunch 180”, and I’ll keep count for you.";
  }

  const budgets = budgetList(state, now).sort((x, y) => y.pct - x.pct);
  const over = budgets.find((x) => x.pct > 100);
  if (over) {
    return `You’re ${fmt(-over.left)} over your ${over.period === "monthly" ? "" : periodInfo(over.period).label.toLowerCase() + " "}${over.cat} budget. Let’s ease up there.`;
  }
  const close = budgets.find((x) => x.pct >= 80);
  if (close) {
    return `Heads up: ${close.cat} is at ${Math.round(close.pct)}% of its budget ${periodInfo(close.period).this}.`;
  }

  const f = forecast(state, now);
  if (state.planned.length && f.projected < 0) {
    return `At this pace you might run short by ${fmt(-f.projected)} before payday. Try to keep it under ${fmt(f.safeDaily)} a day.`;
  }

  const st = streak(state.txs, now);
  if (st.count >= 3 && !st.loggedToday) {
    return `You’re on a ${st.count}-day streak. Log something today to keep it going!`;
  }

  const top = Object.entries(s.cats).sort((a, b) => b[1] - a[1])[0];
  if (top && s.expense > 0) {
    const pct = Math.round((top[1] / s.expense) * 100);
    return `${top[0]} is ${pct}% of your spending this month (${fmt(top[1])}).`;
  }
  if (s.income > s.expense) {
    return `Nice! You’ve brought in ${fmt(s.income - s.expense)} more than you spent this month.`;
  }
  return "Steady month so far. Keep logging and I’ll spot the patterns.";
}

export function greeting(now = Date.now()) {
  const h = new Date(now).getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
