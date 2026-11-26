"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deriveKey, isSealed, newSalt, open, seal, type Sealed } from "./crypto";
import { unpay } from "./bills";
import type { Account, Debt, Goal, Installment, ParsedTx, PersonProfile, Planned, Settings, Split, State, Tx } from "./types";
import { personKey } from "./people";
import { dueInterest, isFreq, type InterestAdded } from "./interest";
import { cleanNumber } from "./remindercard";
import { clearPhotos, newPhotoKey } from "./photos";
import { CARD_COLORS } from "./types";
import { guessInst } from "./institutions";
import { convert, defaultFx, type FxState } from "./currency";
import type { BudgetPeriod } from "./budgets";
import type { CustomCat } from "./categories";

const KEY = "kwenta-v2";
const OLD_KEY = "kwenta-v1";
const SYNC_PASS = "kwenta-syncpass";

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function freshState(): State {
  return {
    version: 2,
    // No sample accounts: people add their own (Wallet → Add account).
    accounts: [],
    txs: [],
    budgets: {},
    goals: [],
    planned: [],
    installments: [],
    debts: [],
    splits: [],
    fx: defaultFx(),
    settings: { name: "", payday: [15, 30], theme: "system", palette: "forest", currency: "PHP", outfit: "classic", alkiSize: "medium", alkiMotion: true, autoLock: 1, hideAmounts: false, defaultsCleared: true, walletView: "list" },
    defAcc: "",
  };
}

/** Accepts v1 data, v2 data, or an imported backup, and fills in anything missing. */
export function normalize(raw: unknown): State | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<State> & { accounts?: Partial<Account>[] };
  if (!Array.isArray(s.accounts) || !Array.isArray(s.txs)) return null;
  const base = freshState();
  let accounts: Account[] = s.accounts.map((a, i) => {
    const name = String(a.name ?? "Account");
    const kind = a.kind ?? (/^cash$/i.test(name) ? "cash" : /gcash|maya|wallet/i.test(name) ? "ewallet" : "bank");
    // Older data has no institution: guess it from the name so logos show up.
    const inst = a.inst ?? (kind === "cash" ? undefined : guessInst(name, kind)?.id);
    return {
      id: String(a.id ?? uid()),
      name,
      opening: Number(a.opening) || 0,
      kind,
      color: a.color ?? CARD_COLORS[i % CARD_COLORS.length],
      limit: a.limit,
      limitShare: typeof a.limitShare === "string" ? a.limitShare : undefined,
      // Older cards have no date for the amount owed at start: treat it as not billed yet (avoids false "overdue").
      openingAt: typeof a.openingAt === "number" ? a.openingAt : kind === "credit" ? Date.now() : undefined,
      stmtFix: a.stmtFix && typeof a.stmtFix.key === "string" && typeof a.stmtFix.amount === "number" ? a.stmtFix : undefined,
      inst,
      logo: typeof a.logo === "string" && a.logo.startsWith("data:image/") ? a.logo : undefined,
      card: typeof a.card === "string" && kind === "credit" ? a.card : undefined,
      currency: typeof a.currency === "string" && /^[A-Z]{3}$/.test(a.currency) ? a.currency : undefined,
      archived: a.archived === true ? true : undefined,
      checkedAt: typeof a.checkedAt === "number" && a.checkedAt > 0 ? a.checkedAt : undefined,
      deposit: a.deposit && typeof a.deposit.principal === "number" ? a.deposit : undefined,
      statementDay: typeof a.statementDay === "number" ? a.statementDay : undefined,
      dueDay: typeof a.dueDay === "number" ? a.dueDay : undefined,
      minPct: typeof a.minPct === "number" ? a.minPct : undefined,
      minFloor: typeof a.minFloor === "number" ? a.minFloor : undefined,
      paidCycles: Array.isArray(a.paidCycles) ? a.paidCycles : undefined,
      excludeFromTotal: a.excludeFromTotal === true ? true : undefined,
      maintaining: typeof a.maintaining === "number" && a.maintaining > 0 ? a.maintaining : undefined,
      rate: typeof a.rate === "number" && a.rate > 0 ? a.rate : undefined,
      tax: typeof a.tax === "number" && a.tax >= 0 ? a.tax : undefined,
      payName: typeof a.payName === "string" && a.payName.trim() ? a.payName.trim().slice(0, 40) : undefined,
      payNumber: typeof a.payNumber === "string" ? cleanNumber(a.payNumber) : undefined,
      payInfo: typeof a.payInfo === "string" && a.payInfo.trim() ? a.payInfo.trim().slice(0, 80) : undefined,
      payQr: typeof a.payQr === "string" && a.payQr.startsWith("data:image/") ? a.payQr : undefined,
      interestFreq: isFreq(a.interestFreq) ? a.interestFreq : undefined,
      interestFrom: typeof a.interestFrom === "number" && a.interestFrom > 0 ? a.interestFrom : undefined,
      interestCarry: typeof a.interestCarry === "number" && a.interestCarry > 0 && a.interestCarry < 0.01 ? a.interestCarry : undefined,
      rate2: typeof a.rate2 === "number" && a.rate2 > 0 && typeof a.tierAt === "number" && a.tierAt > 0 ? a.rate2 : undefined,
      tierAt: typeof a.rate2 === "number" && a.rate2 > 0 && typeof a.tierAt === "number" && a.tierAt > 0 ? a.tierAt : undefined,
      tierMode: a.tierMode === "whole" || a.tierMode === "excess" ? a.tierMode : undefined,
    };
  });
  return {
    version: 2,
    accounts,
    txs: s.txs.filter((t) => t && Number.isFinite(t.amount) && typeof t.amount === "number" && Number.isFinite(t.date) && typeof t.date === "number"),
    budgets: s.budgets ?? {},
    budgetPeriods: s.budgetPeriods && typeof s.budgetPeriods === "object" ? s.budgetPeriods : {},
    customCats: Array.isArray(s.customCats) ? s.customCats.filter((c) => c && typeof c.name === "string" && c.name.trim()) : [],
    goals: Array.isArray(s.goals) ? s.goals : [],
    planned: Array.isArray(s.planned) ? s.planned : [],
    installments: Array.isArray(s.installments) ? s.installments : [],
    debts: Array.isArray(s.debts) ? s.debts.map((d) => ({ ...d, payments: Array.isArray(d.payments) ? d.payments : [] })) : [],
    splits: Array.isArray(s.splits) ? s.splits : [],
    people: Array.isArray(s.people) ? s.people.filter((p) => p && typeof p.name === "string" && p.name.trim()) : [],
    photoKey: typeof s.photoKey === "string" ? s.photoKey : undefined,
    fx: s.fx && typeof s.fx === "object" && s.fx.rates ? { ...defaultFx(), ...s.fx, rates: { ...defaultFx().rates, ...s.fx.rates } } : defaultFx(),
    // Older data never had the cleanup flag, so it starts false there.
    settings: { ...base.settings, ...(s.settings ?? {}), defaultsCleared: s.settings?.defaultsCleared ?? false },
    defAcc: accounts.some((a) => a.id === s.defAcc) ? s.defAcc! : accounts[0]?.id ?? "",
  };
}

/** The sample accounts older versions created for everyone. */
const SAMPLE_ACCOUNTS: Record<string, string> = { a1: "Cash", a2: "GCash", a3: "Bank" };

/**
 * Once, removes the old sample accounts if they were never used (₱0, no entries, bills or
 * installments). Anything you actually used is kept.
 */
function dropUnusedSamples(s: State): State {
  if (s.settings.defaultsCleared) return s;
  const used = new Set<string>();
  for (const t of s.txs) {
    used.add(t.acc);
    if (t.to) used.add(t.to);
  }
  for (const p of s.planned) used.add(p.acc);
  for (const p of s.installments) used.add(p.acc);
  const accounts = s.accounts.filter((a) => !(SAMPLE_ACCOUNTS[a.id] === a.name && !a.opening && !used.has(a.id)));
  return {
    ...s,
    accounts,
    defAcc: accounts.some((a) => a.id === s.defAcc) ? s.defAcc : accounts[0]?.id ?? "",
    settings: { ...s.settings, defaultsCleared: true },
  };
}

const PREFS = "kwenta-prefs";
const SAFETY = "kwenta-safety";
/** PIN length (4–6), so the lock screen shows the right number of dots. Not the PIN itself. */
export const PIN_LEN = "kwenta-pinlen";
const rememberPinLength = (pin: string) => {
  try {
    localStorage.setItem(PIN_LEN, String(pin.length));
  } catch {
    /* ignore */
  }
};

type Stored = { kind: "plain"; state: State } | { kind: "locked"; box: Sealed } | { kind: "none" };

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(OLD_KEY);
    if (!raw) return { kind: "none" };
    const parsed = JSON.parse(raw);
    if (isSealed(parsed)) return { kind: "locked", box: parsed };
    const s = normalize(parsed);
    return s ? { kind: "plain", state: dropUnusedSamples(s) } : { kind: "none" };
  } catch {
    /* storage unavailable or corrupt: start fresh */
    return { kind: "none" };
  }
}

/** For a transfer between accounts in different currencies, records what arrived at today's rate. */
function withToAmount(s: State, tx: Tx): Tx {
  if (tx.type !== "transfer" || tx.toAmount !== undefined || !tx.to) return tx;
  const base = s.settings.currency || "PHP";
  const from = s.accounts.find((a) => a.id === tx.acc)?.currency || base;
  const to = s.accounts.find((a) => a.id === tx.to)?.currency || base;
  if (from === to) return tx;
  return { ...tx, toAmount: Math.round(convert(tx.amount, from, to, s.fx ?? defaultFx()) * 100) / 100 };
}

/** Entries an installment logged: by saved ids, or by matching notes for plans saved before ids were kept. */
function findLinkedTxs(txs: Tx[], p: Installment) {
  const exists = (id?: string) => (id && txs.some((t) => t.id === id) ? id : undefined);
  if (p.txIds) {
    return {
      principal: exists(p.txIds.principal),
      fee: exists(p.txIds.fee),
      interest: (p.txIds.interest ?? []).filter((id) => txs.some((t) => t.id === id)),
    };
  }
  const near = (t: Tx) => t.acc === p.acc && Math.abs(t.date - p.created) < 120_000;
  return {
    principal: txs.find((t) => near(t) && t.amount === p.principal && (t.note === p.name || t.note === `${p.name} (cash installment)`))?.id,
    fee: txs.find((t) => near(t) && t.note === `Installment fee · ${p.name}`)?.id,
    interest: txs
      .filter((t) => t.acc === p.acc && t.note.startsWith(`Installment interest · ${p.name} (`))
      .sort((x, y) => x.date - y.date)
      .map((t) => t.id),
  };
}

/** Deletes everything Kwenta keeps on this device (data, safety copy, PIN setting, receipt photos). */
export async function wipeLocalData() {
  try {
    // "kwenta-pin-skip" is the "Not now" choice on the optional PIN offer; a new account should be offered it again.
    [KEY, OLD_KEY, SAFETY, PIN_LEN, PREFS, "kwenta-pin-skip", "kwenta-bio", "kwenta-lock", SYNC_PASS].forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  await clearPhotos().catch(() => undefined);
}

export function useKwenta() {
  const [state, setState] = useState<State>(freshState);
  const [ready, setReady] = useState(false);
  /** True while the PIN screen is showing; the real data is not in memory. */
  const [locked, setLocked] = useState(false);
  /** Whether a PIN is set (data is stored encrypted). */
  const [lockOn, setLockOn] = useState(false);
  const [hasSafety, setHasSafety] = useState(false);
  const keyRef = useRef<{ key: CryptoKey; salt: string } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const writeSeq = useRef(0);

  useEffect(() => {
    const st = readStored();
    if (st.kind === "locked") {
      setLockOn(true);
      setLocked(true);
    } else if (st.kind === "plain") setState(st.state);
    try {
      setHasSafety(!!localStorage.getItem(SAFETY));
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  /** Writes a value, encrypted when a PIN is set. */
  const persist = useCallback(async (storageKey: string, value: unknown) => {
    const json = JSON.stringify(value);
    const k = keyRef.current;
    const out = k ? JSON.stringify(await seal(k.key, k.salt, json)) : json;
    localStorage.setItem(storageKey, out);
  }, []);

  /** The remembered sync passphrase: sealed with the PIN key when a PIN is set (so it needs an unlock), plain otherwise. */
  const recallSyncPass = useCallback(async (): Promise<string | null> => {
    try {
      const raw = localStorage.getItem(SYNC_PASS);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (isSealed(parsed)) {
        if (!keyRef.current) return null;
        const v = JSON.parse(await open(keyRef.current.key, parsed));
        return typeof v?.p === "string" ? v.p : null;
      }
      return typeof parsed?.p === "string" ? parsed.p : null;
    } catch {
      return null;
    }
  }, []);

  /** Remembers the passphrase on this device, or forgets it when given null. */
  const rememberSyncPass = useCallback(
    async (pass: string | null) => {
      try {
        if (pass === null) localStorage.removeItem(SYNC_PASS);
        else await persist(SYNC_PASS, { p: pass });
      } catch {
        /* storage unavailable */
      }
    },
    [persist],
  );

  const readSafety = useCallback(async (): Promise<State | null> => {
    try {
      const raw = localStorage.getItem(SAFETY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (isSealed(parsed)) {
        if (!keyRef.current) return null;
        return normalize(JSON.parse(await open(keyRef.current.key, parsed)));
      }
      return normalize(parsed);
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!ready || locked) return;
    const seq = ++writeSeq.current;
    const json = JSON.stringify(state);
    const k = keyRef.current;
    void (async () => {
      try {
        const out = k ? JSON.stringify(await seal(k.key, k.salt, json)) : json;
        if (seq !== writeSeq.current) return; // a newer save is on its way
        localStorage.setItem(KEY, out);
        localStorage.removeItem(OLD_KEY); // never leave an unencrypted old copy behind
        // Theme only, so the right colors show on the PIN screen before unlocking.
        localStorage.setItem(PREFS, JSON.stringify({ theme: state.settings.theme, palette: state.settings.palette, custom: state.settings.customColor }));
      } catch {
        /* storage full or unavailable */
      }
    })();
  }, [state, ready, locked, lockOn]);

  /** Re-saves the safety copy with the current key (after turning the PIN on, off or changing it). */
  const resealSafety = useCallback(
    async (prev: State | null) => {
      if (prev) await persist(SAFETY, prev).catch(() => undefined);
    },
    [persist],
  );

  const unlock = useCallback(async (pin: string): Promise<boolean> => {
    const st = readStored();
    if (st.kind !== "locked") {
      setLocked(false);
      return true;
    }
    try {
      const key = await deriveKey(pin, st.box.salt);
      const opened = normalize(JSON.parse(await open(key, st.box)));
      if (!opened) return false;
      const s = dropUnusedSamples(opened);
      keyRef.current = { key, salt: st.box.salt };
      rememberPinLength(pin); // also covers PINs set before the length was saved
      setState(s);
      setLocked(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  /** Hides the data: drops the key and the decrypted data from memory. */
  const lock = useCallback(() => {
    if (!keyRef.current) return;
    writeSeq.current++; // cancel any save in flight
    keyRef.current = null;
    setLocked(true);
    setState(freshState());
  }, []);

  const verifyPin = useCallback(async (pin: string) => {
    const st = readStored();
    if (st.kind !== "locked") return !lockOn;
    try {
      await open(await deriveKey(pin, st.box.salt), st.box);
      return true;
    } catch {
      return false;
    }
  }, [lockOn]);

  /** Turns on the PIN, or changes it. Data is re-saved encrypted with the new key. */
  const setPin = useCallback(
    async (pin: string) => {
      const prevSafety = await readSafety();
      const prevPass = await recallSyncPass(); // re-saved under the new key, so a PIN never leaves it unprotected
      const salt = newSalt();
      keyRef.current = { key: await deriveKey(pin, salt), salt };
      rememberPinLength(pin);
      await resealSafety(prevSafety);
      if (prevPass) await rememberSyncPass(prevPass);
      setLockOn(true);
      setState((s) => ({ ...s })); // trigger an encrypted save
    },
    [readSafety, resealSafety, recallSyncPass, rememberSyncPass],
  );

  const removePin = useCallback(async () => {
    const prevSafety = await readSafety();
    const prevPass = await recallSyncPass();
    keyRef.current = null;
    try {
      localStorage.removeItem(PIN_LEN);
    } catch {
      /* ignore */
    }
    await resealSafety(prevSafety);
    if (prevPass) await rememberSyncPass(prevPass);
    setLockOn(false);
    setState((s) => ({ ...s }));
  }, [readSafety, resealSafety, recallSyncPass, rememberSyncPass]);

  /** Last resort when the PIN is forgotten: deletes everything on this device. */
  const eraseEverything = useCallback(() => {
    writeSeq.current++;
    try {
      [KEY, OLD_KEY, SAFETY, PIN_LEN, "kwenta-bio", "kwenta-lock", SYNC_PASS].forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    keyRef.current = null;
    setLockOn(false);
    setHasSafety(false);
    setLocked(false);
    void clearPhotos();
    setState(freshState());
  }, []);

  /** Replaces all data, keeping the current data as a safety copy you can restore. */
  const replaceAll = useCallback(
    async (next: State) => {
      try {
        await persist(SAFETY, state);
        setHasSafety(true);
      } catch {
        /* ignore */
      }
      setState(next);
    },
    [persist, state],
  );

  const restoreSafety = useCallback(async () => {
    const prev = await readSafety();
    if (!prev) return false;
    await persist(SAFETY, state).catch(() => undefined);
    setState(prev);
    return true;
  }, [readSafety, persist, state]);

  const addTx = useCallback((p: ParsedTx): Tx => {
    const tx: Tx = { ...p, id: uid() };
    setState((s) => ({ ...s, txs: [...s.txs, withToAmount(s, tx)] }));
    return tx;
  }, []);

  /** Replaces an entry with an edited version (cross-currency transfers get their received amount). */
  const updateTx = useCallback((tx: Tx) => {
    setState((s) => ({ ...s, txs: s.txs.map((t) => (t.id === tx.id ? withToAmount(s, { ...tx, toAmount: tx.type === "transfer" ? tx.toAmount : undefined }) : t)) }));
  }, []);

  const restoreTx = useCallback((tx: Tx) => setState((s) => ({ ...s, txs: [...s.txs, tx] })), []);
  // Deleting an entry that paid a bill makes that bill unpaid again, so bills never disagree with History.
  const removeTx = useCallback(
    (id: string) =>
      setState((s) => {
        const tx = s.txs.find((t) => t.id === id);
        const txs = s.txs.filter((t) => t.id !== id);
        if (!tx?.bill) return { ...s, txs };
        const { planned } = unpay({ ...s, txs }, tx.bill.id, tx.bill.key);
        return { ...s, txs, planned };
      }),
    [],
  );

  const addAccount = useCallback((a: Omit<Account, "id">) => {
    setState((s) => {
      const id = uid();
      const accounts = [...s.accounts, { ...a, currency: a.currency || s.settings.currency || "PHP", id }];
      // The first account becomes the default automatically.
      return { ...s, accounts, defAcc: s.accounts.some((x) => x.id === s.defAcc) ? s.defAcc : id };
    });
  }, []);

  /**
   * Changes the main currency. Accounts keep their own currency (ones that followed the old
   * main currency are pinned to it), and budgets and goals are converted to the new one.
   */
  const changeBaseCurrency = useCallback((code: string) => {
    setState((s) => {
      const old = s.settings.currency || "PHP";
      if (old === code) return s;
      const fx = s.fx ?? defaultFx();
      const cv = (n: number) => Math.round(convert(n, old, code, fx) * 100) / 100;
      const budgets: Record<string, number> = {};
      for (const [c, v] of Object.entries(s.budgets)) budgets[c] = cv(v);
      return {
        ...s,
        accounts: s.accounts.map((a) => (a.currency ? a : { ...a, currency: old })),
        budgets,
        goals: s.goals.map((g) => ({ ...g, target: cv(g.target), saved: cv(g.saved) })),
        settings: { ...s.settings, currency: code },
      };
    });
  }, []);

  const updateAccount = useCallback((id: string, patch: Partial<Account>) => {
    setState((s) => {
      const accounts = s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a));
      // An archived account can't stay the default.
      const defAcc = patch.archived && s.defAcc === id ? accounts.find((a) => !a.archived)?.id ?? s.defAcc : s.defAcc;
      return { ...s, accounts, defAcc };
    });
  }, []);

  const removeAccount = useCallback((id: string) => {
    setState((s) => {
      const accounts = s.accounts.filter((a) => a.id !== id);
      return { ...s, accounts, defAcc: s.defAcc === id ? accounts[0]?.id ?? "" : s.defAcc };
    });
  }, []);

  /** Posts savings interest that has come due. Returns what was added (empty when nothing was due). */
  const postInterest = useCallback((): InterestAdded[] => {
    const now = Date.now();
    const res = dueInterest(stateRef.current, now);
    if (!res) return [];
    setState((s) => dueInterest(s, now)?.state ?? s);
    return res.added;
  }, []);

  const moveAccount = useCallback((id: string, dir: -1 | 1) => {
    setState((s) => {
      const i = s.accounts.findIndex((a) => a.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.accounts.length) return s;
      const accounts = [...s.accounts];
      [accounts[i], accounts[j]] = [accounts[j], accounts[i]];
      return { ...s, accounts };
    });
  }, []);

  /** Sets (or with 0, removes) a category's budget and, optionally, its period. */
  const setBudget = useCallback((cat: string, value: number, period?: BudgetPeriod) => {
    setState((s) => {
      const budgets = { ...s.budgets };
      const budgetPeriods = { ...(s.budgetPeriods ?? {}) };
      if (value > 0) {
        budgets[cat] = value;
        if (period) budgetPeriods[cat] = period;
      } else {
        delete budgets[cat];
        delete budgetPeriods[cat];
      }
      return { ...s, budgets, budgetPeriods };
    });
  }, []);

  /** Moves a budget from one category to another (when editing which category it's for). */
  const moveBudget = useCallback((from: string, to: string) => {
    setState((s) => {
      if (from === to || !(from in s.budgets)) return s;
      const budgets = { ...s.budgets, [to]: s.budgets[from] };
      const budgetPeriods = { ...(s.budgetPeriods ?? {}), [to]: s.budgetPeriods?.[from] ?? "monthly" };
      delete budgets[from];
      delete budgetPeriods[from];
      return { ...s, budgets, budgetPeriods };
    });
  }, []);

  const addCustomCat = useCallback((c: CustomCat) => {
    setState((s) => ({ ...s, customCats: [...(s.customCats ?? []).filter((x) => x.name !== c.name), c] }));
  }, []);

  /** Edits a custom category; a rename also updates entries, budgets, bills and installments. */
  const updateCustomCat = useCallback((oldName: string, c: CustomCat) => {
    setState((s) => {
      const rn = (cat: string) => (cat === oldName ? c.name : cat);
      const budgets: Record<string, number> = {};
      for (const [k, v] of Object.entries(s.budgets)) budgets[rn(k)] = v;
      const budgetPeriods: Record<string, BudgetPeriod> = {};
      for (const [k, v] of Object.entries(s.budgetPeriods ?? {})) budgetPeriods[rn(k)] = v;
      return {
        ...s,
        customCats: (s.customCats ?? []).map((x) => (x.name === oldName ? c : x)),
        txs: oldName === c.name ? s.txs : s.txs.map((t) => (t.cat === oldName ? { ...t, cat: c.name } : t)),
        planned: s.planned.map((p) => (p.cat === oldName ? { ...p, cat: c.name } : p)),
        installments: s.installments.map((p) => (p.cat === oldName ? { ...p, cat: c.name } : p)),
        budgets,
        budgetPeriods,
      };
    });
  }, []);

  /** Deletes a custom category; its entries move to "Other" and its budget is removed. */
  const removeCustomCat = useCallback((name: string) => {
    setState((s) => {
      const budgets = { ...s.budgets };
      const budgetPeriods = { ...(s.budgetPeriods ?? {}) };
      delete budgets[name];
      delete budgetPeriods[name];
      return {
        ...s,
        customCats: (s.customCats ?? []).filter((x) => x.name !== name),
        txs: s.txs.map((t) => (t.cat === name ? { ...t, cat: "Other" } : t)),
        planned: s.planned.map((p) => (p.cat === name ? { ...p, cat: "Other" } : p)),
        installments: s.installments.map((p) => (p.cat === name ? { ...p, cat: "Other" } : p)),
        budgets,
        budgetPeriods,
      };
    });
  }, []);

  const addGoal = useCallback((g: Omit<Goal, "id" | "created" | "saved">) => {
    setState((s) => ({ ...s, goals: [...s.goals, { ...g, id: uid(), saved: 0, created: Date.now() }] }));
  }, []);

  const contributeGoal = useCallback((id: string, amount: number) => {
    setState((s) => ({
      ...s,
      goals: s.goals.map((g) => (g.id === id ? { ...g, saved: Math.max(0, g.saved + amount) } : g)),
    }));
  }, []);

  const removeGoal = useCallback((id: string) => setState((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== id) })), []);

  const addPlanned = useCallback((p: Omit<Planned, "id" | "done">) => {
    setState((s) => ({ ...s, planned: [...s.planned, { ...p, id: uid(), done: [] }] }));
  }, []);

  const removePlanned = useCallback(
    (id: string) => setState((s) => ({ ...s, planned: s.planned.filter((p) => p.id !== id) })),
    [],
  );

  /** Logs a planned item as a real transaction and marks that month as done. */
  /**
   * Marks a recurring bill/income as paid for a month. Logs the entry with what was actually paid
   * (amount, account, date), or, with `link`, ties an entry you already logged to the bill instead of adding another.
   */
  const markPlannedDone = useCallback((id: string, monthKey: string, opts?: { amount?: number; acc?: string; date?: number; link?: string }) => {
    setState((s) => {
      const p = s.planned.find((x) => x.id === id);
      if (!p || p.done.includes(monthKey)) return s;
      const bill = { id, key: monthKey };
      let txs = s.txs;
      let rec: NonNullable<Planned["paid"]>[string];
      const linked = opts?.link ? s.txs.find((t) => t.id === opts.link) : undefined;
      if (linked) {
        txs = s.txs.map((t) => (t.id === linked.id ? { ...t, bill } : t));
        rec = { txId: linked.id, amount: linked.amount, date: linked.date, created: false };
      } else {
        const amount = opts?.amount && opts.amount > 0 ? opts.amount : p.amount;
        const tx: Tx = { id: uid(), type: p.type, amount, cat: p.type === "income" ? "Income" : p.cat, note: p.name, acc: opts?.acc || p.acc, date: opts?.date ?? Date.now(), bill };
        txs = [...s.txs, tx];
        rec = { txId: tx.id, amount, date: tx.date, created: true };
      }
      return {
        ...s,
        txs,
        planned: s.planned.map((x) => (x.id === id ? { ...x, done: [...x.done, monthKey], paid: { ...x.paid, [monthKey]: rec } } : x)),
      };
    });
  }, []);

  /** Undoes "paid": removes the entry Kwenta logged, or just unlinks one you had logged yourself. */
  const undoPlannedDone = useCallback((id: string, monthKey: string) => {
    setState((s) => ({ ...s, ...unpay(s, id, monthKey) }));
  }, []);

  /**
   * Adds an installment plan. Optionally logs what happened on the card today:
   * the purchase (expense), the cash sent to a bank (transfer), and the one-time fee.
   */
  const addInstallment = useCallback(
    (plan: Omit<Installment, "id" | "paid" | "created" | "txIds">, opts: { logNow: boolean; toAcc?: string }) => {
      setState((s) => {
        const now = Date.now();
        const txIds: NonNullable<Installment["txIds"]> = { interest: [] };
        const txs: Tx[] = [];
        if (opts.logNow) {
          if (plan.kind === "purchase") {
            txIds.principal = uid();
            txs.push({ id: txIds.principal, type: "expense", amount: plan.principal, cat: plan.cat, note: plan.name, acc: plan.acc, date: now });
          } else if (plan.kind === "cash" && opts.toAcc) {
            txIds.principal = uid();
            txs.push(withToAmount(s, { id: txIds.principal, type: "transfer", amount: plan.principal, cat: "Transfer", note: `${plan.name} (cash installment)`, acc: plan.acc, to: opts.toAcc, date: now }));
          }
          if (plan.fee > 0) {
            txIds.fee = uid();
            txs.push({ id: txIds.fee, type: "expense", amount: plan.fee, cat: "Bills", note: `Installment fee · ${plan.name}`, acc: plan.acc, date: now });
          }
        }
        const inst: Installment = { ...plan, id: uid(), paid: 0, created: now, txIds };
        return { ...s, installments: [...s.installments, inst], txs: [...s.txs, ...txs] };
      });
    },
    [],
  );

  /** Marks the next monthly bill as posted and logs that month's interest on the card. */
  const postInstallment = useCallback((id: string) => {
    setState((s) => {
      const p = s.installments.find((x) => x.id === id);
      if (!p || p.paid >= p.months) return s;
      const interest = Math.round(p.principal * p.rate) / 100;
      const txs = [...s.txs];
      const txIds = { ...p.txIds, interest: [...(p.txIds?.interest ?? [])] };
      if (interest > 0) {
        const tid = uid();
        txIds.interest.push(tid);
        txs.push({ id: tid, type: "expense", amount: interest, cat: "Bills", note: `Installment interest · ${p.name} (${p.paid + 1}/${p.months})`, acc: p.acc, date: Date.now() });
      }
      return { ...s, txs, installments: s.installments.map((x) => (x.id === id ? { ...x, paid: x.paid + 1, txIds } : x)) };
    });
  }, []);

  /**
   * Fixes a saved installment (typos in amount, name, card, rate, fee, dates…).
   * Entries it logged earlier are corrected to match: the purchase or cash transfer,
   * the fee, and every posted month's interest.
   */
  const updateInstallment = useCallback((id: string, patch: Partial<Omit<Installment, "id" | "created" | "txIds">>) => {
    setState((s) => {
      const old = s.installments.find((x) => x.id === id);
      if (!old) return s;
      const p: Installment = { ...old, ...patch, paid: Math.min(patch.paid ?? old.paid, patch.months ?? old.months) };
      const linked = findLinkedTxs(s.txs, old);
      const interest = Math.round(p.principal * p.rate) / 100;
      let txs = s.txs.map((t) => {
        if (t.id === linked.principal) {
          return t.type === "transfer"
            ? { ...t, amount: p.principal, acc: p.acc, note: `${p.name} (cash installment)` }
            : { ...t, amount: p.principal, acc: p.acc, cat: p.cat, note: p.name };
        }
        if (t.id === linked.fee) return { ...t, amount: p.fee, acc: p.acc, note: `Installment fee · ${p.name}` };
        const n = linked.interest.indexOf(t.id);
        if (n >= 0) return { ...t, amount: interest, acc: p.acc, note: `Installment interest · ${p.name} (${n + 1}/${p.months})` };
        return t;
      });
      // A fee changed to zero removes its entry; interest at 0% removes posted interest.
      const drop = new Set<string>();
      if (linked.fee && p.fee <= 0) drop.add(linked.fee);
      if (interest <= 0) linked.interest.forEach((x) => drop.add(x));
      txs = txs.filter((t) => !drop.has(t.id));
      // A fee added later is logged if the original purchase was logged.
      let feeId = linked.fee && !drop.has(linked.fee) ? linked.fee : undefined;
      if (!feeId && p.fee > 0 && linked.principal) {
        feeId = uid();
        txs.push({ id: feeId, type: "expense", amount: p.fee, cat: "Bills", note: `Installment fee · ${p.name}`, acc: p.acc, date: p.created });
      }
      p.txIds = { principal: linked.principal, fee: feeId, interest: interest > 0 ? linked.interest : [] };
      return { ...s, txs, installments: s.installments.map((x) => (x.id === id ? p : x)) };
    });
  }, []);

  // ---------- Debts (utang) ----------

  /**
   * Adds a debt. With an account, the money movement is logged under the "Debt" category
   * (not counted as income or spending): borrowing adds money, lending takes it out.
   */
  const addDebt = useCallback((d: Omit<Debt, "id" | "created" | "payments" | "txId">, logNow: boolean) => {
    setState((s) => {
      const now = Date.now();
      const debt: Debt = { ...d, id: uid(), created: now, payments: [] };
      const txs = [...s.txs];
      if (logNow && d.acc) {
        const tx: Tx = {
          id: uid(),
          type: d.direction === "owe" ? "income" : "expense",
          amount: d.amount,
          cat: "Debt",
          note: d.direction === "owe" ? `Borrowed from ${d.person}` : `Lent to ${d.person}`,
          acc: d.acc,
          date: now,
          track: d.track || undefined,
        };
        txs.push(tx);
        debt.txId = tx.id;
      }
      return { ...s, debts: [...(s.debts ?? []), debt], txs };
    });
  }, []);

  /**
   * Edits a debt and keeps its logged entry in sync. `acc`: an account id to log it there
   * (moves or creates the entry), "" to stop logging it (removes the entry), undefined to leave it.
   */
  const updateDebt = useCallback((id: string, patch: Partial<Pick<Debt, "person" | "amount" | "note" | "due" | "direction" | "track">> & { acc?: string }) => {
    setState((s) => {
      const old = (s.debts ?? []).find((d) => d.id === id);
      if (!old) return s;
      const { acc, ...rest } = patch;
      const d: Debt = { ...old, ...rest };
      let txs = s.txs;
      const linked = d.txId ? txs.find((t) => t.id === d.txId) : undefined;
      const target = acc === undefined ? linked?.acc : acc || undefined;
      const fields = {
        type: d.direction === "owe" ? ("income" as const) : ("expense" as const),
        amount: d.amount,
        cat: "Debt",
        note: d.direction === "owe" ? `Borrowed from ${d.person}` : `Lent to ${d.person}`,
        track: d.track || undefined,
      };
      if (linked && target) {
        txs = txs.map((t) => (t.id === linked.id ? { ...t, ...fields, acc: target } : t));
        d.acc = target;
      } else if (linked && !target) {
        txs = txs.filter((t) => t.id !== linked.id);
        d.txId = undefined;
        d.acc = undefined;
      } else if (!linked && target && !d.splitId) {
        const tx: Tx = { id: uid(), ...fields, acc: target, date: d.created };
        txs = [...txs, tx];
        d.txId = tx.id;
        d.acc = target;
      }
      // Payments follow the track-only setting too: if the original didn't move the account, neither should paying it back.
      if (rest.track !== undefined && !!rest.track !== !!old.track) {
        const payTx = new Set(d.payments.map((p) => p.txId).filter(Boolean));
        txs = txs.map((t) => (payTx.has(t.id) ? { ...t, track: d.track || undefined } : t));
      }
      // Payments follow the direction (paying back is the opposite of the original move).
      if (rest.direction && rest.direction !== old.direction) {
        const payIds = new Set(d.payments.map((p) => p.txId).filter(Boolean));
        txs = txs.map((t) =>
          payIds.has(t.id) ? { ...t, type: d.direction === "owe" ? "expense" : "income", note: d.direction === "owe" ? `Paid back ${d.person}` : `${d.person} paid back` } : t,
        );
      }
      return { ...s, txs, debts: (s.debts ?? []).map((x) => (x.id === id ? d : x)) };
    });
  }, []);

  /** Changes the account of one payment ("" = don't log it), or its amount. */
  const updateDebtPayment = useCallback((debtId: string, payId: string, patch: { acc?: string; amount?: number }) => {
    setState((s) => {
      const d = (s.debts ?? []).find((x) => x.id === debtId);
      const p = d?.payments.find((x) => x.id === payId);
      if (!d || !p) return s;
      let txs = s.txs;
      const np = { ...p, ...(patch.amount ? { amount: patch.amount } : {}) };
      const linked = p.txId ? txs.find((t) => t.id === p.txId) : undefined;
      const target = patch.acc === undefined ? linked?.acc : patch.acc || undefined;
      if (linked && target) txs = txs.map((t) => (t.id === linked.id ? { ...t, acc: target, amount: np.amount } : t));
      else if (linked && !target) {
        txs = txs.filter((t) => t.id !== linked.id);
        np.txId = undefined;
      } else if (!linked && target) {
        const tx: Tx = {
          id: uid(),
          type: d.direction === "owe" ? "expense" : "income",
          amount: np.amount,
          cat: "Debt",
          note: d.direction === "owe" ? `Paid back ${d.person}` : `${d.person} paid back`,
          acc: target,
          date: p.date,
          track: d.track || undefined,
        };
        txs = [...txs, tx];
        np.txId = tx.id;
      }
      return { ...s, txs, debts: (s.debts ?? []).map((x) => (x.id === debtId ? { ...x, payments: x.payments.map((y) => (y.id === payId ? np : y)) } : x)) };
    });
  }, []);

  /** Removes a payment recorded by mistake, and its logged entry. */
  const removeDebtPayment = useCallback((debtId: string, payId: string) => {
    setState((s) => {
      const d = (s.debts ?? []).find((x) => x.id === debtId);
      const p = d?.payments.find((x) => x.id === payId);
      if (!d || !p) return s;
      return {
        ...s,
        txs: p.txId ? s.txs.filter((t) => t.id !== p.txId) : s.txs,
        debts: (s.debts ?? []).map((x) => (x.id === debtId ? { ...x, payments: x.payments.filter((y) => y.id !== payId) } : x)),
      };
    });
  }, []);

  /** Records a (partial) payment. With an account, logs it under "Debt". */
  const payDebt = useCallback((id: string, amount: number, acc?: string, payId?: string) => {
    setState((s) => {
      const d = (s.debts ?? []).find((x) => x.id === id);
      if (!d || !(amount > 0)) return s;
      const now = Date.now();
      const txs = [...s.txs];
      let txId: string | undefined;
      if (acc) {
        txId = uid();
        txs.push({
          id: txId,
          type: d.direction === "owe" ? "expense" : "income",
          amount,
          cat: "Debt",
          note: d.direction === "owe" ? `Paid back ${d.person}` : `${d.person} paid back`,
          acc,
          date: now,
          track: d.track || undefined,
        });
      }
      const payments = [...d.payments, { id: payId ?? uid(), amount, date: now, txId }];
      return { ...s, txs, debts: (s.debts ?? []).map((x) => (x.id === id ? { ...x, payments } : x)) };
    });
  }, []);

  /**
   * Someone else paid a shared bill. Your share counts as your spending on the day (no money leaves your accounts
   * yet, so the entry is "track only"), and you owe that person your share until you pay them back.
   */
  const addOwedShare = useCallback((o: { title: string; total: number; myShare: number; cat: string; acc: string; payer: string; date?: number; photo?: string }) => {
    const txId = uid();
    const debtId = uid();
    const date = o.date ?? Date.now();
    setState((s) => ({
      ...s,
      txs: [...s.txs, { id: txId, type: "expense", amount: o.myShare, cat: o.cat, note: o.title, acc: o.acc, date, photo: o.photo, track: true }],
      debts: [...(s.debts ?? []), { id: debtId, person: o.payer.trim(), direction: "owe", amount: o.myShare, note: `${o.title} (your share)`, created: date, payments: [] }],
    }));
    return { txId, debtId };
  }, []);

  const removeDebt = useCallback((id: string) => {
    setState((s) => ({ ...s, debts: (s.debts ?? []).filter((d) => d.id !== id) }));
  }, []);

  /**
   * Splits a bill you paid. Logs your share as spending (in `cat`) and the rest under "Debt"
   * (money you fronted for friends), and makes an "owes you" debt for each friend.
   */
  const addSplit = useCallback(
    (sp: { title: string; total: number; myShare: number; cat: string; acc?: string; date?: number; photo?: string; people: { name: string; share: number }[] }, logNow: boolean): string => {
      const splitId = uid();
      setState((s) => {
        const now = sp.date ?? Date.now();
        const txs = [...s.txs];
        const txIds: string[] = [];
        if (logNow && sp.acc) {
          if (sp.myShare > 0) {
            const t: Tx = { id: uid(), type: "expense", amount: sp.myShare, cat: sp.cat, note: sp.title, acc: sp.acc, date: now, photo: sp.photo };
            txs.push(t);
            txIds.push(t.id);
          }
          const others = Math.round((sp.total - sp.myShare) * 100) / 100;
          if (others > 0) {
            const t: Tx = { id: uid(), type: "expense", amount: others, cat: "Debt", note: `Paid for others · ${sp.title}`, acc: sp.acc, date: now, photo: sp.myShare > 0 ? undefined : sp.photo };
            txs.push(t);
            txIds.push(t.id);
          }
        }
        const debts = sp.people.map((p) => ({
          id: uid(),
          person: p.name,
          direction: "owed" as const,
          amount: p.share,
          note: sp.title,
          created: now,
          payments: [],
          splitId,
          acc: sp.acc,
        }));
        const split: Split = {
          id: splitId,
          title: sp.title,
          total: sp.total,
          myShare: sp.myShare,
          date: now,
          acc: sp.acc,
          people: sp.people.map((p, i) => ({ name: p.name, share: p.share, debtId: debts[i].id })),
          txIds,
        };
        return { ...s, txs, debts: [...(s.debts ?? []), ...debts], splits: [...(s.splits ?? []), split] };
      });
      return splitId;
    },
    [],
  );

  /** Removes a split and its friends' debts (logged entries stay in History). */
  /** Undoes a split completely: the split, its friends' debts, and the entries it logged. */
  const undoSplit = useCallback((id: string) => {
    setState((s) => {
      const sp = (s.splits ?? []).find((x) => x.id === id);
      const gone = new Set(sp?.txIds ?? []);
      return { ...s, txs: s.txs.filter((t) => !gone.has(t.id)), splits: (s.splits ?? []).filter((x) => x.id !== id), debts: (s.debts ?? []).filter((d) => d.splitId !== id) };
    });
  }, []);

  const removeSplit = useCallback((id: string) => {
    setState((s) => ({ ...s, splits: (s.splits ?? []).filter((x) => x.id !== id), debts: (s.debts ?? []).filter((d) => d.splitId !== id) }));
  }, []);

  // ---------- People (split-bill profiles) ----------

  /**
   * Creates or updates a person's profile. If the name changes, their debts and split
   * shares are renamed too, so everything stays under one person.
   */
  const savePerson = useCallback((p: Omit<PersonProfile, "id"> & { id?: string }, oldName?: string) => {
    setState((s) => {
      const name = p.name.trim().replace(/\s+/g, " ");
      if (!name) return s;
      const people = s.people ?? [];
      const oldKey = personKey(oldName ?? name);
      const existing = people.find((x) => (p.id ? x.id === p.id : personKey(x.name) === oldKey));
      const next: PersonProfile = { ...existing, ...p, name, id: existing?.id ?? p.id ?? uid() };
      const others = people.filter((x) => x.id !== next.id && personKey(x.name) !== personKey(name));
      const renamed = oldName !== undefined && personKey(oldName) !== personKey(name) ? oldKey : null;
      const sameName = (n: string) => renamed !== null && personKey(n) === renamed;
      return {
        ...s,
        people: [...others, next],
        debts: renamed === null ? s.debts : (s.debts ?? []).map((d) => (sameName(d.person) ? { ...d, person: name } : d)),
        splits: renamed === null ? s.splits : (s.splits ?? []).map((sp) => ({ ...sp, people: sp.people.map((x) => (sameName(x.name) ? { ...x, name } : x)) })),
      };
    });
  }, []);

  /** Removes a profile only; debts with that person stay. */
  const removePerson = useCallback((id: string) => {
    setState((s) => ({ ...s, people: (s.people ?? []).filter((p) => p.id !== id) }));
  }, []);

  // ---------- Locked savings / time deposits ----------

  /**
   * Locks money in a new time deposit (an account of kind "locked"). With `fromAcc`, the money
   * is moved there with a transfer; without it, the deposit starts with that amount already in it.
   */
  const lockSavings = useCallback(
    (d: { name: string; inst?: string; color: string; principal: number; rate: number; rateUnit?: "year" | "month"; months: number; start: number; tax: number; fromAcc?: string }) => {
      setState((s) => {
        const id = uid();
        const acc: Account = {
          id,
          name: d.name,
          kind: "locked",
          color: d.color,
          inst: d.inst,
          currency: s.settings.currency || "PHP",
          opening: d.fromAcc ? 0 : d.principal,
          deposit: { principal: d.principal, rate: d.rate, rateUnit: d.rateUnit, months: d.months, start: d.start, tax: d.tax, status: "locked" },
        };
        const txs = [...s.txs];
        if (d.fromAcc) {
          txs.push(withToAmount({ ...s, accounts: [...s.accounts, acc] }, { id: uid(), type: "transfer", amount: d.principal, cat: "Transfer", note: `Locked in ${d.name}`, acc: d.fromAcc, to: id, date: d.start }));
        }
        return { ...s, accounts: [...s.accounts, acc], txs };
      });
    },
    [],
  );

  /**
   * Ends a deposit (at maturity, or early). The difference from what's in it is logged as
   * interest income (or as a penalty), then everything moves to `toAcc` and the deposit is archived.
   */
  const collectDeposit = useCallback((accId: string, received: number, toAcc: string, early: boolean) => {
    setState((s) => {
      const acc = s.accounts.find((a) => a.id === accId);
      if (!acc?.deposit) return s;
      const now = Date.now();
      // Current balance of the deposit account.
      let inIt = Number(acc.opening) || 0;
      for (const t of s.txs) {
        if (t.track) continue;
        if (t.type === "transfer") {
          if (t.acc === accId) inIt -= t.amount;
          if (t.to === accId) inIt += t.toAmount ?? t.amount;
        } else if (t.acc === accId) inIt += t.type === "income" ? t.amount : -t.amount;
      }
      const diff = Math.round((received - inIt) * 100) / 100;
      const txs = [...s.txs];
      if (diff > 0) txs.push({ id: uid(), type: "income", amount: diff, cat: "Income", note: `Interest · ${acc.name}`, acc: accId, date: now });
      if (diff < 0) txs.push({ id: uid(), type: "expense", amount: -diff, cat: "Other", note: `Early withdrawal penalty · ${acc.name}`, acc: accId, date: now });
      if (received > 0) txs.push(withToAmount(s, { id: uid(), type: "transfer", amount: received, cat: "Transfer", note: `${early ? "Withdrew" : "Matured"} · ${acc.name}`, acc: accId, to: toAcc, date: now }));
      const accounts = s.accounts.map((a) =>
        a.id === accId ? { ...a, archived: true, deposit: { ...a.deposit!, status: early ? ("withdrawn" as const) : ("matured" as const), received } } : a,
      );
      return { ...s, accounts, txs };
    });
  }, []);

  /** Fixes a deposit's details (typos in rate, term, start date or name). */
  const updateDeposit = useCallback((accId: string, patch: Partial<Pick<Account, "name" | "color" | "inst">> & { deposit?: Partial<Account["deposit"]> }) => {
    setState((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === accId && a.deposit ? { ...a, ...patch, deposit: { ...a.deposit, ...(patch.deposit ?? {}) } } : a)),
    }));
  }, []);

  /** Marks a credit card statement as paid (when it was paid outside Kwenta). */
  const markCardPaid = useCallback((accId: string, key: string) => {
    setState((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === accId ? { ...a, paidCycles: [...new Set([...(a.paidCycles ?? []), key])].slice(-24) } : a)),
    }));
  }, []);

  /** Makes sure there's a key for encrypting receipt photos, and returns it. */
  const ensurePhotoKey = useCallback((): string => {
    let key = stateRef.current.photoKey;
    if (!key) {
      key = newPhotoKey();
      const k = key;
      setState((s) => (s.photoKey ? s : { ...s, photoKey: k }));
    }
    return key;
  }, []);

  const removeInstallment = useCallback(
    (id: string) => setState((s) => ({ ...s, installments: s.installments.filter((x) => x.id !== id) })),
    [],
  );

  const setFx = useCallback((fx: FxState) => setState((s) => ({ ...s, fx })), []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  }, []);

  const setDefAcc = useCallback((id: string) => setState((s) => ({ ...s, defAcc: id })), []);
  const reset = useCallback(() => {
    void clearPhotos();
    setState((s) => ({ ...freshState(), settings: { ...s.settings } }));
  }, []);

  return {
    state,
    ready,
    addTx,
    restoreTx,
    updateTx,
    removeTx,
    addAccount,
    updateAccount,
    removeAccount,
    postInterest,
    moveAccount,
    setBudget,
    moveBudget,
    addCustomCat,
    updateCustomCat,
    removeCustomCat,
    addGoal,
    contributeGoal,
    removeGoal,
    addPlanned,
    removePlanned,
    markPlannedDone,
    undoPlannedDone,
    addInstallment,
    postInstallment,
    updateInstallment,
    removeInstallment,
    addDebt,
    updateDebt,
    payDebt,
    updateDebtPayment,
    removeDebtPayment,
    removeDebt,
    addSplit,
    removeSplit,
    undoSplit,
    addOwedShare,
    savePerson,
    removePerson,
    ensurePhotoKey,
    markCardPaid,
    lockSavings,
    collectDeposit,
    updateDeposit,
    updateSettings,
    changeBaseCurrency,
    setFx,
    setDefAcc,
    replaceAll,
    restoreSafety,
    hasSafety,
    recallSyncPass,
    rememberSyncPass,
    reset,
    locked,
    lockOn,
    unlock,
    lock,
    verifyPin,
    setPin,
    removePin,
    eraseEverything,
  };
}

export type Kwenta = ReturnType<typeof useKwenta>;
