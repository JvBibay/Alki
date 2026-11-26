import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabase } from "./supabase";

/**
 * Plans. FREE: everything on the device, file backups, restoring/deleting an existing cloud backup.
 * PAID: saving to the cloud (backup + auto-sync). Admin accounts are exempt. The real check is in the
 * database (scripts/plans.sql); this file only decides what to show.
 */

export type PlanId = "monthly" | "annual" | "lifetime";

export interface PlanInfo {
  id: PlanId;
  name: string;
  /** In pesos. Change the prices here, in one place. */
  price: number;
  per: string;
  note: string;
}

export const PLANS: PlanInfo[] = [
  { id: "monthly", name: "Monthly", price: 99, per: "/ month", note: "Pay each month, no auto-charge" },
  { id: "annual", name: "Annual", price: 799, per: "/ year", note: "Pay once a year, save about 33%" },
  { id: "lifetime", name: "Lifetime", price: 1999, per: "once", note: "Pay once, keep it forever" },
];

/** The free plan can keep this many accounts. Anyone who already has more keeps them, but can’t add more. */
export const FREE_ACCOUNT_LIMIT = 2;
/** Plan tabs that need a paid plan. Edit this list to change what is free. */
export const PAID_PLAN_TABS = ["installments", "debts"] as const;
/** Whether the Statistics screen needs a paid plan. */
export const STATS_PAID = true;

export const FREE_FEATURES = [
  `Up to ${FREE_ACCOUNT_LIMIT} accounts`,
  "Logging entries, receipts, budgets, goals and cash flow",
  "Reminders and backups to a file",
  "Restore or delete an existing cloud backup",
];
export const PAID_FEATURES = ["Unlimited accounts", "Installments and Debts", "Statistics and charts", "Encrypted cloud backup and auto-sync"];

/**
 * How people pay for now: GCash or bank transfer, then you activate their plan in the admin page.
 * Set these in .env.local / Vercel (they are shown to everyone, so use the number you want people to pay):
 *   NEXT_PUBLIC_PAY_GCASH_NAME, NEXT_PUBLIC_PAY_GCASH_NUMBER, NEXT_PUBLIC_PAY_QR (your QR Ph picture in /public), NEXT_PUBLIC_PAY_CONTACT (an email, or a Messenger/Viber link)
 */
export const PAYMENT = {
  name: process.env.NEXT_PUBLIC_PAY_GCASH_NAME ?? "",
  number: process.env.NEXT_PUBLIC_PAY_GCASH_NUMBER ?? "",
  contact: process.env.NEXT_PUBLIC_PAY_CONTACT ?? "",
  /** Path of your QR Ph picture inside /public, for example "/pay-qr.png". */
  qr: /^\/[\w./-]+\.(png|jpe?g|webp)$/i.test(process.env.NEXT_PUBLIC_PAY_QR ?? "") ? (process.env.NEXT_PUBLIC_PAY_QR as string) : "",
};
export const paymentsOpen = () => (!!PAYMENT.number || !!PAYMENT.qr) && !!PAYMENT.contact;

export interface Access {
  /** False until the first answer arrives. */
  loaded: boolean;
  /** May save to the cloud right now (a paid plan, or an admin). */
  active: boolean;
  plan: PlanId | null;
  /** When a monthly/annual plan ends; null for lifetime or no plan. */
  until: string | null;
  admin: boolean;
  /** In the first 7 days after creating the account: everything is open. `until` is then the trial’s end. */
  trial: boolean;
}

const NONE: Access = { loaded: true, active: false, plan: null, until: null, admin: false, trial: false };

export async function fetchAccess(): Promise<Access> {
  const sb = getSupabase();
  if (!sb) return NONE;
  const { data: s } = await sb.auth.getSession();
  if (!s.session) return NONE;
  const { data, error } = await sb.rpc("my_access");
  // Plans not set up yet (or offline): treat as "no plan" rather than breaking the screen.
  if (error || !Array.isArray(data) || !data[0]) return NONE;
  const r = data[0] as { active: boolean; plan: PlanId | null; until: string | null; is_admin: boolean; trial: boolean };
  return { loaded: true, active: !!r.active, plan: r.plan, until: r.until, admin: !!r.is_admin, trial: !!r.trial };
}

/** The signed-in person's plan, refreshed on sign-in/out. `refresh()` re-checks (after paying, say). */
export function useAccess(): Access & { refresh: () => void } {
  const [access, setAccess] = useState<Access>({ ...NONE, loaded: false });
  const [n, setN] = useState(0);
  const refresh = useCallback(() => setN((x) => x + 1), []);
  useEffect(() => {
    let alive = true;
    void fetchAccess().then(
      (a) => alive && setAccess(a),
      () => alive && setAccess(NONE),
    );
    const sb = getSupabase();
    const sub = sb?.auth.onAuthStateChange((_e, session) => {
      if (!session) setAccess(NONE);
      else
        void fetchAccess().then(
          (a) => alive && setAccess(a),
          () => {},
        );
    });
    return () => {
      alive = false;
      sub?.data.subscription.unsubscribe();
    };
  }, [n]);
  return useMemo(() => ({ ...access, refresh }), [access, refresh]);
}

/** Paid features are open while the answer is still loading (no flash of a lock) and for admins. */
export const hasPaid = (a: Access) => !a.loaded || a.active;

/** May this person add another account? */
export const canAddAccount = (a: Access, count: number) => hasPaid(a) || count < FREE_ACCOUNT_LIMIT;

/** "3 days", or "less than a day". */
export function daysLeft(until: string, now = Date.now()): string {
  const d = Math.ceil((new Date(until).getTime() - now) / 86_400_000);
  return d <= 1 ? "less than a day" : `${d} days`;
}

/** True during the last 2 days of a free trial (and not for admins or paid plans). */
export function trialEndingSoon(a: Access, now = Date.now()): boolean {
  if (!a.trial || a.admin || !a.until) return false;
  const left = new Date(a.until).getTime() - now;
  return left > 0 && left <= 2 * 86_400_000;
}

/** "Lifetime access", "Annual plan until 24 Nov 2027", "Admin account" or "Free plan". */
export function describeAccess(a: Access): string {
  if (a.admin) return "Admin account: cloud backup is always on";
  if (a.trial && a.until) {
    const end = new Date(a.until).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });
    return `Free trial: ${daysLeft(a.until)} left (ends ${end})`;
  }
  if (!a.active) return a.plan ? "Your plan has ended" : "Free plan";
  if (a.plan === "lifetime") return "Lifetime access";
  const name = a.plan === "annual" ? "Annual" : "Monthly";
  return a.until ? `${name} plan until ${new Date(a.until).toLocaleDateString()}` : `${name} plan`;
}
