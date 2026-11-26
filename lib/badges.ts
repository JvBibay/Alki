import type { State } from "./types";
import { streak } from "./stats";

export type BadgeTier = "bronze" | "silver" | "gold";

export interface Badge {
  id: string;
  /** The metal its coin is struck in, from easy (bronze) to hard (gold). */
  tier: BadgeTier;
  name: string;
  icon: string;
  desc: string;
  earned: boolean;
  progress: number; // 0..1
}

const TIER: Record<string, BadgeTier> = {
  first: "bronze", streak3: "bronze", budget: "bronze", goal: "bronze",
  streak7: "silver", tx50: "silver", bills: "silver",
  streak30: "gold", goaldone: "gold",
};

export function badges(state: State, now = Date.now()): Badge[] {
  const st = streak(state.txs, now);
  const n = state.txs.length;
  const goalDone = state.goals.some((g) => g.saved >= g.target);
  const mk = (id: string, name: string, icon: string, desc: string, cur: number, need: number): Badge => ({
    id,
    tier: TIER[id] ?? "bronze",
    name,
    icon,
    desc,
    earned: cur >= need,
    progress: Math.min(1, cur / need),
  });
  return [
    mk("first", "First Coin", "🪙", "Log your first entry", n, 1),
    mk("streak3", "Warming Up", "🔥", "Reach a 3-day streak", st.best, 3),
    mk("streak7", "Week Keeper", "📅", "Reach a 7-day streak", st.best, 7),
    mk("streak30", "Habit Hero", "🏆", "Reach a 30-day streak", st.best, 30),
    mk("tx50", "Record Keeper", "📒", "Log 50 entries", n, 50),
    mk("budget", "Planner", "🧭", "Set a budget", Object.keys(state.budgets).length, 1),
    mk("goal", "Dreamer", "🎯", "Create a savings goal", state.goals.length, 1),
    mk("goaldone", "Goal Getter", "🎉", "Complete a savings goal", goalDone ? 1 : 0, 1),
    mk("bills", "On Schedule", "🗓️", "Add 3 recurring items", state.planned.length, 3),
  ];
}
