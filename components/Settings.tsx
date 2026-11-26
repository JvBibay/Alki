"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import type { Ctx } from "@/lib/ui";
import type { Account as BankAccount, State, Theme } from "@/lib/types";
import { exportCSV, exportJSON, importFile, protectedBox, unlockBackup } from "@/lib/backup";
import { importPhotos, type PhotoExport } from "@/lib/photos";
import type { Sealed } from "@/lib/crypto";
import Sheet, { Modal } from "./Sheet";
import Icon from "./Icon";
import { DEFAULT_CUSTOM, isHex, PALETTES } from "@/lib/themes";
import ColorPicker from "./ColorPicker";
import { readableOn } from "@/lib/color";
import Mascot, { ALKI_SIZES } from "./Mascot";
import CurrencySettings from "./CurrencySettings";
import { lookOf } from "@/lib/closet";
import PaySchedule from "./PaySchedule";
import ReminderSettings from "./ReminderSettings";
import Emoji from "./Emoji";
import CloudSync from "./CloudSync";
import Plans from "./Plans";
import InstallGuide from "./InstallGuide";
import { isInstalled } from "@/lib/install";
import { describeAccess } from "@/lib/plans";
import PayEditor, { OtherPayEditor } from "./PayEditor";
import BankLogo from "./BankLogo";
import { payableAccounts, payStatus } from "@/lib/remindercard";
import { BioUnsupported, bioAvailable, bioEnrolled, clearBio, enrollBio } from "@/lib/biometric";
import Account, { RECOVERY_FLAG, useAccountEmail } from "./Account";
import { cloudConfigured } from "@/lib/supabase";
import Feedback from "./Feedback";
import { flushFeedback } from "@/lib/feedback";
import { unreadCount } from "@/lib/notices";

export default function Settings({ ctx }: { ctx: Ctx }) {
  const { k, toast, close } = ctx;
  const { state } = k;
  const s = state.settings;
  const unread = unreadCount(s.notices);
  const [armed, setArmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pinMode, setPinMode] = useState<"set" | "change" | "off" | null>(null);
  const [backupOpen, setBackupOpen] = useState<"backup" | "transfer" | null>(null);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  useEffect(() => void flushFeedback(), []);
  const [payAccount, setPayAccount] = useState<BankAccount | null>(null);
  const accountEmail = useAccountEmail();
  const [accountOpen, setAccountOpen] = useState(() => {
    try {
      return sessionStorage.getItem(RECOVERY_FLAG) === "1"; // arrived from a password-reset link
    } catch {
      return false;
    }
  });
  const [lockedFile, setLockedFile] = useState<Sealed | null>(null);
  const [pending, setPending] = useState<{ next: State; message: string; replace: boolean; photos?: Record<string, PhotoExport> } | null>(null);

  function prepareImport(text: string) {
    try {
      const { state: next, message, photos } = importFile(text, state);
      setPending({ next, message, photos, replace: text.trim().startsWith("{") });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn’t read that file.");
    }
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Backups with receipt photos can be several MB; 100 MB is still far above a real one.
    if (file.size > 100 * 1024 * 1024) return toast("That file is too large to be a Kwenta backup.");
    const text = await file.text();
    const box = protectedBox(text);
    if (box) setLockedFile(box);
    else prepareImport(text);
  }

  async function confirmImport() {
    if (!pending) return;
    let msg = pending.message;
    // Photos go back on the device first, so receipts show as soon as the data switches over.
    if (pending.photos) {
      try {
        await importPhotos(pending.photos);
      } catch {
        msg += " Receipt photos couldn’t be restored on this device.";
      }
    }
    await k.replaceAll(pending.next);
    setPending(null);
    toast(`${msg} Your previous data was kept as a safety copy.`, () => void k.restoreSafety());
  }

  return (
    <Sheet title="Settings" onClose={close}>
      {/* Plan and subscription: its own group, separate from cloud backup. */}
      {cloudConfigured() && (
        <details className="setgroup" open>
          <summary>
            <h2>Plan &amp; subscription</h2>
          </summary>
          <div className="card">
            <button className="row rowbtn" onClick={() => setPlanOpen(true)}>
              <div className="ico">
                <Icon name="check" size={20} />
              </div>
              <div className="main">
                <div className="t">{ctx.access.loaded ? describeAccess(ctx.access) : "Checking your plan…"}</div>
                <div className="s">{ctx.access.admin ? "Admin accounts keep every feature" : ctx.access.trial ? "See the plans and choose one before your trial ends" : "See Monthly, Annual and Lifetime plans"}</div>
              </div>
              <Icon name="chevron" size={18} />
            </button>
          </div>
        </details>
      )}
      {installOpen && <InstallGuide onClose={() => setInstallOpen(false)} />}
      {planOpen && (
        <Plans
          access={ctx.access}
          onClose={() => {
            setPlanOpen(false);
            ctx.access.refresh();
          }}
        />
      )}
      {/* One collapsible group: account, notifications and the two feedback rows. */}
      <details className="setgroup" open>
        <summary>
          <h2>Account &amp; updates</h2>
          {unread > 0 && <span className="newdot" aria-label={`${unread} unread notifications`}>{unread}</span>}
        </summary>
        <div className="card">
          {cloudConfigured() && (
            <button className="row rowbtn" onClick={() => setAccountOpen(true)}>
              <div className="ico">
                <Icon name="settings" size={20} />
              </div>
              <div className="main">
                <div className="t">{accountEmail ?? "Not signed in"}</div>
                <div className="s">{accountEmail ? "Manage your account, password and cloud backup" : "Sign in to back up your data to the cloud"}</div>
              </div>
            </button>
          )}
          {!isInstalled() && (
            <button className="row rowbtn" onClick={() => setInstallOpen(true)}>
              <div className="ico">
                <Icon name="download" size={20} />
              </div>
              <div className="main">
                <div className="t">Install Kwenta on your phone</div>
                <div className="s">Step-by-step for Android and iPhone</div>
              </div>
              <Icon name="chevron" size={18} />
            </button>
          )}
          <button className="row rowbtn" onClick={() => ctx.open({ kind: "notifications" })}>
            <div className="ico">
              <Icon name="bell" size={20} />
            </div>
            <div className="main">
              <div className="t">Notifications</div>
              <div className="s">{unread > 0 ? `${unread} new · badges you’ve earned` : "Badges you’ve earned show up here"}</div>
            </div>
            {unread > 0 && <span className="newdot">{unread}</span>}
            <Icon name="chevron" size={18} />
          </button>
          {cloudConfigured() && (
            <>
              <button className="row rowbtn" onClick={() => setFeedbackOpen(true)}>
                <div className="ico">
                  <Icon name="chat" size={20} />
                </div>
                <div className="main">
                  <div className="t">Send feedback</div>
                  <div className="s">Share an idea, report a problem or say what you like</div>
                </div>
              </button>
              <button className="row rowbtn" onClick={() => window.location.assign("/love")}>
                <div className="ico">
                  <Icon name="chat" size={20} />
                </div>
                <div className="main">
                  <div className="t">What people say</div>
                  <div className="s">Read stories from other Kwenta users</div>
                </div>
                <Icon name="chevron" size={18} />
              </button>
            </>
          )}
        </div>
      </details>
      {feedbackOpen && cloudConfigured() && <Feedback screen="settings" name={s.name} onClose={() => setFeedbackOpen(false)} toast={toast} />}

      <h2>Profile</h2>
      <div className="card form">
        <label>
          Your name
          <input value={s.name} onChange={(e) => k.updateSettings({ name: e.target.value.slice(0, 30) })} placeholder="So Alki can greet you" />
        </label>
        <PaySchedule ctx={ctx} />
        <label>
          Default account
          <select value={state.defAcc} onChange={(e) => k.setDefAcc(e.target.value)} disabled={state.accounts.length === 0}>
            {state.accounts.length === 0 && <option value="">No accounts yet</option>}
            {state.accounts.filter((a) => !a.archived).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <h2>Get paid</h2>
      <div className="card">
        {payableAccounts(state).length === 0 && !(s.payQr || s.payInfo?.trim()) ? (
          <p className="sub" style={{ padding: "12px 0" }}>
            Add an account in Wallet first, then set up how people can pay into it.
          </p>
        ) : (
          payableAccounts(state).map((a) => (
            <button key={a.id} className="row rowbtn" onClick={() => setPayAccount(a)}>
              <div className="ico">
                <BankLogo account={a} size={28} />
              </div>
              <div className="main">
                <div className="t">{a.name}</div>
                <div className="s">{payStatus(a)}</div>
              </div>
              <span className="link">{a.payQr || a.payNumber || a.payName || a.payInfo ? "Edit" : "Set up"}</span>
            </button>
          ))
        )}
        {(s.payQr || s.payInfo?.trim()) && (
          <button className="row rowbtn" onClick={() => setOtherOpen(true)}>
            <div className="ico">
              <Icon name="send" size={20} />
            </div>
            <div className="main">
              <div className="t">Other details</div>
              <div className="s">Not tied to an account · {[s.payQr ? "QR" : "", s.payInfo?.trim() ? "details" : ""].filter(Boolean).join(" · ")} saved</div>
            </div>
            <span className="link">Edit</span>
          </button>
        )}
      </div>
      <p className="hint">Save each account’s QR and number once. When you remind someone, you pick which account they should pay into. Details are only added to a card when you tick them, and stay on this device and in your encrypted cloud backup.</p>

      <h2>Currency</h2>
      <CurrencySettings ctx={ctx} />

      <h2>Appearance</h2>
      <div className="themecards" role="radiogroup" aria-label="Theme">
        {([
          ["system", "System"],
          ["light", "Light"],
          ["dark", "Dark"],
          ["amoled", "AMOLED"],
        ] as [Theme, string][]).map(([t, label]) => (
          <button key={t} className="themecard" role="radio" aria-checked={s.theme === t} onClick={() => k.updateSettings({ theme: t })}>
            <span className={`tp ${t}`} aria-hidden="true">
              <i className="tbar" />
              <i className="tdot" />
              <i className="tcard" />
              <i className="tline" />
              <i className="tline2" />
              <i className="trow" style={{ top: "70%" }} />
              <i className="trow" style={{ top: "80%" }} />
            </span>
            {label}
          </button>
        ))}
      </div>
      <p className="hint">{s.theme === "amoled" ? "Pure-black backgrounds for OLED and AMOLED screens." : s.theme === "system" ? "Matches your phone’s light or dark setting." : " "}</p>

      <h2>Alki</h2>
      <div className="card alkisettings">
        <div className="alkipreview">
          <Mascot size={ALKI_SIZES[s.alkiSize ?? "medium"].wallet} look={lookOf(s)} animated={s.alkiMotion !== false} />
        </div>
        <div className="main">
          <div className="eyebrow">Size</div>
          <div className="seg small" role="tablist">
            {(["small", "medium", "large"] as const).map((z) => (
              <button key={z} role="tab" aria-selected={(s.alkiSize ?? "medium") === z} onClick={() => k.updateSettings({ alkiSize: z })}>
                {z[0].toUpperCase() + z.slice(1)}
              </button>
            ))}
          </div>
          <div className="eyebrow" style={{ marginTop: 10 }}>
            Movement
          </div>
          <div className="seg small" role="tablist">
            {([true, false] as const).map((m) => (
              <button key={String(m)} role="tab" aria-selected={(s.alkiMotion !== false) === m} onClick={() => k.updateSettings({ alkiMotion: m })}>
                {m ? "On" : "Off"}
              </button>
            ))}
          </div>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => ctx.open({ kind: "closet" })}>
            <Emoji e="👕" /> Dress up Alki
          </button>
        </div>
      </div>

      <h2>App color</h2>
      <div className="swatches" role="radiogroup" aria-label="App color">
        {PALETTES.map((p) => (
          <button
            key={p.id}
            className="swatch"
            role="radio"
            aria-checked={(s.palette || "forest") === p.id}
            aria-label={p.name}
            title={p.name}
            style={{ background: p.band }}
            onClick={() => k.updateSettings({ palette: p.id })}
          >
            {(s.palette || "forest") === p.id && <Icon name="check" size={22} />}
          </button>
        ))}
        <button
          type="button"
          className="swatch custom"
          role="radio"
          aria-checked={s.palette === "custom"}
          aria-haspopup="dialog"
          title="Pick your own color"
          // Once chosen, the swatch shows your color (not the rainbow) so you can see what you picked.
          style={s.palette === "custom" && isHex(s.customColor) ? { background: s.customColor, color: readableOn(s.customColor), textShadow: "none" } : undefined}
          onClick={() => setColorOpen(true)}
        >
          {s.palette === "custom" ? "Custom ✓" : "Custom"}
        </button>
      </div>
      {colorOpen && (
        <ColorPicker
          value={isHex(s.customColor) ? s.customColor : DEFAULT_CUSTOM}
          onClose={() => setColorOpen(false)}
          onUse={(hex) => {
            k.updateSettings({ palette: "custom", customColor: hex });
            setColorOpen(false);
          }}
        />
      )}
      <p className="hint">{(s.palette === "custom" ? "Custom" : PALETTES.find((p) => p.id === (s.palette || "forest"))?.name) ?? ""} · changes the header, buttons and charts.</p>

      <h2>Reminders</h2>
      <ReminderSettings ctx={ctx} />

      <h2>Security</h2>
      <div className="card securitycard">
        <div className="status">
          <span aria-hidden="true">{k.lockOn ? "🔒" : "🔓"}</span>
          {k.lockOn ? "PIN lock is on · data encrypted on this device" : "PIN lock is off"}
        </div>
        {k.lockOn ? (
          <>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                Lock after leaving the app
              </div>
              <div className="seg small" role="tablist">
                {(
                  [
                    [0, "Right away"],
                    [1, "1 min"],
                    [5, "5 min"],
                    [15, "15 min"],
                  ] as [number, string][]
                ).map(([m, label]) => (
                  <button key={m} role="tab" aria-selected={(s.autoLock ?? 1) === m} onClick={() => k.updateSettings({ autoLock: m })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="formrow">
              <button
                className="btn sm"
                onClick={() => {
                  close();
                  k.lock();
                }}
              >
                Lock now
              </button>
              <button className="btn ghost sm" onClick={() => setPinMode("change")}>
                Change PIN
              </button>
              <button className="btn ghost sm" onClick={() => setPinMode("off")}>
                Turn off
              </button>
            </div>
            <BioRow ctx={ctx} />
          </>
        ) : (
          <>
            <p className="sub">Ask for a PIN when Kwenta opens, and encrypt your data on this device so others can’t read it.</p>
            <button className="btn sm" onClick={() => setPinMode("set")}>
              Turn on PIN lock
            </button>
          </>
        )}
      </div>

      <h2>Your data</h2>
      <div className="card">
        <button className="row rowbtn" onClick={() => setBackupOpen("backup")}>
          <div className="ico">
            <Icon name="download" size={20} />
          </div>
          <div className="main">
            <div className="t">Back up everything (JSON)</div>
            <div className="s">All your Kwenta data and receipt photos. Password protection is optional.</div>
          </div>
        </button>
        {cloudConfigured() && (
          <button className="row rowbtn" onClick={() => setCloudOpen(true)}>
            <div className="ico">
              <Icon name="upload" size={20} />
            </div>
            <div className="main">
              <div className="t">Cloud backup</div>
              <div className="s">Sign in and keep an end-to-end encrypted copy of your data (no receipt photos).</div>
            </div>
          </button>
        )}
        <button className="row rowbtn" onClick={() => setBackupOpen("transfer")}>
          <div className="ico">
            <Icon name="download" size={20} />
          </div>
          <div className="main">
            <div className="t">Move data to another device</div>
            <div className="s">Create an encrypted file, move it locally, then import it on your new device. No cloud sync.</div>
          </div>
        </button>
        <button className="row rowbtn" onClick={() => exportCSV(state)}>
          <div className="ico">
            <Icon name="download" size={20} />
          </div>
          <div className="main">
            <div className="t">Export transactions (CSV)</div>
            <div className="s">Opens in Excel or Google Sheets. Not encrypted.</div>
          </div>
        </button>
        <button className="row rowbtn" onClick={() => fileRef.current?.click()}>
          <div className="ico">
            <Icon name="upload" size={20} />
          </div>
          <div className="main">
            <div className="t">Import</div>
            <div className="s">On a new device, select the encrypted JSON and enter its transfer password. JSON replaces data; CSV adds transactions. You’ll confirm first.</div>
          </div>
        </button>
        {k.hasSafety && (
          <button
            className="row rowbtn"
            onClick={async () => toast((await k.restoreSafety()) ? "Restored your data from before the last import." : "No safety copy to restore.")}
          >
            <div className="ico">
              <Icon name="history" size={20} />
            </div>
            <div className="main">
              <div className="t">Undo last import</div>
              <div className="s">Go back to the data you had before importing</div>
            </div>
          </button>
        )}
        <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" hidden onChange={onFile} />
      </div>

      <div className="privacy card">
        <b><Emoji e="🔒" /> Private by default</b>
        <p className="sub">Everything is saved only on this device unless you manually transfer a backup or turn on the optional encrypted cloud backup. There is no tracking. Typing to Alki works offline and never leaves your device.</p>
        <p className="sub" style={{ marginTop: 6 }}>
          <Emoji e="🎙️" /> <b>Voice input</b> uses your browser’s speech service to turn speech into text. In Chrome that means your voice is sent to Google; type instead if
          you’d rather not.
        </p>
        <p className="sub" style={{ marginTop: 6 }}>Back up now and then: clearing browser data or uninstalling the app deletes everything.</p>
        <p className="sub" style={{ marginTop: 6 }}>
          <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a> · <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>
        </p>
      </div>

      {pinMode && <PinModal mode={pinMode} ctx={ctx} onClose={() => setPinMode(null)} />}
      {payAccount && <PayEditor ctx={ctx} account={payAccount} onClose={() => setPayAccount(null)} />}
      {otherOpen && <OtherPayEditor ctx={ctx} onClose={() => setOtherOpen(false)} />}
      {accountOpen && <Account ctx={ctx} onClose={() => setAccountOpen(false)} />}
      {cloudOpen && <CloudSync ctx={ctx} onClose={() => setCloudOpen(false)} />}
      {backupOpen && <BackupModal ctx={ctx} mode={backupOpen} onClose={() => setBackupOpen(null)} />}
      {lockedFile && (
        <PasswordModal
          onClose={() => setLockedFile(null)}
          onSubmit={async (pw) => {
            try {
              const text = await unlockBackup(lockedFile, pw);
              setLockedFile(null);
              prepareImport(text);
              return true;
            } catch {
              return false;
            }
          }}
        />
      )}
      {pending && (
        <Modal title={pending.replace ? "Replace all data?" : "Add transactions?"} onClose={() => setPending(null)}>
          <div className="form">
            <p>
              {pending.replace
                ? `This backup has ${pending.next.txs.length} transactions, ${pending.next.accounts.length} accounts${pending.photos && Object.keys(pending.photos).length ? ` and ${Object.keys(pending.photos).length} receipt photos` : ""}. It will replace everything currently in Kwenta.`
                : pending.message}
            </p>
            <p className="sub">Your current data is kept as a safety copy, so you can undo this from Settings.</p>
            <button className={`btn ${pending.replace ? "danger" : ""}`} onClick={() => void confirmImport()}>
              {pending.replace ? "Replace my data" : "Add them"}
            </button>
            <button className="btn ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      <button
        className={`btn wide ${armed ? "danger" : "ghost"}`}
        style={{ marginTop: 16 }}
        onClick={() => {
          if (!armed) return setArmed(true);
          k.reset();
          setArmed(false);
          toast("All data erased.");
        }}
      >
        {armed ? "Tap again to erase everything" : "Reset all data"}
      </button>
    </Sheet>
  );
}



const PIN_RE = /^\d{4,6}$/;

function PinModal({ mode, ctx, onClose }: { mode: "set" | "change" | "off"; ctx: Ctx; onClose: () => void }) {
  const { k, toast } = ctx;
  const [current, setCurrent] = useState("");
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const needCurrent = mode !== "set";
  const needNew = mode !== "off";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (needNew && !PIN_RE.test(pin)) return setError("Use 4 to 6 digits.");
    if (needNew && pin !== again) return setError("The two PINs don’t match.");
    setBusy(true);
    if (needCurrent && !(await k.verifyPin(current))) {
      setBusy(false);
      return setError("Current PIN is wrong.");
    }
    const hadBio = bioEnrolled();
    if (mode === "off") await k.removePin();
    else await k.setPin(pin);
    if (mode !== "set") clearBio(); // the saved fingerprint unlock holds the old PIN, so it must be set up again
    setBusy(false);
    const bioNote = hadBio && mode !== "set" ? " Fingerprint unlock was turned off. Turn it on again in Settings if you like." : "";
    toast((mode === "set" ? "PIN lock is on. Your data is now encrypted." : mode === "change" ? "PIN changed." : "PIN lock turned off.") + bioNote);
    onClose();
  }

  const field = (label: string, value: string, set: (v: string) => void, auto?: boolean) => (
    <label>
      {label}
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        autoFocus={auto}
        onChange={(e) => set(e.target.value.replace(/\D/g, ""))}
      />
    </label>
  );

  return (
    <Modal title={mode === "set" ? "Set a PIN" : mode === "change" ? "Change PIN" : "Turn off PIN lock"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {needCurrent && field("Current PIN", current, setCurrent, true)}
        {needNew && field(mode === "change" ? "New PIN (4–6 digits)" : "PIN (4–6 digits)", pin, setPin, !needCurrent)}
        {needNew && field("Type it again", again, setAgain)}
        {mode === "off" && <p className="sub">Your data will be stored unencrypted on this device again.</p>}
        {mode === "set" && <p className="sub"><Emoji e="⚠️" /> If you forget this PIN, your data can’t be recovered. Keep a backup somewhere safe.</p>}
        {error && <p className="warnt">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "Working…" : mode === "off" ? "Turn off" : "Save PIN"}
        </button>
      </form>
    </Modal>
  );
}

/** Optional fingerprint unlock, shown under the PIN controls. Only offered where the phone can do it securely. */
function BioRow({ ctx }: { ctx: Ctx }) {
  const [avail, setAvail] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void bioAvailable().then(setAvail);
    setOn(bioEnrolled());
  }, []);

  if (avail === null) return null;
  if (!avail) {
    return (
      <p className="sub">
        <b>Fingerprint unlock</b> isn’t available on this device.
      </p>
    );
  }
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        Fingerprint unlock (optional)
      </div>
      <p className="sub" style={{ marginBottom: 8 }}>
        {on
          ? "On. Use your fingerprint or phone lock on the lock screen. Your PIN always still works."
          : "Unlock faster with your fingerprint or phone lock. Your fingerprint stays on your phone, and your PIN remains the backup."}
      </p>
      {on ? (
        <button
          className="btn ghost sm"
          onClick={() => {
            clearBio();
            setOn(false);
            ctx.toast("Fingerprint unlock turned off.");
          }}
        >
          Turn off fingerprint
        </button>
      ) : (
        <button className="btn sm" onClick={() => setOpen(true)}>
          Turn on fingerprint
        </button>
      )}
      {open && (
        <BioModal
          ctx={ctx}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOn(true);
            setOpen(false);
            ctx.toast("Fingerprint unlock is on.");
          }}
        />
      )}
    </div>
  );
}

function BioModal({ ctx, onClose, onDone }: { ctx: Ctx; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!(await ctx.k.verifyPin(pin))) return setError("That PIN is wrong.");
      await enrollBio(pin); // asks for the fingerprint, then stores the PIN encrypted under the passkey
      onDone();
    } catch (err) {
      if (err instanceof BioUnsupported) setError(err.message + " Your PIN works as usual.");
      else if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "AbortError")) setError("The fingerprint prompt was cancelled. Try again.");
      else setError("Couldn’t turn on fingerprint unlock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Turn on fingerprint" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Enter your PIN to confirm
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} autoFocus onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        </label>
        <p className="sub">
          Next your phone will ask for your fingerprint or screen lock. Your fingerprint never leaves your phone, and Kwenta only keeps your PIN encrypted so that only that fingerprint can open it.
          If you change your PIN, you’ll need to turn this on again.
        </p>
        {error && <p className="warnt">{error}</p>}
        <button className="btn" type="submit" disabled={busy || pin.length < 4}>
          {busy ? "Waiting…" : "Continue"}
        </button>
      </form>
    </Modal>
  );
}

function BackupModal({ ctx, mode, onClose }: { ctx: Ctx; mode: "backup" | "transfer"; onClose: () => void }) {
  const transfer = mode === "transfer";
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (transfer && !pw) return setError("Set a password to encrypt the transfer file.");
    if (pw && pw.length < (transfer ? 8 : 6)) return setError(`Use at least ${transfer ? 8 : 6} characters${transfer ? "" : ", or leave it empty"}.`);
    if (pw && pw !== again) return setError("The passwords don’t match.");
    setBusy(true);
    try {
      const { photos } = await exportJSON(ctx.k.state, pw || undefined);
      const withPhotos = photos ? ` Includes ${photos} receipt photo${photos === 1 ? "" : "s"}.` : "";
      ctx.toast((transfer ? "Encrypted transfer file downloaded." : pw ? "Protected backup downloaded." : "Backup downloaded. It isn’t password-protected.") + withPhotos);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? `Couldn’t create the file: ${err.message}` : "Couldn’t create the file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={transfer ? "Move data to another device" : "Back up everything"} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          {transfer ? "Transfer password" : "Password (recommended)"}
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={transfer ? "At least 8 characters" : "Leave empty for no password"} autoFocus />
        </label>
        {pw && (
          <label>
            Type it again
            <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
          </label>
        )}
        <p className="sub">
          {transfer
            ? "This creates an encrypted file on this device. Move it using a cable or local file sharing, then choose Import on the new device and enter the same password. Nothing is uploaded. Set a PIN separately on the new device; the transfer password can’t be recovered."
            : "With a password the file is encrypted, so anyone who finds it can’t read your finances. You’ll need the password to import it, and it can’t be recovered if lost. Receipt photos are included, so the file can be a few MB."}
        </p>
        {error && <p className="warnt">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>
          <Icon name="download" size={18} /> {busy ? "Preparing…" : transfer ? "Create encrypted transfer file" : "Download backup"}
        </button>
      </form>
    </Modal>
  );
}

function PasswordModal({ onSubmit, onClose }: { onSubmit: (pw: string) => Promise<boolean>; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Protected backup" onClose={onClose}>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ok = await onSubmit(pw);
          setBusy(false);
          if (!ok) setError("Wrong password, or the file is damaged.");
        }}
      >
        <label>
          Backup password
          <input type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        </label>
        {error && <p className="warnt">{error}</p>}
        <button className="btn" type="submit" disabled={busy || !pw}>
          {busy ? "Unlocking…" : "Unlock backup"}
        </button>
      </form>
    </Modal>
  );
}
