import type { State, Tx } from "./types";
import { normalize, uid } from "./store";
import { isSealed, openWithPassword, sealWithPassword, type Sealed } from "./crypto";
import { exportPhotos, type PhotoExport } from "./photos";

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Downloads a full backup, including receipt photos. With a password, the file is encrypted
 * (AES-256). Returns how many photos went in.
 */
export async function exportJSON(state: State, password?: string): Promise<{ photos: number }> {
  const ids = state.txs.map((t) => t.photo).filter((x): x is string => !!x);
  let photos: Record<string, PhotoExport> = {};
  try {
    if (ids.length) photos = await exportPhotos(ids);
  } catch {
    /* photo storage unavailable: back up the data anyway */
  }
  const count = Object.keys(photos).length;
  // Photos ride alongside the data; older versions of the app simply ignore them.
  const payload = count ? { ...state, photos } : state;
  if (password) {
    const enc = await sealWithPassword(password, JSON.stringify(payload));
    download(`kwenta-backup-${stamp()}-protected.json`, JSON.stringify({ kwenta: "backup", protected: true, enc }), "application/json");
  } else {
    // Pretty-printed only without photos: indenting megabytes of photo text just wastes space.
    download(`kwenta-backup-${stamp()}.json`, count ? JSON.stringify(payload) : JSON.stringify(payload, null, 2), "application/json");
  }
  return { photos: count };
}

/** The sealed box inside a password-protected backup, if this file is one. */
export function protectedBox(text: string): Sealed | null {
  try {
    const j = JSON.parse(text);
    return j && j.protected && isSealed(j.enc) ? j.enc : null;
  } catch {
    return null;
  }
}

/** Decrypts a protected backup back to plain backup text. Throws on a wrong password. */
export async function unlockBackup(box: Sealed, password: string) {
  return openWithPassword(password, box);
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(state: State): string {
  const name = (id?: string) => state.accounts.find((a) => a.id === id)?.name ?? "";
  const rows = [["date", "type", "amount", "category", "note", "account", "to_account"]];
  for (const t of [...state.txs].sort((a, b) => a.date - b.date)) {
    rows.push([new Date(t.date).toISOString(), t.type, String(t.amount), t.cat, t.note, name(t.acc), name(t.to)]);
  }
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

export function exportCSV(state: State) {
  download(`kwenta-transactions-${stamp()}.csv`, toCSV(state), "text/csv");
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * Imports a JSON backup (replaces everything) or a CSV of transactions (appended).
 * For a backup, `photos` holds its receipt photos, to restore with importPhotos().
 */
export function importFile(text: string, current: State): { state: State; message: string; photos?: Record<string, PhotoExport> } {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    const raw = JSON.parse(trimmed);
    const s = normalize(raw);
    if (!s) throw new Error("That file isn’t a Kwenta backup.");
    const photos = raw && typeof raw.photos === "object" && raw.photos ? (raw.photos as Record<string, PhotoExport>) : undefined;
    const n = photos ? Object.keys(photos).length : 0;
    return {
      state: s,
      photos,
      message: `Restored ${s.txs.length} transactions and ${s.accounts.length} accounts${n ? ` and ${n} receipt photo${n === 1 ? "" : "s"}` : ""}.`,
    };
  }
  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const head = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (n: string) => head.indexOf(n);
  if (col("amount") < 0 || col("date") < 0) throw new Error("CSV needs at least “date” and “amount” columns.");

  const accounts = [...current.accounts];
  const accId = (name: string) => {
    if (!name) return current.defAcc;
    let a = accounts.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!a) {
      a = { id: uid(), name, opening: 0, kind: "bank", color: "#334155" };
      accounts.push(a);
    }
    return a.id;
  };

  const txs: Tx[] = [];
  for (const line of lines.slice(1)) {
    const c = parseCSVLine(line);
    const amount = Math.abs(parseFloat((c[col("amount")] ?? "").replace(/[^\d.-]/g, "")));
    const date = Date.parse(c[col("date")] ?? "");
    if (!amount || Number.isNaN(date)) continue;
    const rawType = (c[col("type")] ?? "expense").toLowerCase();
    const type = rawType === "income" || rawType === "transfer" ? rawType : "expense";
    txs.push({
      id: uid(),
      type,
      amount,
      cat: c[col("category")] || (type === "income" ? "Income" : "Other"),
      note: c[col("note")] || "Imported",
      acc: accId(c[col("account")] ?? ""),
      to: type === "transfer" ? accId(c[col("to_account")] ?? "") : undefined,
      date,
    });
  }
  return { state: { ...current, accounts, txs: [...current.txs, ...txs] }, message: `Imported ${txs.length} transactions.` };
}
