"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { catColor, catEmoji, catNames } from "@/lib/categories";
import type { Ctx } from "@/lib/ui";
import type { Tx, TxType } from "@/lib/types";
import { accountName, fmtIn } from "@/lib/format";
import { previewEffect } from "@/lib/preview";
import { accCurrency, activeAccounts, balanceAfterSpend, baseCurrency } from "@/lib/stats";
import { convert, defaultFx, getCurrency } from "@/lib/currency";
import MoneyInput from "./MoneyInput";
import ReceiptPhoto from "./ReceiptPhoto";
import { compressImage, savePhoto } from "@/lib/photos";
import { prepareForOcr, readReceiptText } from "@/lib/ocr";
import { parseReceipt } from "@/lib/receipt";
import Sheet, { Modal } from "./Sheet";
import Icon from "./Icon";
import BankLogo from "./BankLogo";
import type { Account } from "@/lib/types";
import Emoji from "./Emoji";
import SplitFields, { PeopleList, useSplitState } from "./SplitFields";
import { equalShares } from "@/lib/debts";
import { fmt } from "@/lib/format";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

const toLocalInput = (ts: number) => {
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/** Keypad entry screen. With `edit`, it opens an existing entry so it can be corrected or deleted. */
export default function AddTx({ ctx, initialType = "expense", edit, autoScan, initialAcc }: { ctx: Ctx; initialType?: TxType; edit?: Tx; autoScan?: boolean; initialAcc?: string }) {
  const { k, toast, close } = ctx;
  const { state } = k;
  const [type, setType] = useState<TxType>(edit?.type ?? initialType);
  const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
  const [note, setNote] = useState(edit?.note ?? "");
  const [cat, setCat] = useState(edit && edit.type === "expense" ? edit.cat : "Food");
  // Opened from an account's own screen: start with that account (it must still exist).
  const startAcc = initialAcc && state.accounts.some((a) => a.id === initialAcc) ? initialAcc : state.defAcc;
  const [acc, setAcc] = useState(edit?.acc ?? startAcc);
  const [to, setTo] = useState(edit?.to ?? state.accounts.find((a) => a.id !== startAcc && !a.archived)?.id ?? startAcc);
  const [date, setDate] = useState(toLocalInput(edit?.date ?? Date.now()));
  const [armed, setArmed] = useState(false);
  const [track, setTrack] = useState(!!edit?.track);
  const [split, setSplit] = useState(false);
  const [catSheet, setCatSheet] = useState(false);
  const [padOpen, setPadOpen] = useState(true);
  const [fee, setFee] = useState("");
  // Split where someone else paid: who, how many people, and (optionally) your share if it isn't equal.
  const [payer, setPayer] = useState<"me" | "other">("me");
  const [payerName, setPayerName] = useState("");
  const [headcount, setHeadcount] = useState("2");
  const [shareText, setShareText] = useState("");
  const [photo, setPhoto] = useState<string | undefined>(edit?.photo);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  // Scan a receipt: keep the photo, read its text on the phone, and pre-fill the entry for review.
  const scanRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState<{ p: number; step: string } | null>(null);
  const [scanned, setScanned] = useState(false);

  async function scanReceipt(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScan({ p: 0, step: "Getting ready" });
    try {
      const [saved, ocrImage] = await Promise.all([compressImage(file).then((b) => savePhoto(b, k.ensurePhotoKey())), prepareForOcr(file)]);
      setPhoto(saved);
      const text = await readReceiptText(ocrImage, (p, step) => setScan({ p, step }));
      const r = parseReceipt(text, Date.now(), state.customCats ?? []);
      if (type === "transfer") setType("expense");
      if (r.amount) setAmount(String(r.amount));
      if (r.merchant && !note.trim()) setNote(r.merchant);
      if (r.cat) setCat(r.cat);
      if (r.date) setDate(toLocalInput(r.date));
      setScanned(true);
      // Bring the picked category chip into view.
      setTimeout(() => document.querySelector(".chips.scroll .chip[aria-pressed='true']")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 50);
      toast(
        r.amount
          ? `Found ${fmtIn(r.amount, cur)}${r.merchant ? ` at ${r.merchant}` : ""}. Please check before saving.`
          : "Couldn’t find the total. The photo is attached; type the amount.",
      );
    } catch (err) {
      toast(err instanceof Error && err.message ? `Scan failed: ${err.message}` : "Couldn’t scan that photo. Try again with better light.");
    }
    setScan(null);
  }

  // Opened from Home's "Scan" quick action: go straight to the camera.
  useEffect(() => {
    if (autoScan) scanRef.current?.click();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function attachPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      const blob = await compressImage(file);
      setPhoto(await savePhoto(blob, k.ensurePhotoKey()));
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t add that photo.");
    }
    setPhotoBusy(false);
  }
  // Entries made by an installment plan are better fixed from the installment itself.
  const fromInstallment = edit ? (state.installments ?? []).find((p) => p.txIds && (p.txIds.principal === edit.id || p.txIds.fee === edit.id || p.txIds.interest.includes(edit.id))) : undefined;

  const recentCats = useMemo(() => {
    const out: string[] = [];
    for (const t of [...state.txs].sort((a, b) => b.date - a.date)) {
      if (t.type !== "expense" || ["Debt", "Adjustment", "Interest"].includes(t.cat) || out.includes(t.cat)) continue;
      out.push(t.cat);
      if (out.length >= 5) break;
    }
    return out;
  }, [state.txs]);
  // Recent unique entries of this type, for one-tap repeats.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Tx[] = [];
    for (const t of [...state.txs].sort((a, b) => b.date - a.date)) {
      // Skip debt movements (lending, paying back): they aren't everyday entries to repeat.
      if (t.type !== type || t.cat === "Debt" || t.cat === "Adjustment" || t.cat === "Interest" || seen.has(t.note + t.acc + (t.to ?? ""))) continue;
      seen.add(t.note + t.acc + (t.to ?? ""));
      out.push(t);
      if (out.length >= 6) break;
    }
    return out;
  }, [state.txs, type]);

  function press(key: string) {
    setAmount((a) => {
      if (key === "⌫") return a.slice(0, -1);
      if (key === "." && a.includes(".")) return a;
      if (/\.\d\d$/.test(a)) return a;
      if (a === "0" && key !== ".") return key;
      if (a.replace(".", "").length >= 9) return a;
      return (a || (key === "." ? "0" : "")) + key;
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      if (/^[0-9.]$/.test(e.key)) press(e.key);
      if (e.key === "Backspace") press("⌫");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value = parseFloat(amount) || 0;
  const cur = accCurrency(state, acc);
  const toCur = accCurrency(state, to);
  const crossCurrency = type === "transfer" && cur !== toCur;
  // What arrives in the other currency; prefilled at today's rate, editable to match your bank.
  const [received, setReceived] = useState(edit?.toAmount !== undefined ? String(edit.toAmount) : "");
  const [receivedEdited, setReceivedEdited] = useState(edit?.toAmount !== undefined);
  const suggested = Math.round(convert(value, cur, toCur, state.fx ?? defaultFx()) * 100) / 100;
  const receivedValue = receivedEdited ? parseFloat(received) || 0 : suggested;
  // "Split this": only for a new expense that really leaves your account, paid by you.
  const splitting = split && type === "expense" && !edit && !track;
  const sp = useSplitState(ctx, value);
  const owedMode = splitting && payer === "other";
  const people = Math.max(2, Math.min(30, parseInt(headcount) || 2));
  const equalMine = equalShares(value, people - 1, true).mine;
  const owedShare = owedMode ? (shareText !== "" ? parseFloat(shareText) || 0 : equalMine) : 0;
  const splitOk = owedMode ? payerName.trim().length > 0 && owedShare > 0 && owedShare <= value : sp.ready;
  const canSave = value > 0 && (type !== "transfer" || acc !== to) && (!crossCurrency || receivedValue > 0) && (!splitting || splitOk);

  function save() {
    if (!canSave) return;
    // New entries get the current time; edited ones keep their original time of day.
    const clock = new Date(edit?.date ?? Date.now());
    const [y, m, d] = date.split("-").map(Number);
    const when = new Date(y, m - 1, d, clock.getHours(), clock.getMinutes()).getTime();
    if (edit) {
      const prev = edit;
      k.updateTx({
        id: edit.id,
        type,
        amount: value,
        cat: type === "income" ? "Income" : type === "transfer" ? "Transfer" : cat,
        note: note.trim() || (type === "income" ? "Income" : type === "transfer" ? "Transfer" : cat),
        acc,
        to: type === "transfer" ? to : undefined,
        toAmount: crossCurrency ? receivedValue : undefined,
        photo,
        track: type !== "transfer" && track ? true : undefined,
        date: when,
      });
      // Changing an expense's category teaches Kwenta: typing this payee again files it under the new one.
      let learned = "";
      if (type === "expense" && cat !== prev.cat && prev.type === "expense" && note.trim()) {
        const key = note.trim().toLowerCase();
        const mapped = { ...state.settings.payeeCats, [key]: cat };
        const keep = Object.entries(mapped).slice(-200); // newest 200 corrections
        k.updateSettings({ payeeCats: Object.fromEntries(keep) });
        learned = ` · ${note.trim()} → ${cat} from now on`;
      }
      toast(`Saved changes · ${fmtIn(value, cur)}${learned}`, () => k.updateTx(prev));
      close();
      return;
    }
    if (owedMode) {
      const title = note.trim() || cat;
      const r = k.addOwedShare({ title, total: value, myShare: owedShare, cat, acc, payer: payerName, date: when, photo });
      toast(`Your share ${fmt(owedShare)} logged · you owe ${payerName.trim()}`, () => {
        k.removeTx(r.txId);
        k.removeDebt(r.debtId);
      });
      close();
      return;
    }
    if (splitting) {
      const title = note.trim() || cat;
      const id = k.addSplit({ title, total: value, myShare: sp.myShare, cat, acc, date: when, photo, people: sp.shares.filter((p) => p.share > 0) }, true);
      toast(`Split ${fmtIn(value, cur)} · your share ${fmt(sp.myShare)} · ${sp.names.length} owe you ${fmt(sp.friendsTotal)}`, () => k.undoSplit(id));
      close();
      return;
    }
    const tx = k.addTx({
      type,
      amount: value,
      cat: type === "income" ? "Income" : type === "transfer" ? "Transfer" : cat,
      note: note.trim() || (type === "income" ? "Income" : type === "transfer" ? "Transfer" : cat),
      acc,
      to: type === "transfer" ? to : undefined,
      toAmount: crossCurrency ? receivedValue : undefined,
      photo,
      track: type !== "transfer" && track ? true : undefined,
      date: when,
    });
    const feeValue = type === "transfer" ? parseFloat(fee) || 0 : 0;
    const feeTx = feeValue > 0 ? k.addTx({ type: "expense", amount: feeValue, cat: "Fees", note: "Transfer fee", acc, date: when }) : undefined;
    toast(
      type === "transfer"
        ? `Moved ${fmtIn(value, cur)} from ${accountName(state.accounts, acc)} to ${accountName(state.accounts, to)}${feeTx ? ` · fee ${fmtIn(feeValue, cur)}` : ""}`
        : `Saved ${fmtIn(value, cur)}${type === "expense" ? ` · ${tx.cat}` : ""}`,
      () => {
        k.removeTx(tx.id);
        if (feeTx) k.removeTx(feeTx.id);
      },
    );
    close();
  }

  // Spending more than an account has is allowed (it may just not be logged yet), but worth a heads-up.
  const fromAcct = state.accounts.find((a) => a.id === acc);
  const feeValue = type === "transfer" && !edit ? Math.max(0, parseFloat(fee) || 0) : 0;
  const overdrawn =
    !(split && payer === "other") && type !== "income" && value > 0 && !(type !== "transfer" && track) && fromAcct && fromAcct.kind !== "credit" && fromAcct.kind !== "locked"
      ? (() => {
          const after = balanceAfterSpend(state, fromAcct, value + (type === "transfer" && !edit ? feeValue : 0), edit);
          return after < 0 ? { name: fromAcct.name, after, cur: fromAcct.currency || baseCurrency(state) } : null;
        })()
      : null;

  // Show exactly what saving will do: each account touched, before → after.
  const preview = previewEffect(state, { type, amount: value, acc, to: type === "transfer" ? to : undefined, toAmount: crossCurrency ? receivedValue : undefined, track, fee: feeValue }, edit);

  const title = edit ? "Edit entry" : type === "expense" ? "New expense" : type === "income" ? "New income" : "Transfer";

  if (state.accounts.length === 0) {
    return (
      <Sheet title="Add an account first" onClose={close}>
        <div className="card noaccounts">
          <div className="noacc-ico">
            <Icon name="wallet" size={30} />
          </div>
          <h3>Where does the money come from?</h3>
          <p className="sub">Add at least one account (Cash, GCash, your bank…) so Kwenta knows where each entry goes.</p>
          <button className="btn" onClick={() => ctx.goTab("wallet")}>
            Go to Wallet
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={title} onClose={close} className="addsheet">
      <div className="seg" role="tablist">
        {(["expense", "income", "transfer"] as TxType[]).map((t) => (
          <button key={t} role="tab" aria-selected={type === t} onClick={() => setType(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className={`amountdisplay ${type}`} aria-live="polite">
        <span>{getCurrency(cur).symbol.trim()}</span>
        {amount ? Number(amount).toLocaleString("en-PH", { maximumFractionDigits: 2 }) + (amount.endsWith(".") ? "." : "") : "0"}
      </div>

      {type === "transfer" && (
        <div className="xfersum" role="status" aria-live="polite" aria-label={`From ${accountName(state.accounts, acc)} to ${accountName(state.accounts, to)}`}>
          <span>
            <small>From</small>
            <BankLogo account={state.accounts.find((a) => a.id === acc)} size={24} />
            <b>{accountName(state.accounts, acc)}</b>
          </span>
          <Icon name="send" size={18} />
          <span>
            <small>To</small>
            <BankLogo account={state.accounts.find((a) => a.id === to)} size={24} />
            <b>{accountName(state.accounts, to)}</b>
          </span>
        </div>
      )}

      <div className="noterow">
        <input className="noteinput" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. lunch, grab ride" aria-label="Note" />
        {!scan && !photo && (
          <>
            <button type="button" className="notebtn scan" onClick={() => scanRef.current?.click()} aria-label="Scan receipt" title="Scan receipt">
              <Emoji e="📷" />
            </button>
            <button type="button" className="notebtn" onClick={() => photoRef.current?.click()} disabled={photoBusy} aria-label={photoBusy ? "Saving photo" : "Attach photo"} title="Attach photo">
              {photoBusy ? <Emoji e="⏳" /> : <Emoji e="📎" />}
            </button>
          </>
        )}
      </div>

      {scan ? (
        <div className="scanning" role="status" aria-live="polite">
          <span><Emoji e="📷" /> {scan.step}…</span>
          <div className="bar">
            <i style={{ width: `${Math.max(6, Math.round(scan.p * 100))}%`, background: "var(--accent)" }} />
          </div>
        </div>
      ) : photo ? (
        <ReceiptPhoto id={photo} keyB64={state.photoKey} onRemove={() => setPhoto(undefined)} />
      ) : null}
      {scanned && !scan && <p className="hint editnote"><Emoji e="✅" /> Filled in from the receipt. Check the amount, store, category and date, then save.</p>}
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => void attachPhoto(e)} />
      <input ref={scanRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void scanReceipt(e)} />

      {fromInstallment && (
        <p className="hint editnote">
          This entry comes from the installment “{fromInstallment.name}”. To fix the amount for every month, edit it in Plan → Installments instead.
        </p>
      )}

      {!edit && recent.length > 0 && (
        <>
          <div className="eyebrow addlabel">
            Recent
          </div>
          <div className="chips scroll">
            {recent.map((t) => (
              <button
                key={t.id}
                className="recentchip"
                onClick={() => {
                  setAmount(String(t.amount));
                  setNote(t.note);
                  setCat(t.cat);
                  setAcc(t.acc);
                  if (t.to) setTo(t.to);
                }}
              >
                <small>{t.type === "transfer" && t.to ? `${accountName(state.accounts, t.acc)} → ${accountName(state.accounts, t.to)}` : accountName(state.accounts, t.acc)}</small>
                <b className="num">{fmtIn(t.amount, accCurrency(state, t.acc))}</b>
                <span>{t.note}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {type === "expense" && (
        <>
          <div className="eyebrow addlabel">
            Category
          </div>
          <div className="chips scroll">
            {catNames().map((c) => (
              <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
                <Emoji e={catEmoji(c)} /> {c}
              </button>
            ))}
            <button className="chip catall" onClick={() => setCatSheet(true)} aria-label="All categories, with search">
              <Icon name="search" size={16} /> All
            </button>
          </div>
        </>
      )}
      {catSheet && (
        <CategoryPicker
          value={cat}
          recents={recentCats}
          onPick={(c) => {
            setCat(c);
            setCatSheet(false);
          }}
          onClose={() => setCatSheet(false)}
        />
      )}

      <div className="eyebrow addlabel">
        {type === "transfer" ? "From" : type === "income" ? "Into" : "Paid with"}
      </div>
      <AccountChips accounts={activeAccounts(state, [acc])} value={acc} onChange={setAcc} />
      {type === "transfer" && fromAcct?.kind === "credit" && (
        <p className="warnt" role="status" style={{ margin: "8px 2px 0", fontSize: "0.86rem", fontWeight: 700 }}>
          Moving money out of a credit card is a cash advance. Banks usually charge a fee and start interest right away, so check your card’s terms first.
        </p>
      )}
      {overdrawn && (
        <p className="warnt" role="status" style={{ margin: "8px 2px 0", fontSize: "0.86rem", fontWeight: 700 }}>
          This would take {overdrawn.name} to {fmtIn(overdrawn.after, overdrawn.cur)}. Check you picked the right account, or add money to it first.
        </p>
      )}
      {type === "expense" && !edit && !track && (
        <label className="check" style={{ marginTop: 10 }}>
          <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} />
          <span>Split this with friends: only your share counts as your spending</span>
        </label>
      )}
      {splitting && (
        <div className="form" style={{ padding: "8px 0 0" }}>
          <div className="seg" role="tablist" aria-label="Who paid?">
            <button type="button" role="tab" aria-selected={payer === "me"} onClick={() => setPayer("me")}>
              I paid
            </button>
            <button type="button" role="tab" aria-selected={payer === "other"} onClick={() => setPayer("other")}>
              Someone else paid
            </button>
          </div>
          {owedMode && (
            <>
              <label>
                Who paid?
                <input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="e.g. Migs" list="kwenta-people" maxLength={40} />
              </label>
              <PeopleList ctx={ctx} />
              <div className="formrow">
                <label>
                  People splitting it
                  <input type="number" inputMode="numeric" min={2} max={30} value={headcount} onChange={(e) => (setHeadcount(e.target.value), setShareText(""))} />
                </label>
                <label>
                  Your share
                  <MoneyInput value={shareText !== "" ? shareText : value > 0 ? String(equalMine) : ""} onChange={setShareText} placeholder="0" currency={cur} />
                </label>
              </div>
              {owedShare > value && <p className="warnt">Your share can’t be more than the bill.</p>}
              {payerName.trim() && owedShare > 0 && owedShare <= value && (
                <p className="hint">
                  {fmt(owedShare)} counts as your {cat} spending today. No money leaves your accounts now; you owe {payerName.trim()} {fmt(owedShare)} until you pay them back (Plan → Debts).
                </p>
              )}
            </>
          )}
          {!owedMode && <SplitFields s={sp} />}
          {!owedMode && sp.ready && (
            <p className="hint">
              {fmtIn(value, cur)} leaves {accountName(state.accounts, acc)}. {sp.includeMe ? `${fmt(sp.myShare)} is yours (${cat}); ` : ""}
              {fmt(sp.friendsTotal)} becomes “owes you” until they pay.
            </p>
          )}
        </div>
      )}
      {type !== "transfer" && (
        <details className="moreopts" open={track}>
          <summary>More options</summary>
          <label className="check">
            <input type="checkbox" checked={track} onChange={(e) => setTrack(e.target.checked)} />
            <span>Record only (don’t change the balance): keeps this account on the entry for reference</span>
          </label>
        </details>
      )}
      {type === "transfer" && (
        <>
          <div className="eyebrow addlabel">
            To
          </div>
          <AccountChips accounts={activeAccounts(state, [to]).filter((a) => a.id !== acc)} value={to} onChange={setTo} />
          {!edit && (
            <label className="received">
              <span>
                Fee <small>(optional: InstaPay, PESONet, cash-in…)</small>
              </span>
              <MoneyInput value={fee} onChange={setFee} placeholder="0" currency={cur} />
              {parseFloat(fee) > 0 && <small className="hint">Saved as a separate “Fees” expense from {accountName(state.accounts, acc)}.</small>}
            </label>
          )}
          {crossCurrency && (
            <label className="received">
              <span>
                Amount received in {toCur} <small>(1 {cur} ≈ {fmtIn(convert(1, cur, toCur, state.fx ?? defaultFx()), toCur, true)})</small>
              </span>
              <MoneyInput
                currency={toCur}
                value={receivedEdited ? received : value ? suggested.toFixed(getCurrency(toCur).decimals) : ""}
                onChange={(raw) => {
                  setReceived(raw);
                  setReceivedEdited(true);
                }}
                placeholder="0"
              />
            </label>
          )}
        </>
      )}

      {preview.length > 0 && !owedMode && (
        <div className="card" role="status" aria-label="What this will change" style={{ margin: "10px 0 0", padding: "8px 12px" }}>
          {preview.map((l) => {
            const c = l.acc.currency || baseCurrency(state);
            const cardAcc = l.acc.kind === "credit";
            return (
              <div key={l.acc.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: "0.86rem", padding: "3px 0" }}>
                <span>
                  {l.dir === "out" ? "From" : "Into"} <b>{l.acc.name}</b>
                  {cardAcc ? " (owed)" : ""}
                </span>
                <span className={!cardAcc && l.after < 0 ? "warnt" : undefined}>
                  {fmtIn(l.before, c)} → <b>{fmtIn(l.after, c)}</b>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="eyebrow addlabel">Date</div>
      <div className="datechips" role="group" aria-label="Quick dates">
        <button type="button" className="chip" aria-pressed={date === toLocalInput(Date.now())} onClick={() => setDate(toLocalInput(Date.now()))}>
          Today
        </button>
        <button type="button" className="chip" aria-pressed={date === toLocalInput(Date.now() - 86_400_000)} onClick={() => setDate(toLocalInput(Date.now() - 86_400_000))}>
          Yesterday
        </button>
      </div>
      <label className="dateline">
        <span className="eyebrow">Other date</span>
        <input type="date" value={date} max={toLocalInput(Date.now())} onChange={(e) => e.target.value && setDate(e.target.value)} />
      </label>

      {/* Keypad and Save stay pinned to the bottom so you never scroll to save. */}
      <div className="adddock">
        <button type="button" className="padtoggle" onClick={() => setPadOpen((v) => !v)} aria-expanded={padOpen}>
          <Icon name={padOpen ? "down" : "up"} size={16} /> {padOpen ? "Hide keypad for more room" : "Show keypad"}
        </button>
        {padOpen && (
        <div className="keypad">
          {KEYS.map((key) => (
            <button key={key} onClick={() => press(key)} aria-label={key === "⌫" ? "Delete digit" : key}>
              {key}
            </button>
          ))}
        </div>
        )}
        <button className="btn wide big" onClick={save} disabled={!canSave}>
          <Icon name="check" size={20} /> {edit ? "Save changes" : owedMode ? "Save my share" : splitting ? "Save & split" : `Save ${type}`}
        </button>
      </div>
      {edit && (
        <button
          className={`btn wide ${armed ? "danger" : "ghost"}`}
          style={{ marginTop: 10 }}
          onClick={() => {
            if (!armed) return setArmed(true);
            const gone = edit;
            k.removeTx(edit.id);
            toast(`Deleted ${fmtIn(edit.amount, cur)}`, () => k.restoreTx(gone));
            close();
          }}
        >
          {armed ? "Tap again to delete this entry" : "Delete entry"}
        </button>
      )}
    </Sheet>
  );
}

function AccountChips({ accounts, value, onChange }: { accounts: Account[]; value: string; onChange: (id: string) => void }) {
  const row = useRef<HTMLDivElement>(null);
  // Keep the selected account in view, e.g. when opened from an account's own screen.
  useEffect(() => {
    const el = row.current?.querySelector<HTMLElement>('[aria-checked="true"]');
    const box = row.current;
    if (!el || !box) return;
    const left = el.offsetLeft - box.offsetLeft - 12;
    if (left > 0 && (el.offsetLeft + el.offsetWidth > box.scrollLeft + box.clientWidth || left < box.scrollLeft)) box.scrollTo({ left, behavior: "smooth" });
  }, [value]);
  return (
    <div className="accchips" role="radiogroup" ref={row}>
      {accounts.map((a) => (
        <button key={a.id} type="button" className="accchip" role="radio" aria-checked={value === a.id} aria-pressed={value === a.id} onClick={() => onChange(a.id)}>
          <BankLogo account={a} size={28} />
          {a.name}
        </button>
      ))}
    </div>
  );
}

/** Every category with search, and the ones you used most recently first. */
function CategoryPicker({ value, recents, onPick, onClose }: { value: string; recents: string[]; onPick: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const all = catNames().filter((n) => n.toLowerCase().includes(q.trim().toLowerCase()));
  const chip = (c: string) => (
    <button key={c} type="button" className="chip" aria-pressed={value === c} onClick={() => onPick(c)}>
      <Emoji e={catEmoji(c)} /> {c}
    </button>
  );
  return (
    <Modal title="Category" onClose={onClose}>
      <div className="form">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search categories" aria-label="Search categories" autoFocus />
        {!q && recents.length > 0 && (
          <>
            <div className="eyebrow">Recent</div>
            <div className="chips wrap">{recents.map(chip)}</div>
          </>
        )}
        <div className="eyebrow">{q ? "Matches" : "All categories"}</div>
        <div className="chips wrap">{all.map(chip)}</div>
        {all.length === 0 && <p className="sub">No match. You can make your own in Plan → Budgets → Categories.</p>}
      </div>
    </Modal>
  );
}
