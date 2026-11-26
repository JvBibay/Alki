"use client";

import { useCallback, useEffect, useState } from "react";
import { adminState, attachmentUrl, filterFeedback, grantPlan, groupByKind, listFeedback, revokePlan, updateFeedback, type AdminFeedback, type AdminState, type Filter, type KindFilter } from "@/lib/admin";
import Mascot from "./Mascot";
import Icon from "./Icon";

const KIND = { idea: "💡 Idea", problem: "🐞 Problem", praise: "💚 Praise" } as const;
const SECTION = {
  problem: { title: "🐞 Problems", sub: "Things that went wrong. Fix these first." },
  idea: { title: "💡 Ideas", sub: "Suggestions to make Kwenta better." },
  praise: { title: "💚 Praise", sub: "Kind words. Approve the ones you want on /love." },
} as const;
const RATING = ["", "😕 Not great", "🙂 It’s okay", "😍 Love it"];
const when = (iso: string) => new Date(iso).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" });

/** The screenshot sent with a piece of feedback. Loads it only when opened, since it's a private file. */
function Attachment({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  async function open() {
    setState("loading");
    try {
      setUrl(await attachmentUrl(path));
      setState("idle");
    } catch {
      setState("error");
    }
  }
  if (!url) {
    return (
      <button className="chip" onClick={() => void open()} disabled={state === "loading"}>
        📎 {state === "loading" ? "Loading…" : state === "error" ? "Couldn’t open, retry" : "View screenshot"}
      </button>
    );
  }
  return (
    <a className="adm-shot" href={url} target="_blank" rel="noreferrer" aria-label="Open the screenshot full size">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Screenshot sent with this feedback" />
    </a>
  );
}

/** Feedback admin: read, mark and approve. The database only answers accounts listed in `admins`. */
/** Activate or remove someone's plan after you have confirmed their GCash / bank payment. */
function PlanTools() {
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState<"monthly" | "annual" | "lifetime">("monthly");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function run(kind: "grant" | "revoke") {
    if (!email.trim()) return setMsg("Type the account email first.");
    const q = kind === "revoke" ? `Remove the plan from ${email.trim()}?` : `Activate the ${plan} plan for ${email.trim()}? Only do this after you have seen the payment arrive.`;
    if (!window.confirm(q)) return;
    setBusy(true);
    setMsg("");
    try {
      if (kind === "grant") {
        const until = await grantPlan(email, plan);
        setMsg(until ? `Done. ${plan} plan active until ${new Date(until).toLocaleDateString()}.` : "Done. Lifetime access activated.");
      } else {
        await revokePlan(email);
        setMsg("Plan removed.");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn’t do that.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="card" style={{ padding: 12, margin: "12px 0" }}>
      <summary style={{ fontWeight: 700, cursor: "pointer" }}>Plans: activate after payment</summary>
      <div className="form" style={{ padding: "10px 0 0" }}>
        <label>
          Account email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@example.com" autoComplete="off" />
        </label>
        <div className="chips" role="group" aria-label="Plan">
          {(["monthly", "annual", "lifetime"] as const).map((p) => (
            <button key={p} type="button" className="chip" aria-pressed={plan === p} onClick={() => setPlan(p)}>
              {p}
            </button>
          ))}
        </div>
        <button className="btn" disabled={busy} onClick={() => void run("grant")}>
          Activate plan
        </button>
        <button className="btn ghost" disabled={busy} onClick={() => void run("revoke")}>
          Remove plan
        </button>
        {msg && <p className="sub" role="status">{msg}</p>}
        <p className="hint">Monthly and annual add time on top of what they already have. Lifetime never ends.</p>
      </div>
    </details>
  );
}

export default function Admin() {
  const [gate, setGate] = useState<AdminState>("loading");
  const [list, setList] = useState<AdminFeedback[]>([]);
  const [filter, setFilter] = useState<Filter>("new");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr("");
    try {
      setList(await listFeedback());
    } catch {
      setErr("Couldn’t load feedback. Check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void adminState().then((g) => {
      if (!alive) return;
      setGate(g);
      if (g === "ok") void load();
    });
    return () => {
      alive = false;
    };
  }, [load]);

  async function change(f: AdminFeedback, patch: Partial<Pick<AdminFeedback, "status" | "approved">>) {
    setBusy(f.id);
    setErr("");
    try {
      await updateFeedback(f.id, patch);
      setList((l) => l.map((x) => (x.id === f.id ? { ...x, ...patch } : x)));
    } catch {
      setErr("That change didn’t save. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (gate !== "ok") {
    const text =
      gate === "loading"
        ? "Checking…"
        : gate === "signed-out"
          ? "Sign in to Kwenta on this device first, then come back to this page."
          : gate === "denied"
            ? "This page is only for Kwenta admins."
            : "Couldn’t check your access. Please try again.";
    return (
      <main className="adm">
        <div className="love-hero">
          <Mascot size={96} face={gate === "denied" ? "thinking" : "happy"} />
          <h1>Feedback admin</h1>
          <p>{text}</p>
          <a className="btn" href="/">
            Open Kwenta
          </a>
        </div>
      </main>
    );
  }

  const counts: Record<Filter, number> = {
    new: list.filter((x) => x.status === "new").length,
    public: list.filter((x) => x.public_ok && !x.approved).length,
    done: list.filter((x) => x.status === "done").length,
    all: list.length,
  };
  const byStatus = filterFeedback(list, filter);
  const kindCounts: Record<KindFilter, number> = {
    all: byStatus.length,
    problem: byStatus.filter((x) => x.kind === "problem").length,
    idea: byStatus.filter((x) => x.kind === "idea").length,
    praise: byStatus.filter((x) => x.kind === "praise").length,
  };
  const shown = kindFilter === "all" ? byStatus : byStatus.filter((x) => x.kind === kindFilter);
  const groups = groupByKind(shown);
  const KINDS: { id: KindFilter; label: string }[] = [
    { id: "all", label: "All types" },
    { id: "problem", label: "🐞 Problems" },
    { id: "idea", label: "💡 Ideas" },
    { id: "praise", label: "💚 Praise" },
  ];
  const TABS: { id: Filter; label: string }[] = [
    { id: "new", label: "New" },
    { id: "public", label: "Wants public" },
    { id: "done", label: "Done" },
    { id: "all", label: "All" },
  ];

  return (
    <main className="adm">
      <header className="love-top">
        <a className="love-brand" href="/" aria-label="Open Kwenta">
          <Icon name="back" size={18} /> Kwenta
        </a>
        <button className="chip" onClick={() => void load()}>
          Refresh
        </button>
      </header>
      <PlanTools />
      <h1 className="adm-h">Feedback</h1>

      <div className="chips" role="tablist" aria-label="Filter">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={filter === t.id} aria-pressed={filter === t.id} className="chip" onClick={() => setFilter(t.id)}>
            {t.label} · {counts[t.id]}
          </button>
        ))}
      </div>

      <div className="chips adm-kinds" role="tablist" aria-label="Type">
        {KINDS.map((t) => (
          <button key={t.id} role="tab" aria-selected={kindFilter === t.id} aria-pressed={kindFilter === t.id} className="chip" onClick={() => setKindFilter(t.id)}>
            {t.label} · {kindCounts[t.id]}
          </button>
        ))}
      </div>

      {err && (
        <p className="warnt" role="alert">
          {err}
        </p>
      )}
      {shown.length === 0 && !err && <p className="love-empty">Nothing here.</p>}

      {groups.map((g) => (
        <section key={g.kind} className="adm-sec" aria-label={SECTION[g.kind].title}>
          <div className="adm-sechead">
            <h2>
              {SECTION[g.kind].title} <span className="adm-count">{g.items.length}</span>
            </h2>
            <p>{SECTION[g.kind].sub}</p>
          </div>
      {g.items.map((f) => (
        <article className={`card adm-item${f.status === "new" ? " isnew" : ""}`} key={f.id}>
          <div className="adm-meta">
            <b>{KIND[f.kind]}</b>
            {f.rating ? <span>{RATING[f.rating]}</span> : null}
            <span>{when(f.created_at)}</span>
            {f.screen && <span>from {f.screen}</span>}
          </div>
          <p className="adm-msg">{f.message}</p>
          {f.attachment && <Attachment path={f.attachment} />}
          <div className="adm-meta">
            <span>{f.display_name ? `Name: ${f.display_name}` : "No name"}</span>
            {f.contact_ok ? (
              f.email ? (
                <a className="link" href={`mailto:${f.email}?subject=${encodeURIComponent("About your Kwenta feedback")}`}>
                  Reply to {f.email}
                </a>
              ) : (
                <span>OK to contact (no email found)</span>
              )
            ) : (
              <span>Don’t contact</span>
            )}
            {f.public_ok ? <span className="adm-tag">Allowed public</span> : null}
            {f.approved ? <span className="adm-tag on">Live on /love</span> : null}
          </div>
          <div className="adm-actions">
            {f.status !== "seen" && f.status !== "done" && (
              <button className="chip" disabled={busy === f.id} onClick={() => void change(f, { status: "seen" })}>
                Mark seen
              </button>
            )}
            {f.status !== "done" ? (
              <button className="chip" disabled={busy === f.id} onClick={() => void change(f, { status: "done" })}>
                Done
              </button>
            ) : (
              <button className="chip" disabled={busy === f.id} onClick={() => void change(f, { status: "new" })}>
                Reopen
              </button>
            )}
            {f.public_ok &&
              (f.approved ? (
                <button className="chip" disabled={busy === f.id} onClick={() => void change(f, { approved: false })}>
                  Take down
                </button>
              ) : (
                <button className="chip on" disabled={busy === f.id} onClick={() => void change(f, { approved: true })}>
                  Approve for /love
                </button>
              ))}
          </div>
        </article>
      ))}
        </section>
      ))}
    </main>
  );
}
