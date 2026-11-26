"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Account } from "@/lib/types";
import { cleanNumber, payableAccounts } from "@/lib/remindercard";
import { GROUP_LABEL, INSTITUTIONS, guessInst, type InstGroup } from "@/lib/institutions";
import { Modal } from "./Sheet";
import BankLogo from "./BankLogo";
import Icon from "./Icon";
import QrCrop from "./QrCrop";

/**
 * Where people can pay you for one account: its name, number, other details and its own payment QR. This is
 * the same information as the "Get paid into this account" part of the account form, in one place you can
 * reach from Settings, the account screen and the reminder dialog.
 */
export default function PayEditor({ ctx, account, onClose, onSaved }: { ctx: Ctx; account: Account; onClose: () => void; onSaved?: (accountId: string) => void }) {
  const { k, toast } = ctx;
  const [name, setName] = useState(account.payName ?? "");
  const [number, setNumber] = useState(account.payNumber ?? "");
  const [info, setInfo] = useState(account.payInfo ?? "");
  const [qr, setQr] = useState<string | undefined>(account.payQr);
  const [file, setFile] = useState<File | null>(null);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f); // QrCrop checks the type and size
  }

  function save(e: FormEvent) {
    e.preventDefault();
    k.updateAccount(account.id, {
      payName: name.trim().slice(0, 40) || undefined,
      payNumber: cleanNumber(number),
      payInfo: info.trim().slice(0, 80) || undefined,
      payQr: qr,
    });
    toast(`Saved how to pay ${account.name}`);
    onSaved?.(account.id);
    onClose();
  }

  return (
    <>
      <Modal title="How to pay this account" onClose={onClose}>
        <form className="form" onSubmit={save}>
          <div className="picked">
            <BankLogo account={account} size={44} />
            <div className="main">
              <div className="t">{account.name}</div>
              <div className="s">Shown on reminder cards when you pick this account</div>
            </div>
          </div>
          <div className="formrow">
            <label>
              Account name
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="e.g. Jose Vincent B." maxLength={40} autoComplete="off" />
            </label>
            <label>
              Account number
              <input value={number} onChange={(e) => setNumber(e.target.value.replace(/[^\d\s-]/g, "").slice(0, 24))} placeholder="e.g. 0123 4567 8901" inputMode="numeric" autoComplete="off" />
            </label>
          </div>
          <label>
            Other details (optional)
            <input value={info} onChange={(e) => setInfo(e.target.value.slice(0, 80))} placeholder="e.g. InstaPay or PESONet is fine" maxLength={80} />
          </label>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Payment QR (optional)
            </div>
            {qr ? (
              <div className="qrprev">
                <img src={qr} alt={`Payment QR for ${account.name}`} />
                <div className="formrow" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <label className="btn ghost sm filebtn">
                    Replace
                    <input type="file" accept="image/*" hidden onChange={pick} />
                  </label>
                  <button type="button" className="btn ghost sm" onClick={() => setQr(undefined)}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="btn ghost sm filebtn">
                <Icon name="upload" size={16} /> Upload QR
                <input type="file" accept="image/*" hidden onChange={pick} />
              </label>
            )}
          </div>
          <p className="hint" style={{ marginTop: -2 }}>
            Screenshot this account’s QR from its app and upload the whole picture. Kwenta finds the QR and crops it for you.
          </p>
          <button className="btn" type="submit">
            Save
          </button>
        </form>
      </Modal>
      {file && (
        <QrCrop
          file={file}
          onClose={() => setFile(null)}
          onDone={(url) => {
            setQr(url);
            setFile(null);
          }}
        />
      )}
    </>
  );
}

/**
 * Details that aren't tied to an account (kept from before accounts had their own). They show as "Other details"
 * on a reminder. Best moved onto one of your accounts, which this can do in one tap.
 */
export function OtherPayEditor({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const { k, toast } = ctx;
  const s = k.state.settings;
  const [info, setInfo] = useState(s.payInfo ?? "");
  const [qr, setQr] = useState<string | undefined>(s.payQr);
  const [bank, setBank] = useState(s.payQrBank ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [moveTo, setMoveTo] = useState("");
  const accounts = payableAccounts(k.state);

  function pick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f); // QrCrop checks the type and size
  }

  function save(e: FormEvent) {
    e.preventDefault();
    k.updateSettings({ payInfo: info.trim().slice(0, 80) || undefined, payQr: qr, payQrBank: qr ? bank || undefined : undefined });
    toast("Saved other details");
    onClose();
  }

  function clear() {
    k.updateSettings({ payInfo: undefined, payQr: undefined, payQrBank: undefined });
    toast("Removed other details");
    onClose();
  }

  function move() {
    const target = k.state.accounts.find((a) => a.id === moveTo);
    if (!target) return;
    k.updateAccount(target.id, { payQr: qr ?? target.payQr, payInfo: info.trim().slice(0, 80) || target.payInfo });
    k.updateSettings({ payInfo: undefined, payQr: undefined, payQrBank: undefined });
    toast(`Moved to ${target.name}`);
    onClose();
  }

  return (
    <>
      <Modal title="Other details" onClose={onClose}>
        <form className="form" onSubmit={save}>
          <p className="sub">These aren’t tied to an account. Move them onto an account below, and you can pick it each time you send a reminder.</p>
          <label>
            Payment details
            <input value={info} onChange={(e) => setInfo(e.target.value.slice(0, 80))} placeholder="e.g. GCash 0917 123 4567 · Jose B." maxLength={80} />
          </label>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Payment QR (optional)
            </div>
            {qr ? (
              <div className="qrprev">
                <img src={qr} alt="Your saved payment QR" />
                <div className="formrow" style={{ flexDirection: "column", alignItems: "stretch" }}>
                  <label className="btn ghost sm filebtn">
                    Replace
                    <input type="file" accept="image/*" hidden onChange={pick} />
                  </label>
                  <button type="button" className="btn ghost sm" onClick={() => setQr(undefined)}>
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label className="btn ghost sm filebtn">
                <Icon name="upload" size={16} /> Upload QR
                <input type="file" accept="image/*" hidden onChange={pick} />
              </label>
            )}
          </div>
          {qr && (
            <label>
              Which bank or app is this QR from?
              <select value={bank} onChange={(e) => setBank(e.target.value)}>
                <option value="">Don’t show a bank</option>
                {(["ewallet", "digital", "bank", "gov"] as InstGroup[]).map((g) => (
                  <optgroup key={g} label={GROUP_LABEL[g]}>
                    {INSTITUTIONS.filter((i) => i.group === g).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name.replace(/\s*\(.*\)$/, "")}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          )}
          {accounts.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                Move these to one of your accounts
              </div>
              <div className="formrow">
                <select aria-label="Move these details to an account" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} style={{ flex: 1 }}>
                  <option value="">Choose an account…</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn sm" disabled={!moveTo} onClick={move}>
                  Move
                </button>
              </div>
            </div>
          )}
          <button className="btn" type="submit">
            Save
          </button>
          <button type="button" className="btn ghost" onClick={clear}>
            Remove these details
          </button>
        </form>
      </Modal>
      {file && (
        <QrCrop
          file={file}
          onClose={() => setFile(null)}
          onDone={(url) => {
            setQr(url);
            if (!bank) setBank(guessInst(info, "bank")?.id ?? "");
            setFile(null);
          }}
        />
      )}
    </>
  );
}
