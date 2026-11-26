"use client";

import { FormEvent, useState } from "react";
import type { Ctx } from "@/lib/ui";
import { getInst } from "@/lib/institutions";
import { getCurrency } from "@/lib/currency";
import Mascot from "./Mascot";
import Testimonials from "./Testimonials";
import BankLogo from "./BankLogo";
import PaySchedule from "./PaySchedule";
import MoneyInput from "./MoneyInput";
import Icon from "./Icon";
import Emoji from "./Emoji";
import { markAccountOnboarded } from "@/lib/onboarded";

/** Popular first accounts: "cash" or an institution id. */
const QUICK = ["cash", "gcash", "maya", "gotyme", "maribank", "bdo", "bpi", "metrobank", "unionbank", "landbank"].filter((x) => x === "cash" || getInst(x));

type Step = "welcome" | "name" | "pay" | "account" | "pin" | "done";
const STEPS: Step[] = ["welcome", "name", "pay", "account", "pin", "done"];

/** First-run setup: name → sweldo schedule → first account → optional PIN. */
export default function Onboarding({ ctx, onFinish }: { ctx: Ctx; onFinish: (openSettings?: boolean) => void }) {
  const { k } = ctx;
  const s = k.state.settings;
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState(s.name ?? "");
  const [pick, setPick] = useState<string>("gcash");
  const [customName, setCustomName] = useState("");
  const [opening, setOpening] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const i = STEPS.indexOf(step);
  const next = () => setStep(STEPS[Math.min(STEPS.length - 1, i + 1)]);
  const back = () => setStep(STEPS[Math.max(0, i - 1)]);
  const base = getCurrency(s.currency || "PHP");

  function saveName(e: FormEvent) {
    e.preventDefault();
    k.updateSettings({ name: name.trim().slice(0, 30) });
    next();
  }

  function saveAccount(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(opening) || 0;
    if (pick === "cash") {
      k.addAccount({ name: "Cash", kind: "cash", color: "#0f766e", opening: amount });
    } else if (pick === "other") {
      const n = customName.trim();
      if (!n) return setError("Give your account a name.");
      k.addAccount({ name: n, kind: "bank", color: "#334155", opening: amount });
    } else {
      const inst = getInst(pick)!;
      k.addAccount({ name: inst.name.replace(/ \(formerly .*\)$/, "").replace(/ Unibank$/, ""), kind: inst.group === "ewallet" ? "ewallet" : "bank", color: inst.color, inst: inst.id, opening: amount });
    }
    setError("");
    next();
  }

  async function savePin(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) return setError("Use 4 to 6 digits.");
    if (pin !== pin2) return setError("The two PINs don’t match.");
    setBusy(true);
    await k.setPin(pin);
    setBusy(false);
    setError("");
    next();
  }

  function finish(openSettings = false) {
    k.updateSettings({ onboarded: true });
    void markAccountOnboarded(); // other devices on this account skip setup
    onFinish(openSettings);
  }

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label="Get started with Kwenta">
      {step !== "welcome" && step !== "done" && (
        <div className="ob-top">
          <button className="iconbtn" onClick={back} aria-label="Back">
            <Icon name="back" />
          </button>
          <div className="ob-dots" aria-label={`Step ${i} of 4`}>
            {STEPS.slice(1, 5).map((x, n) => (
              <i key={x} className={n + 1 <= i ? "on" : ""} />
            ))}
          </div>
          <span style={{ width: 40 }} />
        </div>
      )}

      <div className="ob-body" key={step}>
        {step === "welcome" && (
          <>
            <Mascot size={150} animated face="happy" />
            <h1>Hi! I’m Alki.</h1>
            <p className="ob-lead">I’ll help you keep track of every peso: what comes in, what goes out, and what you’re saving for.</p>
            <ul className="ob-points">
              <li><Emoji e="✍️" /> Log money by typing “lunch 180” or using the keypad</li>
              <li><Emoji e="🎯" /> Budgets, goals, bills and installments</li>
              <li><Emoji e="🔒" /> Private: everything stays on this phone</li>
            </ul>
            <Testimonials limit={6} more />
            <button className="btn wide big" onClick={next}>
              Get started
            </button>
            <button className="link" onClick={() => finish(true)}>
              I have a backup to restore
            </button>
          </>
        )}

        {step === "name" && (
          <form className="ob-form" onSubmit={saveName}>
            <Mascot size={96} face="wink" />
            <h2>What should I call you?</h2>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name or nickname" maxLength={30} autoFocus />
            <button className="btn wide big" type="submit">
              {name.trim() ? `Nice to meet you, ${name.trim().split(" ")[0]}!` : "Continue"}
            </button>
            <button type="button" className="link" onClick={next}>
              Skip
            </button>
          </form>
        )}

        {step === "pay" && (
          <div className="ob-form">
            <Mascot size={96} face="love" />
            <h2>When’s your sweldo?</h2>
            <p className="ob-lead">I’ll count down to payday and tell you how much you can spend each day.</p>
            <div className="card form">
              <PaySchedule ctx={ctx} />
            </div>
            <button className="btn wide big" onClick={next}>
              Continue
            </button>
          </div>
        )}

        {step === "account" && (
          <form className="ob-form" onSubmit={saveAccount}>
            <h2>Add your first account</h2>
            <p className="ob-lead">Where do you keep most of your money? You can add more later in Wallet.</p>
            <div className="ob-accs">
              {QUICK.map((id) => {
                const inst = id === "cash" ? undefined : getInst(id);
                return (
                  <button type="button" key={id} className="inst" aria-pressed={pick === id} onClick={() => setPick(id)}>
                    {inst ? (
                      <BankLogo inst={inst} size={40} />
                    ) : (
                      <BankLogo account={{ id: "c", name: "Cash", opening: 0, kind: "cash", color: "#0f766e" }} size={40} />
                    )}
                    <span>{inst ? inst.name.replace(/ \(formerly .*\)$/, "").replace(/ Unibank$/, "").replace(/ Bank$/, "") : "Cash"}</span>
                  </button>
                );
              })}
              <button type="button" className="inst" aria-pressed={pick === "other"} onClick={() => setPick("other")}>
                <span className="ob-other">＋</span>
                <span>Other</span>
              </button>
            </div>
            {pick === "other" && <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Account name, e.g. Security Bank" autoFocus />}
            <label className="ob-label">
              How much is in it right now?
              <MoneyInput value={opening} onChange={setOpening} placeholder="0" currency={base.code} />
            </label>
            {error && <p className="warnt">{error}</p>}
            <button className="btn wide big" type="submit">
              Add account
            </button>
          </form>
        )}

        {step === "pin" && (
          <form className="ob-form" onSubmit={savePin}>
            <Mascot size={96} look={{ eyes: "shades" }} />
            <h2>Lock Kwenta with a PIN?</h2>
            <p className="ob-lead">Your data gets encrypted on this phone and Kwenta asks for the PIN when it opens. You can change this later in Settings.</p>
            <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="PIN (4–6 digits)" autoComplete="off" />
            <input type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} placeholder="Type it again" autoComplete="off" />
            <p className="sub"><Emoji e="⚠️" /> If you forget the PIN, your data can’t be recovered, so keep backups.</p>
            {error && <p className="warnt">{error}</p>}
            <button className="btn wide big" type="submit" disabled={busy || pin.length < 4}>
              {busy ? "Setting up…" : "Set PIN"}
            </button>
            <button
              type="button"
              className="link"
              onClick={() => {
                setError("");
                next();
              }}
            >
              Not now
            </button>
          </form>
        )}

        {step === "done" && (
          <>
            <Mascot size={150} animated face="love" look={{ hand: "balloon" }} />
            <h1>You’re all set{s.name ? `, ${s.name.split(" ")[0]}` : ""}! <Emoji e="🎉" /></h1>
            <p className="ob-lead">Try telling me your first expense, like “lunch 180” or “grab 250 gcash”. I’ll do the math.</p>
            <button className="btn wide big" onClick={() => finish()}>
              Start using Kwenta
            </button>
          </>
        )}
      </div>
    </div>
  );
}
