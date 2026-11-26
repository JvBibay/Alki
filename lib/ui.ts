import type { Kwenta } from "./store";
import type { ParsedTx, State, Tx, TxType } from "./types";
import { parseEntry } from "./parser";
import type { Access } from "./plans";

export type Tab = "home" | "wallet" | "plan" | "history";
export type PlanTab = "budgets" | "goals" | "upcoming" | "installments" | "debts";

export type Overlay =
  | { kind: "stats" }
  | { kind: "chat" }
  | { kind: "add"; type?: TxType; edit?: Tx; scan?: boolean; /** Start with this account selected. */ acc?: string }
  | { kind: "settings" }
  | { kind: "streak" }
  | { kind: "recap"; y: number; m: number }
  | { kind: "closet" }
  | { kind: "notifications" };

export type ShowToast = (msg: string, undo?: () => void) => void;

export interface Ctx {
  k: Kwenta;
  toast: ShowToast;
  open: (o: Overlay) => void;
  close: () => void;
  goTab: (t: Tab, plan?: PlanTab) => void;
  /** The person’s plan (free, paid or admin). */
  access: Access & { refresh: () => void };
}

const USE_SERVER = process.env.NEXT_PUBLIC_USE_SERVER_PARSER === "true";

/** Parses a sentence in the browser, or through /api/parse when the server parser is enabled. */
export async function parseSentence(input: string, state: State): Promise<ParsedTx | null> {
  if (USE_SERVER) {
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: input,
          defAcc: state.defAcc,
          accounts: state.accounts.map((a) => ({ id: a.id, name: a.name })),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { result: ParsedTx | null };
        return data.result;
      }
    } catch {
      /* fall through to the local parser */
    }
  }
  return parseEntry(input, state.accounts.filter((a) => !a.archived), state.defAcc, Date.now(), state.customCats ?? [], state.settings.payeeCats);
}

/** Browser speech recognition, if available. Returns a stop function. */
export function listen(onText: (t: string) => void, onEnd: () => void, onError: () => void): (() => void) | null {
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;
  // Speech-to-text is done by the browser's cloud service (Google in Chrome), so ask once.
  try {
    if (!localStorage.getItem("kwenta-voice-ok")) {
      const ok = window.confirm(
        "Voice input sends your voice to your browser’s speech service (Google, in Chrome) to turn it into text.\n\nTyping never leaves your device. Use voice anyway?",
      );
      if (!ok) return null;
      localStorage.setItem("kwenta-voice-ok", "1");
    }
  } catch {
    /* storage blocked: just continue */
  }
  try {
    const rec = new SR();
    rec.lang = "en-PH";
    rec.interimResults = false;
    rec.onresult = (e: any) => onText(e.results[0][0].transcript as string);
    rec.onerror = onError;
    rec.onend = onEnd;
    rec.start();
    return () => rec.stop();
  } catch {
    onError();
    return null;
  }
}

export const hasSpeech = () =>
  typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
