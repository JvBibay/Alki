"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { AccKind, Account } from "@/lib/types";
import { CARD_COLORS, KIND_LABEL } from "@/lib/types";
import { balance, balanceBase, baseCurrency, countedAccounts, keptBase, monthlyInstallments, netWorth, netWorthSeries, startOfDay, sumRange, DAY } from "@/lib/stats";
import { FREQS, type InterestFreq } from "@/lib/interest";
import QrCrop from "./QrCrop";
import { cleanNumber } from "@/lib/remindercard";
import { fmt, fmtIn, weekdayFull, weekdayShort } from "@/lib/format";
import { CURRENCIES, getCurrency } from "@/lib/currency";
import { DualBars } from "./Charts";
import { Modal } from "./Sheet";
import Icon from "./Icon";
import BankLogo from "./BankLogo";
import HideButton from "./HideButton";
import { lookOf } from "@/lib/closet";
import { debtTotals } from "@/lib/debts";
import { DepositModal, DepositRow, LockForm } from "./Locked";
import PayCard from "./PayCard";
import { creditInfo, limitHolder } from "@/lib/cards";
import { cardCycle, cycleLabel } from "@/lib/cards";
import { alkiMood } from "@/lib/mood";
import MoneyInput from "./MoneyInput";
import { ALKI_SIZES, LiveAlki } from "./Mascot";
import BandScene from "./BandScene";
import { GROUP_KIND, GROUP_LABEL, INSTITUTIONS, getInst, type InstGroup, type Institution } from "@/lib/institutions";
import Emoji from "./Emoji";
import CardPic from "./CardPic";
import Overview from "./Overview";
import AccountDetail from "./AccountDetail";
import { assertImage } from "@/lib/upload";
import { nameTaken } from "@/lib/names";
import { canAddAccount, FREE_ACCOUNT_LIMIT } from "@/lib/plans";
import Plans from "./Plans";
import { accountCard, cardsFor, getCardArt, type CardArt } from "@/lib/cardart";

type Filter = "all" | "assets" | "credit";
const KINDS: AccKind[] = ["cash", "ewallet", "bank", "credit"];

export default function Wallet({ ctx }: { ctx: Ctx }) {
  const { k, toast } = ctx;
  const { state } = k;
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<Account | "new" | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  /** The free plan allows a couple of accounts; adding more opens the plans instead. */
  const addAccount = () => (canAddAccount(ctx.access, state.accounts.length) ? setEditing("new") : setUpgrade(true));
  /** The account whose detail screen is open (edit stays one tap away inside it). */
  const [detailId, setDetailId] = useState<string | null>(null);
  const view = state.settings.walletView ?? "list";
  const [showArchived, setShowArchived] = useState(false);
  const [locking, setLocking] = useState(false);
  const [deposit, setDeposit] = useState<Account | null>(null);
  const [overview, setOverview] = useState(false);
  // How the weekly chart is drawn; remembered on this device only.
  const [weekMode, setWeekModeState] = useState<"split" | "pair">("split");
  useEffect(() => {
    try {
      if (localStorage.getItem("kwenta-weekchart") === "pair") setWeekModeState("pair");
    } catch {}
  }, []);
  const setWeekMode = (m: "split" | "pair") => {
    setWeekModeState(m);
    try {
      localStorage.setItem("kwenta-weekchart", m);
    } catch {}
  };
  const dt = debtTotals(state);
  const alkiPx = ALKI_SIZES[state.settings.alkiSize ?? "medium"]?.wallet ?? 82;

  const nw = netWorth(state);
  const series = netWorthSeries(state, 7);
  const weekAgo = series[0].value;
  // Income and spending for each of the last 7 days (debts, transfers and adjustments aren't counted).
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const from = startOfDay(Date.now()) - (6 - i) * DAY;
    const s = sumRange(state, from, from + DAY);
    return { label: weekdayShort(from), full: weekdayFull(from), income: s.income, expense: s.expense };
  });
  const weekIn = weekDays.reduce((t, d) => t + d.income, 0);
  const weekOut = weekDays.reduce((t, d) => t + d.expense, 0);
  const change = weekAgo > 0 && nw.net > 0 ? ((nw.net - weekAgo) / weekAgo) * 100 : 0;
  // Spendable money only (no cards, locked savings, archived or hidden accounts).
  const liquid = countedAccounts(state).filter((a) => a.kind !== "credit" && a.kind !== "locked").reduce((s, a) => s + balanceBase(state, a) - keptBase(state, a), 0);

  const archivedCount = state.accounts.filter((a) => a.archived).length;
  const shown = state.accounts
    .filter((a) => showArchived || !a.archived)
    .filter((a) => (filter === "all" ? true : filter === "credit" ? a.kind === "credit" : a.kind !== "credit"));
  const groups = KINDS.map((kind) => ({ kind, items: shown.filter((a) => a.kind === kind) })).filter((g) => g.items.length);
  const locked = filter === "credit" ? [] : shown.filter((a) => a.kind === "locked");
  const lockedTotal = locked.filter((a) => a.deposit?.status === "locked").reduce((s, a) => s + (a.deposit?.principal ?? 0), 0);

  // Card balances only: personal debts (utang) are a separate thing and aren't part of "pay off my cards".
  const cardsOwed = countedAccounts(state).filter((a) => a.kind === "credit").reduce((s, a) => s + Math.max(0, -balanceBase(state, a)), 0);
  const liquidNote =
    liquid < 0
      ? `Your cash and accounts are overdrawn by ${fmt(-liquid)}. Log the income that covers it, or fix an opening balance.`
      : liquid === 0
        ? "Your cash and accounts are empty. Log income or add opening balances."
      : cardsOwed > liquid
        ? "Your card balances are higher than your cash. Try paying them down first."
        : cardsOwed > 0
          ? `You could pay off all card balances and still have ${fmt(liquid - cardsOwed)}.`
          : "No debt on your cards. Nice and steady.";

  // Alki's scene fills the whole header as a landscape (see BandScene).
  const { scene: bandScene, ...bandLook } = lookOf(state.settings);

  return (
    <>
      <header className={`band withalki${bandScene ? " hasscene" : ""}`} style={{ ["--alki-w" as string]: `${alkiPx}px` }}>
        {bandScene && <BandScene id={bandScene} motion={state.settings.alkiMotion !== false} />}
        <LiveAlki
          size={alkiPx}
          look={bandLook}
          motion={state.settings.alkiMotion !== false}
          mood={alkiMood(state)}
          lines={[
            liquidNote,
            `${state.accounts.length} account${state.accounts.length === 1 ? "" : "s"} and counting. I keep them all safe here. 🔒`,
            nw.net > 0 ? `Net worth: ${fmt(nw.net)}. Look at you go! 📈` : "Every journey starts somewhere. Let’s build it up! 🌱",
          ]}
          className="bandalki"
        />
        <div className="bandtop">
          <div>
            <h1 className="hello" data-avoid>
              Wallet
            </h1>
            <div className="eyebrow" data-avoid>
              Your accounts and balances
            </div>
          </div>
          <div className="bandicons" data-avoid>
            <HideButton ctx={ctx} />
            <button className="pillbtn" onClick={addAccount} aria-label="Add account">
              <Icon name="plus" size={18} /> <span className="pilltext">Add account</span>
            </button>
          </div>
        </div>
        <div className="networth" data-avoid>
          <div className="eyebrow">
            Net worth{" "}
            {Math.abs(change) >= 0.1 && (
              <span className={change > 0 ? "upc" : "downc"}>
                {change > 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}% this week
              </span>
            )}
          </div>
          <div className="bigmoney num">{fmt(nw.net, true)}</div>
          <div className="assetsplit">
            <span>
              Assets <b className="num">{fmt(nw.assets)}</b>
            </span>
            <span>
              Liabilities <b className="num">{fmt(nw.liabilities)}</b>
            </span>
          </div>
          <button className="ovlink" onClick={() => setOverview(true)}>
            See overview <Icon name="chevron" size={15} />
          </button>
        </div>
      </header>

      <div className="grid2 tight">
        <div className="card insightcard">
          <div className="eyebrow accent">Alki’s take</div>
          <p>{liquidNote}</p>
        </div>
        <div className="card">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div className="eyebrow" style={{ flex: "1 1 8rem", minWidth: 0 }}>Income &amp; spending this week</div>
            <div className="seg small" role="tablist" aria-label="Chart style" style={{ flex: "0 1 auto", maxWidth: "100%", whiteSpace: "nowrap" }}>
              <button role="tab" aria-selected={weekMode === "split"} onClick={() => setWeekMode("split")}>
                Above &amp; below
              </button>
              <button role="tab" aria-selected={weekMode === "pair"} onClick={() => setWeekMode("pair")}>
                Side by side
              </button>
            </div>
          </div>
          <DualBars days={weekDays} mode={weekMode} />
          <p className="hint" style={{ margin: "2px 0 0" }}>
            <span><span style={{ color: "var(--chart-in)" }} aria-hidden="true">●</span> In {fmt(weekIn)}</span> · <span><span style={{ color: "var(--chart-out)" }} aria-hidden="true">●</span> Out {fmt(weekOut)}</span>
          </p>
        </div>
      </div>

      {state.accounts.length === 0 && (
        <div className="card noaccounts">
          <div className="noacc-ico">
            <Icon name="wallet" size={30} />
          </div>
          <h3>No accounts yet</h3>
          <p className="sub">Add your cash, e-wallets, bank accounts and credit cards to start tracking.</p>
          <button className="btn" onClick={addAccount}>
            <Icon name="plus" size={18} /> Add your first account
          </button>
        </div>
      )}

      {state.accounts.length > 0 && (
      <div className="wallettools">
      <div className="seg" role="tablist">
        {(
          [
            ["all", "All"],
            ["assets", "Debit"],
            ["credit", "Credit"],
          ] as [Filter, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
        <div className="viewtoggle" role="group" aria-label="Layout">
          <button aria-pressed={view === "list"} onClick={() => k.updateSettings({ walletView: "list" })} aria-label="List view">
            <Icon name="list" size={18} />
          </button>
          <button aria-pressed={view === "grid"} onClick={() => k.updateSettings({ walletView: "grid" })} aria-label="Card view">
            <Icon name="grid" size={18} />
          </button>
        </div>
      </div>
      )}

      {state.accounts.length > 0 && groups.length === 0 && <div className="card empty" style={{ marginTop: 14 }}>No accounts here yet.</div>}

      {groups.map((g) => {
        return (
          <section key={g.kind}>
            <div className="sectionhead">
              <h2>{KIND_LABEL[g.kind]}</h2>
            </div>
            {view === "list" ? (
              <div className="acclist">
                {g.items.map((a) => {
                  const b = balance(state, a);
                  const cur = a.currency || baseCurrency(state);
                  const credit = a.kind === "credit";
                  const used = Math.max(0, -b);
                  return (
                    <button key={a.id} className="accrow" style={{ ["--account-color" as string]: a.color }} onClick={() => setDetailId(a.id)} aria-label={`Open ${a.name}`}>
                      {accountCard(a) ? (
                        <CardPic art={accountCard(a)!} w={58} className="rowcard" />
                      ) : (
                        <span className="abadge">
                          <BankLogo account={a} size={36} />
                        </span>
                      )}
                      <span className="main">
                        <b>
                          <span className="accname">{a.name}</span>
                          {state.defAcc === a.id && <span className="adef">Default</span>}
                          {a.archived ? <span className="adef">Archived</span> : a.excludeFromTotal ? <span className="adef">Not in total</span> : null}
                        </b>
                        <small>
                          {credit ? "Credit" : a.kind === "cash" ? "Cash" : "Debit"} · {cur}
                          {credit && <CardDue state={state} a={a} />}
                        </small>
                      </span>
                      <span className="accamt">
                        <b className="num">{fmtIn(credit ? used : b, cur)}</b>
                        <small>
                          {credit
                            ? limitText(state, a, "left")
                            : cur !== baseCurrency(state)
                              ? `≈ ${fmt(balanceBase(state, a))}`
                              : ""}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
            <div className="cards">
              {g.items.map((a) => {
                const b = balance(state, a);
                const used = Math.max(0, -b);
                const cur = a.currency || baseCurrency(state);
                const foreign = cur !== baseCurrency(state);
                return (
                  <button key={a.id} className="acard" style={{ background: a.color }} onClick={() => setDetailId(a.id)} aria-label={`Open ${a.name}`}>
                    <div className="acardtop">
                      {accountCard(a) ? (
                        <CardPic art={accountCard(a)!} w={66} className="rowcard" />
                      ) : (
                        <span className="abadge">
                          <BankLogo account={a} size={34} />
                        </span>
                      )}
                      <span className="aright">
                        {state.defAcc === a.id && <span className="adef">Default</span>}
                        {a.archived ? <span className="adef">Archived</span> : a.excludeFromTotal ? <span className="adef">Not in total</span> : null}
                        <span className="aedit" aria-hidden="true">
                          <Icon name="chevron" size={15} />
                        </span>
                      </span>
                    </div>
                    <div className="aname">{a.name}</div>
                    <div className="akind">
                      {getInst(a.inst) && getInst(a.inst)!.name !== a.name ? getInst(a.inst)!.name : KIND_LABEL[a.kind].replace(/s$/, "")} · {cur}
                      {a.kind === "credit" && <CardDue state={state} a={a} />}
                    </div>
                    {a.kind === "credit" ? (
                      <>
                        <div className="alabel">Used credit</div>
                        <div className="abal num">{fmtIn(used, cur)}</div>
                        {creditInfo(state, a).limit ? (
                          <>
                            <div className="abar">
                              <i style={{ width: `${Math.min(100, (creditInfo(state, a).used / creditInfo(state, a).limit) * 100)}%` }} />
                            </div>
                            <div className="alabel">{limitText(state, a, "available")}</div>
                          </>
                        ) : null}
                        {monthlyInstallments(state, a.id).count > 0 && (
                          <div className="ainst">
                            <Emoji e="💳" /> {fmtIn(monthlyInstallments(state, a.id).monthly, cur)}/mo · {monthlyInstallments(state, a.id).count} installment
                            {monthlyInstallments(state, a.id).count > 1 ? "s" : ""}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="alabel">Balance</div>
                        <div className="abal num">{fmtIn(b, cur)}</div>
                        {foreign && <div className="aconv">≈ {fmt(balanceBase(state, a))}</div>}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            )}
          </section>
        );
      })}
      {state.accounts.length > 0 && (
        <section>
          <div className="sectionhead">
            <h2><Emoji e="🔒" /> Locked savings</h2>
            <button className="link" onClick={() => setLocking(true)}>
              + Lock savings
            </button>
          </div>
          {locked.length === 0 ? (
            <button className="card lockempty" onClick={() => setLocking(true)}>
              <span><Emoji e="🔒" /></span>
              <span className="main">
                <b>Time deposits & locked savings</b>
                <small>Track money locked for a few months (Maya, Tonik, CIMB, banks…) and see the interest you’ll earn.</small>
              </span>
            </button>
          ) : (
            <>
              <div className="acclist">
                {locked.map((a) => (
                  <DepositRow key={a.id} acc={a} onOpen={() => setDeposit(a)} />
                ))}
              </div>
              {lockedTotal > 0 && <p className="hint">{fmt(lockedTotal)} locked. It counts in net worth but not in your daily allowance.</p>}
            </>
          )}
        </section>
      )}
      {upgrade && (
        <Plans
          access={ctx.access}
          reason={`The free plan has up to ${FREE_ACCOUNT_LIMIT} accounts. Choose a plan to add more.`}
          onClose={() => {
            setUpgrade(false);
            ctx.access.refresh();
          }}
        />
      )}
      {overview && <Overview ctx={ctx} onClose={() => setOverview(false)} />}
      {locking && <LockForm ctx={ctx} onClose={() => setLocking(false)} />}
      {deposit && <DepositModal ctx={ctx} acc={deposit} onClose={() => setDeposit(null)} />}

      {archivedCount > 0 && (
        <button className="link" style={{ marginTop: 14 }} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide" : "Show"} archived ({archivedCount})
        </button>
      )}
      {(dt.owe > 0 || dt.owed > 0) && (
        <button className="card debtsummary" onClick={() => ctx.goTab("plan", "debts")}>
          <span><Emoji e="🤝" /></span>
          <span className="main">
            <b>Debts</b>
            <small>
              {dt.owed > 0 ? `${fmt(dt.owed)} owed to you` : ""}
              {dt.owed > 0 && dt.owe > 0 ? " · " : ""}
              {dt.owe > 0 ? `you owe ${fmt(dt.owe)}` : ""}
            </small>
          </span>
          <span className="link">View ›</span>
        </button>
      )}
      {state.accounts.length > 0 && <p className="hint">Tap an account to see its balance, activity and details, and to edit it. Account names are matched when you type, so “grab 250 gcash” uses GCash.</p>}

      {detailId && (
        <AccountDetail ctx={ctx} accountId={detailId} onClose={() => setDetailId(null)} onEdit={(a) => setEditing(a)} />
      )}

      {editing && (
        <AccountForm
          account={editing === "new" ? null : editing}
          ctx={ctx}
          onClose={() => setEditing(null)}
          onDone={(m) => {
            setEditing(null);
            toast(m);
          }}
        />
      )}
    </>
  );
}

function AccountForm({ account, ctx, onClose, onDone }: { account: Account | null; ctx: Ctx; onClose: () => void; onDone: (msg: string) => void }) {
  const { k, toast } = ctx;
  const { state } = k;
  const [picking, setPicking] = useState(!account);
  const [inst, setInst] = useState<string | undefined>(account?.inst);
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccKind>(account?.kind ?? "ewallet");
  const [color, setColor] = useState(account?.color ?? CARD_COLORS[state.accounts.length % CARD_COLORS.length]);
  const [opening, setOpening] = useState(account ? String(account.kind === "credit" ? -account.opening : account.opening) : "");
  const [limit, setLimit] = useState(account?.limit ? String(account.limit) : "");
  const [limitShare, setLimitShare] = useState(account?.limitShare ?? "");
  // Cards this one can share a limit with: other active credit cards that don't themselves borrow this card's limit.
  const shareable = state.accounts.filter((x) => x.kind === "credit" && !x.archived && x.id !== account?.id && (!account || limitHolder(state, x).id !== account.id));
  const [excluded, setExcluded] = useState(!!account?.excludeFromTotal);
  const [statementDay, setStatementDay] = useState(account?.statementDay ? String(account.statementDay) : "");
  const [dueDay, setDueDay] = useState(account?.dueDay ? String(account.dueDay) : "");
  const [minPct, setMinPct] = useState(String(account?.minPct ?? 3));
  const [minFloor, setMinFloor] = useState(String(account?.minFloor ?? 500));
  const [paying, setPaying] = useState(false);
  const cycle = account && account.kind === "credit" ? cardCycle(state, account) : null;
  const [stmtFix, setStmtFix] = useState(account?.stmtFix && cycle && account.stmtFix.key === cycle.key ? String(account.stmtFix.amount) : "");
  const [archived, setArchived] = useState(!!account?.archived);
  const [currency, setCurrency] = useState(account?.currency || baseCurrency(state));
  const [logo, setLogo] = useState<string | undefined>(account?.logo);
  const [card, setCard] = useState<string | undefined>(account?.card);
  const [maintaining, setMaintaining] = useState(account?.maintaining ? String(account.maintaining) : "");
  const [rate, setRate] = useState(account?.rate ? String(account.rate) : "");
  const [tax, setTax] = useState(String(account?.tax ?? 20));
  const [freq, setFreq] = useState<InterestFreq>(account?.interestFreq ?? "monthly");
  const [payName, setPayName] = useState(account?.payName ?? "");
  const [payNumber, setPayNumber] = useState(account?.payNumber ?? "");
  const [payInfo, setPayInfo] = useState(account?.payInfo ?? "");
  const [payQr, setPayQr] = useState<string | undefined>(account?.payQr);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [tierAt, setTierAt] = useState(account?.tierAt ? String(account.tierAt) : "");
  const [rate2, setRate2] = useState(account?.rate2 ? String(account.rate2) : "");
  const [tierMode, setTierMode] = useState<"whole" | "excess">(account?.tierMode ?? "excess");
  const used = account ? state.txs.some((t) => t.acc === account.id || t.to === account.id) : false;
  const info = getInst(inst);
  const preview: Account = { id: "preview", name: name || "Account", opening: 0, kind, color, inst, logo };
  // Card pictures for this bank (credit cards only).
  // The card saved on this account comes first, so it's in view when editing.
  const cardChoices = kind === "credit" ? [...cardsFor(inst)].sort((x, y) => Number(y.id === account?.card) - Number(x.id === account?.card)) : [];
  const art = kind === "credit" ? getCardArt(card) : undefined;
  const bankName = info?.name.replace(/ Credit Card$/, "").replace(/ Unibank$/, "") ?? "";
  /** "Metrobank" + "World Mastercard" → "Metrobank World Mastercard" (no double bank name). */
  const cardName = (c: CardArt) => (bankName && !c.name.toLowerCase().includes(bankName.split(" ")[0].toLowerCase()) ? `${bankName} ${c.name}` : c.name);

  function pickCard(c?: CardArt) {
    // Rename only if the name is still the automatic one (the bank's, or the previous card's).
    const prev = getCardArt(card);
    const auto = !name.trim() || name === info?.name.replace(/ Unibank$/, "") || (prev && name === cardName(prev));
    setCard(c?.id);
    if (auto && c) setName(cardName(c));
    else if (auto && !c && info) setName(info.name.replace(/ Unibank$/, ""));
  }

  function pick(i: Institution | "cash" | "other") {
    if (i === "cash") {
      setInst(undefined);
      setKind("cash");
      setName("Cash");
      setColor("#0f766e");
    } else if (i === "other") {
      setInst(undefined);
      setName("");
    } else {
      setInst(i.id);
      setKind(GROUP_KIND[i.group]);
      setName(i.name.replace(/ Unibank$/, ""));
      setColor(i.color);
    }
    // A different bank: the old card picture no longer applies.
    if (i === "cash" || i === "other" || getCardArt(card)?.bank !== i.id) setCard(undefined);
    setPicking(false);
  }

  function onPayQr(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setQrFile(file); // QrCrop checks the type and size
  }

  async function onLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await assertImage(file, 5 * 1024 * 1024);
    } catch (err) {
      return toast(err instanceof Error ? err.message : "Couldn’t use that picture.");
    }
    const img = new Image();
    img.onload = () => {
      // Shrink to a small square so it fits comfortably in local storage.
      const S = 96;
      const c = document.createElement("canvas");
      c.width = c.height = S;
      const g = c.getContext("2d")!;
      const r = Math.min(img.width, img.height);
      g.drawImage(img, (img.width - r) / 2, (img.height - r) / 2, r, r, 0, 0, S, S);
      setLogo(c.toDataURL("image/png"));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      toast("Couldn’t read that picture.");
    };
    img.src = URL.createObjectURL(file);
  }

  function save(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (nameTaken(k.state.accounts, n, account?.id)) return toast(`You already have an account named “${n}”. Please use a different name.`);
    const o = parseFloat(opening) || 0;
    // Interest is tracked from the day it's first turned on; nothing before that is backdated.
    const earns = (kind === "bank" || kind === "ewallet") && (parseFloat(rate) || 0) > 0;
    const data = {
      name: n,
      kind,
      color,
      inst,
      currency,
      excludeFromTotal: excluded || undefined,
      archived: archived || undefined,
      logo,
      card: kind === "credit" && getCardArt(card)?.bank === inst ? card : undefined,
      // For credit cards the user types what they owe; we store it as a negative balance.
      opening: kind === "credit" ? -Math.abs(o) : o,
      // Changing the amount owed at start restarts its clock: it'll be on the next statement.
      openingAt: kind === "credit" ? (account?.openingAt && account.opening === -Math.abs(o) ? account.openingAt : Date.now()) : undefined,
      stmtFix: kind === "credit" && cycle && stmtFix.trim() !== "" ? { key: cycle.key, amount: parseFloat(stmtFix) || 0 } : undefined,
      limit: kind === "credit" && !limitShare ? parseFloat(limit) || undefined : undefined,
      limitShare: kind === "credit" && limitShare ? limitShare : undefined,
      statementDay: kind === "credit" ? clampDayNum(statementDay) : undefined,
      dueDay: kind === "credit" ? clampDayNum(dueDay) : undefined,
      minPct: kind === "credit" ? parseFloat(minPct) || undefined : undefined,
      minFloor: kind === "credit" ? parseFloat(minFloor) || undefined : undefined,
      maintaining: kind !== "credit" && kind !== "locked" ? parseFloat(maintaining) || undefined : undefined,
      rate: kind !== "credit" && kind !== "cash" && kind !== "locked" ? parseFloat(rate) || undefined : undefined,
      tax: kind !== "credit" && kind !== "cash" && kind !== "locked" && parseFloat(rate) ? Math.max(0, parseFloat(tax) || 0) : undefined,
      interestFreq: earns ? freq : undefined,
      payName: kind !== "credit" && kind !== "locked" ? payName.trim().slice(0, 40) || undefined : undefined,
      payNumber: kind !== "credit" && kind !== "locked" ? cleanNumber(payNumber) : undefined,
      payInfo: kind !== "credit" && kind !== "locked" ? payInfo.trim() || undefined : undefined,
      payQr: kind !== "credit" && kind !== "locked" ? payQr : undefined,
      tierAt: earns && parseFloat(rate2) > 0 && parseFloat(tierAt) > 0 ? parseFloat(tierAt) : undefined,
      rate2: earns && parseFloat(rate2) > 0 && parseFloat(tierAt) > 0 ? parseFloat(rate2) : undefined,
      tierMode: earns && parseFloat(rate2) > 0 && parseFloat(tierAt) > 0 ? tierMode : undefined,
      interestFrom: earns ? account?.interestFrom ?? startOfDay(Date.now()) : undefined,
    };
    if (account) {
      k.updateAccount(account.id, data);
      onDone(`Saved ${n}`);
    } else {
      if (!canAddAccount(ctx.access, k.state.accounts.length)) return toast(`The free plan has up to ${FREE_ACCOUNT_LIMIT} accounts.`);
      k.addAccount(data);
      onDone(`Added ${n}`);
    }
  }

  if (paying && account) return <PayCard ctx={ctx} card={account} onClose={onClose} />;

  if (picking) {
    return (
      <Modal title="Choose your bank or app" onClose={account ? () => setPicking(false) : onClose}>
        <InstitutionPicker onPick={pick} initialCredit={kind === "credit"} />
      </Modal>
    );
  }

  return (
    <>
    <Modal title={account ? "Edit account" : "New account"} onClose={onClose}>
      <form className="form" onSubmit={save}>
        {account?.kind === "credit" && (
          <div className={`cardbill ${cycle?.status ?? "unset"}`}>
            {cycle ? (
              <>
                <div>
                  <b>{cycleLabel(cycle)}</b>
                  <small>
                    {cycle.status === "none" ? "Nothing to pay this cycle" : `Statement ${fmtIn(cycle.statementBalance, currency)} · min ${fmtIn(cycle.minDue, currency)}`}
                  </small>
                </div>
                {cycle.left > 0 && (
                  <button type="button" className="btn sm" onClick={() => setPaying(true)}>
                    <Emoji e="💳" /> Pay card
                  </button>
                )}
              </>
            ) : (
              <small>Set the statement and due days below to get payment reminders.</small>
            )}
          </div>
        )}
        <div className="ad-hero ap-card" style={{ ["--account-color" as string]: color }} aria-label="Account preview">
          <div className="ad-top">
            {art ? (
              <CardPic art={art} w={80} className="rowcard" />
            ) : (
              <span className="ad-logo">
                <BankLogo account={preview} size={40} />
              </span>
            )}
            <div className="ad-meta">
              <div className="ad-kind">
                {KIND_LABEL[kind].replace(/s$/, "")} · {currency}
              </div>
              <div className="ad-name">{name.trim() || "Account preview"}</div>
            </div>
          </div>
          <div className="ad-label">{kind === "credit" ? "Owed at start" : "Opening balance"}</div>
          <div className="ad-amount num">{fmtIn(Math.abs(parseFloat(opening) || 0), currency, true)}</div>
        </div>
        <div className="picked">
          {art ? <CardPic art={art} w={70} /> : <BankLogo account={preview} size={44} />}
          <div className="main">
            <div className="t">{art ? cardName(art) : info?.name ?? (kind === "cash" ? "Cash" : "Custom account")}</div>
            <div className="s">{info ? GROUP_LABEL[info.group] : KIND_LABEL[kind]}</div>
          </div>
          <button type="button" className="btn ghost sm" onClick={() => setPicking(true)}>
            Change
          </button>
        </div>
        {cardChoices.length > 0 && (
          <div className="cardchoose">
            <div className="cardchoosehead">
              Which card? <small>Optional · shows on your Wallet</small>
            </div>
            <div className="cardopts" role="radiogroup" aria-label="Card design">
              <button type="button" role="radio" aria-checked={!card} className="cardopt nocard" onClick={() => pickCard(undefined)}>
                <span className="cardnone">
                  <BankLogo account={preview} size={30} />
                </span>
                <span>No picture</span>
              </button>
              {cardChoices.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={card === c.id} className="cardopt" onClick={() => pickCard(c)}>
                  <CardPic art={c} w={112} />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BPI Savings, Maya" required autoFocus />
        </label>
        <label>
          Type
          <select value={kind} onChange={(e) => setKind(e.target.value as AccKind)}>
            {KINDS.map((kd) => (
              <option key={kd} value={kd}>
                {KIND_LABEL[kd].replace(/s$/, "")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Currency
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
        </label>
        {account && used && currency !== (account.currency || baseCurrency(state)) && (
          <p className="hint" style={{ marginTop: -4 }}>
            Existing entries keep their numbers, now read as {getCurrency(currency).code}. Change currency only to fix a mistake.
          </p>
        )}
        <label>
          {kind === "credit" ? "Amount owed at start" : "Opening balance"}
          <MoneyInput value={opening} onChange={setOpening} placeholder="0" currency={currency} />
        </label>
        {kind === "credit" && (
          <>
            {shareable.length > 0 && (
              <label>
                Credit limit
                <select value={limitShare} onChange={(e) => setLimitShare(e.target.value)}>
                  <option value="">Its own limit</option>
                  {shareable.map((x) => (
                    <option key={x.id} value={x.id}>
                      Shared with {x.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {limitShare ? (
              <SharedLimitNote state={state} shareId={limitShare} />
            ) : (
              <label>
                {shareable.length > 0 ? "Limit amount" : "Credit limit"}
                <MoneyInput value={limit} onChange={setLimit} placeholder="Required for the usage bar" currency={currency} required />
              </label>
            )}
            <div className="formrow">
              <label>
                Statement (cut-off) day
                <input type="number" inputMode="numeric" min={1} max={31} value={statementDay} onChange={(e) => setStatementDay(e.target.value)} placeholder="e.g. 25" />
              </label>
              <label>
                Payment due day
                <input type="number" inputMode="numeric" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="e.g. 15" />
              </label>
            </div>
            <div className="formrow">
              <label>
                Minimum due (%)
                <input type="number" inputMode="decimal" min={0} max={100} step="0.5" value={minPct} onChange={(e) => setMinPct(e.target.value)} />
              </label>
              <label>
                But at least
                <MoneyInput value={minFloor} onChange={setMinFloor} currency={currency} />
              </label>
            </div>
            <p className="hint" style={{ marginTop: -4 }}>
              Find these on your statement. Most PH cards ask for about 3% (at least ₱500–₱850) as the minimum.
            </p>
            {cycle && (
              <>
                <label>
                  Statement balance ({new Date(cycle.statementDate).toLocaleDateString("en-PH", { month: "short", day: "numeric" })} statement)
                  <MoneyInput value={stmtFix} onChange={setStmtFix} placeholder={`Auto: ${fmtIn(cardCycle(state, { ...account!, stmtFix: undefined })!.statementBalance, currency)}`} currency={currency} />
                </label>
                <p className="hint" style={{ marginTop: -4 }}>
                  Leave empty and Kwenta works it out from your entries. If your bank shows a different amount, type it here (0 if it says “No payment due”).
                </p>
              </>
            )}
          </>
        )}
        {kind !== "credit" && kind !== "locked" && (
          <details className="moreopt" open={!!(account?.maintaining || account?.rate)}>
            <summary>More options</summary>
            <label>
              Maintaining balance (optional)
              <MoneyInput value={maintaining} onChange={setMaintaining} placeholder="e.g. 2,000" currency={currency} />
            </label>
            <p className="hint" style={{ marginTop: -2 }}>
              Money your bank wants left in the account. It’s kept aside when Kwenta works out what you can spend.
            </p>
            {kind !== "cash" && (
              <>
                <div className="formrow">
                  <label>
                    Interest per year (%)
                    <input type="number" inputMode="decimal" min={0} step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 3.5" />
                  </label>
                  <label>
                    Tax on interest (%)
                    <input type="number" inputMode="decimal" min={0} max={100} step="0.5" value={tax} onChange={(e) => setTax(e.target.value)} />
                  </label>
                </div>
                <div>
                  <div className="eyebrow" style={{ marginBottom: 6 }}>
                    Interest is credited
                  </div>
                  <div className="seg small" role="tablist" aria-label="How often interest is credited">
                    {FREQS.map((f) => (
                      <button key={f.id} type="button" role="tab" aria-selected={freq === f.id} onClick={() => setFreq(f.id)}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="formrow">
                  <label>
                    Higher rate above (optional)
                    <MoneyInput value={tierAt} onChange={setTierAt} placeholder="e.g. 1,000,000" currency={currency} />
                  </label>
                  <label>
                    Higher rate (%)
                    <input type="number" inputMode="decimal" min={0} step="0.01" value={rate2} onChange={(e) => setRate2(e.target.value)} placeholder="e.g. 3.75" />
                  </label>
                </div>
                {parseFloat(rate2) > 0 && parseFloat(tierAt) > 0 && (
                  <div>
                    <div className="eyebrow" style={{ marginBottom: 6 }}>
                      The higher rate applies to
                    </div>
                    <div className="seg small" role="tablist" aria-label="Where the higher rate applies">
                      <button type="button" role="tab" aria-selected={tierMode === "excess"} onClick={() => setTierMode("excess")}>
                        Only the part above
                      </button>
                      <button type="button" role="tab" aria-selected={tierMode === "whole"} onClick={() => setTierMode("whole")}>
                        The whole balance
                      </button>
                    </div>
                  </div>
                )}
                <p className="hint" style={{ marginTop: -2 }}>
                  {parseFloat(rate) > 0
                    ? `Kwenta adds the interest for you after each ${freq === "daily" ? "day" : freq === "monthly" ? "month" : freq === "quarterly" ? "quarter" : "year"}, worked out from your daily balance and recorded after tax as an “Interest” entry. ${account?.interestFrom ? "It’s been counting since " + new Date(account.interestFrom).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" }) + "." : "It starts today; nothing is backdated."} If your bank credits a different amount, use Adjust balance.`
                    : "Enter your account’s yearly rate and Kwenta will add the interest for you."}
                </p>
              </>
            )}
          </details>
        )}
        {kind !== "credit" && kind !== "locked" && (
          <details className="moreopt" open={!!(account?.payInfo || account?.payQr || account?.payNumber || account?.payName)}>
            <summary>Get paid into this account</summary>
            <div className="formrow">
              <label>
                Account name
                <input value={payName} onChange={(e) => setPayName(e.target.value.slice(0, 40))} placeholder="e.g. Jose Vincent B." maxLength={40} autoComplete="off" />
              </label>
              <label>
                Account number
                <input value={payNumber} onChange={(e) => setPayNumber(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 24))} placeholder="e.g. 0123 4567 8901" inputMode="numeric" autoComplete="off" />
              </label>
            </div>
            <label>
              Other details (optional)
              <input value={payInfo} onChange={(e) => setPayInfo(e.target.value.slice(0, 80))} placeholder="e.g. InstaPay or PESONet is fine" maxLength={80} />
            </label>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>
                This account’s payment QR (optional)
              </div>
              {payQr ? (
                <div className="qrprev">
                  <img src={payQr} alt="This account's payment QR" />
                  <div className="formrow" style={{ flexDirection: "column", alignItems: "stretch" }}>
                    <label className="btn ghost sm filebtn">
                      Replace
                      <input type="file" accept="image/*" hidden onChange={onPayQr} />
                    </label>
                    <button type="button" className="btn ghost sm" onClick={() => setPayQr(undefined)}>
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="btn ghost sm filebtn">
                  <Icon name="upload" size={16} /> Upload QR
                  <input type="file" accept="image/*" hidden onChange={onPayQr} />
                </label>
              )}
            </div>
            <p className="hint" style={{ marginTop: -2 }}>
              Screenshot this account’s QR from its app and upload the whole picture. Kwenta crops it for you. On a reminder card you choose which account people should pay into.
            </p>
          </details>
        )}
        <fieldset className="swatches">
          <legend>Card color</legend>
          {[...new Set([info?.color, ...CARD_COLORS].filter(Boolean) as string[])].map((c) => (
            <button type="button" key={c} style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} />
          ))}
        </fieldset>
        <div className="formrow">
          <label className="btn ghost sm filebtn">
            {logo ? "Replace logo" : "Upload your own logo"}
            <input type="file" accept="image/*" hidden onChange={onLogo} />
          </label>
          {logo && (
            <button type="button" className="btn ghost sm" onClick={() => setLogo(undefined)}>
              Use default logo
            </button>
          )}
        </div>
        <label className="check">
          <input type="checkbox" checked={excluded} onChange={(e) => setExcluded(e.target.checked)} />
          <span>Hide from net worth (still shown in Wallet)</span>
        </label>
        {account && (
          <label className="check">
            <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
            <span>Archive: hide it from lists and pickers (for old or closed accounts). Its history stays.</span>
          </label>
        )}
        <button className="btn" type="submit">
          {account ? "Save" : "Add account"}
        </button>
        {account && (
          <div className="formrow">
            <button type="button" className="btn ghost sm" disabled={state.defAcc === account.id} onClick={() => { k.setDefAcc(account.id); onDone(`${account.name} is now the default`); }}>
              Make default
            </button>
            <button type="button" className="btn ghost sm" onClick={() => k.moveAccount(account.id, -1)} aria-label="Move earlier">
              <Icon name="up" size={16} />
            </button>
            <button type="button" className="btn ghost sm" onClick={() => k.moveAccount(account.id, 1)} aria-label="Move later">
              <Icon name="down" size={16} />
            </button>
            {!used && (
              <button type="button" className="btn danger sm" onClick={() => { k.removeAccount(account.id); onDone(`Deleted ${account.name}`); }}>
                Delete
              </button>
            )}
          </div>
        )}
        {account && used && <p className="hint">Accounts with transactions can’t be deleted.</p>}
      </form>
    </Modal>
    {qrFile && <QrCrop file={qrFile} onClose={() => setQrFile(null)} onDone={(url) => { setPayQr(url); setQrFile(null); }} />}
    </>
  );
}

const DEBIT_GROUPS: InstGroup[] = ["ewallet", "digital", "bank", "gov"];
const CREDIT_GROUPS: InstGroup[] = ["credit", "bnpl"];

/** Searchable list of banks and apps, split into debit and credit. */
function InstitutionPicker({ onPick, initialCredit }: { onPick: (i: Institution | "cash" | "other") => void; initialCredit?: boolean }) {
  const [side, setSide] = useState<"debit" | "credit">(initialCredit ? "credit" : "debit");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const groups = (needle ? [...DEBIT_GROUPS, ...CREDIT_GROUPS] : side === "debit" ? DEBIT_GROUPS : CREDIT_GROUPS)
    .map((g) => ({ g, items: INSTITUTIONS.filter((i) => i.group === g && (!needle || i.name.toLowerCase().includes(needle))) }))
    .filter((x) => x.items.length);

  return (
    <div className="picker">
      <div className="search plain">
        <Icon name="search" size={18} />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search banks, e-wallets, cards" aria-label="Search banks and apps" autoFocus />
      </div>
      {!needle && (
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={side === "debit"} onClick={() => setSide("debit")}>
            Debit
          </button>
          <button role="tab" aria-selected={side === "credit"} onClick={() => setSide("credit")}>
            Credit
          </button>
        </div>
      )}
      {!needle && side === "debit" && (
        <div className="instgrid">
          <button className="inst" onClick={() => onPick("cash")}>
            <BankLogo account={{ id: "c", name: "Cash", opening: 0, kind: "cash", color: "#0f766e" }} size={40} />
            <span>Cash</span>
          </button>
        </div>
      )}
      {groups.map(({ g, items }) => (
        <section key={g}>
          <div className="eyebrow pickhead">{GROUP_LABEL[g]}</div>
          <div className="instgrid">
            {items.map((i) => (
              <button key={i.id} className="inst" onClick={() => onPick(i)}>
                <BankLogo inst={i} size={40} />
                <span>{i.name.replace(/ Credit Card$/, "")}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {needle && groups.length === 0 && <div className="empty">No match for “{q}”.</div>}
      <button className="btn ghost wide" onClick={() => onPick("other")}>
        Not listed? Add a custom account
      </button>
    </div>
  );
}

function clampDayNum(v: string) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(31, n) : undefined;
}

/** " · Due in 3 days" on a credit card row (highlighted when close or overdue). */
function CardDue({ state, a }: { state: import("@/lib/types").State; a: Account }) {
  const c = cardCycle(state, a);
  const label = cycleLabel(c, a.dueDay);
  if (!label) return null;
  const urgent = c && (c.status === "overdue" || (c.status === "due" && c.daysLeft <= 3));
  return <span className={urgent ? "dueflag" : undefined}> · {label}</span>;
}

/** "₱12,000 left · shared" / "₱3,000 over limit" / "used" for a credit card. */
function limitText(state: import("@/lib/types").State, a: Account, word: "left" | "available") {
  const ci = creditInfo(state, a);
  if (!ci.limit) return word === "left" ? "used" : "";
  const hc = ci.holder.currency || baseCurrency(state);
  if (ci.available < 0) return `${fmtIn(-ci.available, hc)} over limit`;
  const share = ci.shared.length ? (word === "left" ? " · shared" : ` · shared with ${ci.shared.map((x) => x.name).join(", ")}`) : "";
  return `${fmtIn(ci.available, hc)} ${word}${share}`;
}

function SharedLimitNote({ state, shareId }: { state: import("@/lib/types").State; shareId: string }) {
  const other = state.accounts.find((x) => x.id === shareId);
  if (!other) return null;
  const h = limitHolder(state, other);
  return (
    <p className="hint" style={{ marginTop: -4 }}>
      {h.limit
        ? `Uses ${h.name}’s ${fmtIn(h.limit, h.currency || baseCurrency(state))} limit. Spending on any card in the group lowers what’s available on all of them. Each card keeps its own cut-off and due date below.`
        : `Uses ${h.name}’s limit. Set the limit amount on ${h.name}.`}
    </p>
  );
}
