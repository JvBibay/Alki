import { useEffect, useState } from "react";
import { getSupabase } from "./supabase";

export interface AdminFeedback {
  id: string;
  kind: "idea" | "problem" | "praise";
  message: string;
  rating: number | null;
  contact_ok: boolean;
  public_ok: boolean;
  display_name: string | null;
  approved: boolean;
  status: "new" | "seen" | "done";
  screen: string | null;
  app_version: string | null;
  created_at: string;
  /** Only present when the sender ticked "OK to contact me". */
  email: string | null;
  /** Path of the optional screenshot in the private bucket. */
  attachment?: string | null;
}

export type AdminState = "loading" | "signed-out" | "denied" | "ok" | "error";

const db = () => {
  const sb = getSupabase();
  if (!sb) throw new Error("Not set up.");
  return sb;
};

/** Where the person stands: not signed in, signed in but not an admin, or an admin. The database decides. */
export async function adminState(): Promise<AdminState> {
  try {
    const sb = db();
    const { data } = await sb.auth.getSession();
    if (!data.session) return "signed-out";
    const { data: mine, error } = await sb.from("admins").select("user_id").limit(1);
    if (error) return "error";
    return mine && mine.length ? "ok" : "denied";
  } catch {
    return "error";
  }
}

export async function listFeedback(): Promise<AdminFeedback[]> {
  const { data, error } = await db().rpc("admin_feedback");
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminFeedback[];
}

/** Downloads an attachment and returns a blob: URL to show it (revoke it when done). Only admins are allowed. */
export async function attachmentUrl(path: string): Promise<string> {
  const { data, error } = await db().storage.from("feedback-files").download(path);
  if (error || !data) throw new Error(error?.message ?? "Couldn’t open the attachment.");
  return URL.createObjectURL(data);
}

/** Change only the review fields. The database refuses anything else. */
export async function updateFeedback(id: string, patch: Partial<Pick<AdminFeedback, "status" | "approved">>) {
  const { data, error } = await db().from("feedback").update(patch).eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error("Nothing was changed.");
}

/** Activates a plan for the account with this email (after you confirm their payment). Returns when it ends, or null for lifetime. */
export async function grantPlan(email: string, plan: "monthly" | "annual" | "lifetime"): Promise<string | null> {
  const { data, error } = await db().rpc("admin_grant_plan", { p_email: email.trim(), p_plan: plan });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export async function revokePlan(email: string): Promise<void> {
  const { error } = await db().rpc("admin_revoke_plan", { p_email: email.trim() });
  if (error) throw new Error(error.message);
}

export type Filter = "new" | "public" | "all" | "done";

export function filterFeedback(list: AdminFeedback[], f: Filter): AdminFeedback[] {
  switch (f) {
    case "new":
      return list.filter((x) => x.status === "new");
    case "public": // asked to be public and not yet approved
      return list.filter((x) => x.public_ok && !x.approved);
    case "done":
      return list.filter((x) => x.status === "done");
    default:
      return list;
  }
}

export type KindFilter = "all" | AdminFeedback["kind"];
const KIND_ORDER: AdminFeedback["kind"][] = ["problem", "idea", "praise"];
const STATUS_ORDER = { new: 0, seen: 1, done: 2 } as const;

/**
 * Splits feedback by type: problems first (they need action), then ideas, then praise. Inside each group
 * the ones nobody has looked at come first, then seen, then done; newest first within the same status.
 */
export function groupByKind(list: AdminFeedback[]): { kind: AdminFeedback["kind"]; items: AdminFeedback[] }[] {
  return KIND_ORDER.map((kind) => ({
    kind,
    items: list
      .filter((x) => x.kind === kind)
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0)),
  })).filter((g) => g.items.length > 0);
}

/** True only for admin accounts. Used just to decide whether to show the link; the database still enforces access. */
export function useIsAdmin(): boolean {
  const [yes, setYes] = useState(false);
  useEffect(() => {
    let alive = true;
    void adminState().then((s) => alive && setYes(s === "ok"));
    return () => {
      alive = false;
    };
  }, []);
  return yes;
}
