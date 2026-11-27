"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Ctx } from "@/lib/ui";
import type { Account, Debt } from "@/lib/types";
import type { PersonSummary } from "@/lib/people";
import { fmt, shortDate } from "@/lib/format";
import { lookOf } from "@/lib/closet";
import { getInst } from "@/lib/institutions";
import { LOGOS } from "@/lib/logos.generated";
import { resolvePalette } from "@/lib/themes";
import { defaultMethod, drawReminderCard, maskNumber, payMethods, payableAccounts, payStatus, prettyNumber, reminderContent, reminderText } from "@/lib/remindercard";
import { Modal } from "./Sheet";
import Mascot from "./Mascot";
import BankLogo from "./BankLogo";
import PayEditor from "./PayEditor";
import Icon from "./Icon";

/**
 * A reminder you can send as a picture: what they owe, a short message, and (if you like) your payment
 * details and your own payment QR. The image is made on this device; nothing is uploaded.
 */
export default function ReminderCard({ ctx, p, onClose }: { ctx: Ctx; p: PersonSummary; onClose: () => void }) {
  const { k, toast } = ctx;
  const s = k.state.settings;
  const splits = k.state.splits ?? [];
  const content = useMemo(
    () => reminderContent(p, (n) => fmt(n, true), shortDate, (d: Debt) => splits.find((x) => x.id === d.splitId)?.title),
    [p, splits],
  );
  // Where they should pay: an account with its own details and QR (defaulting to the one the money was lent from).
  const methods = useMemo(() => payMethods(k.state), [k.state]);
  const [methodId, setMethodId] = useState(() => defaultMethod(methods, p));
  const method = methods.find((m) => m.id === methodId);
  const hasAcct = !!(method?.name || method?.number);
  const hasInfo = !!method?.info;
  const hasQr = !!method?.qr;
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [message, setMessage] = useState("Just a friendly reminder about your utang. Salamat!");
  const [useAcct, setUseAcct] = useState(true);
  const [hideNum, setHideNum] = useState(false);
  const [useInfo, setUseInfo] = useState(true);
  const [useQr, setUseQr] = useState(true);
  const showAcct = useAcct && hasAcct;
  const showInfo = useInfo && hasInfo;
  const showQr = useQr && hasQr;
  // The account number as it will appear: neatly spaced, and optionally hiding all but the last 4 digits.
  const shownNumber = showAcct && method?.number ? (hideNum ? maskNumber(prettyNumber(method.number)) : prettyNumber(method.number)) : undefined;
  const shownName = showAcct ? method?.name : undefined;
  // The bank's logo and name (or the account's own logo), shown whenever something about where to pay is on the card.
  const bank = useMemo(() => {
    if (!method || !(showQr || showInfo || showAcct)) return undefined;
    const inst = getInst(method.instId);
    const own = method.account;
    if (inst) return { name: inst.name.replace(/\s*\(.*\)$/, ""), short: inst.short, color: inst.color, logoUrl: own?.logo || (LOGOS[inst.logo] ? `/logos/${LOGOS[inst.logo]}` : undefined) };
    if (own?.logo) return { name: own.name, short: own.name, color: own.color, logoUrl: own.logo };
    return undefined;
  }, [method, showQr, showInfo, showAcct]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(true);
  const blob = useRef<Blob | null>(null);
  const urlRef = useRef("");

  // Redraw the preview whenever something changes (after a short pause while typing).
  useEffect(() => {
    if (!content) return;
    let alive = true;
    setBusy(true);
    const t = setTimeout(async () => {
      const palette = resolvePalette(s.palette || "forest", s.customColor);
      // Alki, as he's dressed in the app, drawn into the card.
      const { scene: _scene, ...look } = lookOf(s);
      void _scene;
      const alki = renderToStaticMarkup(<Mascot size={232} face="happy" look={look} />).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      try {
        const canvas = await drawReminderCard({
          ...content,
          to: p.name,
          from: s.name,
          message,
          payName: shownName,
          payNumber: shownNumber,
          payInfo: showInfo ? method?.info : undefined,
          qr: showQr ? method?.qr : undefined,
          bank,
          style: { band: palette.band, accent: palette.accent, alki },
        });
        canvas.toBlob((b) => {
          if (!alive || !b) return;
          blob.current = b;
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = URL.createObjectURL(b);
          setUrl(urlRef.current);
          setBusy(false);
        }, "image/png");
      } catch {
        if (alive) setBusy(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // The palette, name and look come from settings, which change rarely; redraw when the choices change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, message, showInfo, showQr, shownName, shownNumber, bank, method, s.palette, s.customColor, s.name, p.name]);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const text = content ? reminderText(p.name, content, message, showAcct || showInfo || showQr ? { bank: bank?.name, name: shownName, number: shownNumber, info: showInfo ? method?.info : undefined } : undefined) : "";
  const fileName = `kwenta-reminder-${p.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.png`;

  function download() {
    const b = blob.current;
    if (!b) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function shareImage() {
    const b = blob.current;
    if (!b) return;
    const file = new File([b], fileName, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        download();
        toast("Image saved. Attach it in your chat.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // share sheet closed
      download();
      toast("Couldn’t open sharing, so the image was saved instead.");
    }
  }

  async function shareText() {
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Reminder copied. Paste it in your chat.");
      }
    } catch {
      /* share sheet closed */
    }
  }

  if (!content) {
    return (
      <Modal title="Reminder" onClose={onClose}>
        <p className="sub">{p.name} doesn’t owe you anything overall, so there’s nothing to remind them about.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Reminder card" onClose={onClose}>
      <div className="form">
        <div className="rc-preview" aria-busy={busy}>
          {url ? <img src={url} alt={`Reminder card for ${p.name}`} /> : <div className="rc-wait">Making your card…</div>}
        </div>

        <label>
          Message
          <input value={message} onChange={(e) => setMessage(e.target.value.slice(0, 120))} maxLength={120} />
        </label>

        {methods.length > 0 ? (
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Where should they pay?
            </div>
            <div className="accchips" role="radiogroup" aria-label="Pay into">
              {methods.map((m) => (
                <button key={m.id} type="button" className="accchip" role="radio" aria-checked={methodId === m.id} onClick={() => setMethodId(m.id)}>
                  {m.account ? <BankLogo account={m.account} size={28} /> : null}
                  {m.label}
                </button>
              ))}
              <button type="button" className="accchip" role="radio" aria-checked={methodId === ""} onClick={() => setMethodId("")}>
                No payment details
              </button>
            </div>
          </div>
        ) : (
          <p className="hint">Add your account name, number or QR so people know where to pay. You can set up as many accounts as you like and pick one each time.</p>
        )}
        <button type="button" className="btn ghost sm" onClick={() => setPicking(true)}>
          <Icon name="plus" size={16} /> Add or edit an account’s QR and details
        </button>
        {method && (
          <>
            <label className="check">
              <input type="checkbox" checked={useAcct} disabled={!hasAcct} onChange={(e) => setUseAcct(e.target.checked)} />
              <span>
                Include the account name and number
                {hasAcct ? ` (${[method.name, method.number ? prettyNumber(method.number) : ""].filter(Boolean).join(" · ")})` : " (none saved for this one)"}
              </span>
            </label>
            {method.number && showAcct && (
              <label className="check">
                <input type="checkbox" checked={hideNum} onChange={(e) => setHideNum(e.target.checked)} />
                <span>Hide part of the number (show only the last 4 digits)</span>
              </label>
            )}
            <label className="check">
              <input type="checkbox" checked={useInfo} disabled={!hasInfo} onChange={(e) => setUseInfo(e.target.checked)} />
              <span>Include other details{hasInfo ? ` (${method.info})` : " (none saved for this one)"}</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={useQr} disabled={!hasQr} onChange={(e) => setUseQr(e.target.checked)} />
              <span>Include the QR{hasQr ? "" : " (none saved for this one)"}</span>
            </label>
          </>
        )}
        {(showQr || showInfo) && <p className="hint" style={{ marginTop: -4 }}>Anyone who gets this picture can see these details, so only send it to people you trust.</p>}

        {method?.number && (
          <button
            type="button"
            className="btn ghost sm"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(prettyNumber(method.number!));
                toast("Account number copied.");
              } catch {
                toast("Couldn’t copy on this device.");
              }
            }}
          >
            <Icon name="copy" size={16} /> Copy account number
          </button>
        )}
        <button className="btn" onClick={() => void shareImage()} disabled={busy || !url}>
          <Icon name="send" size={18} /> Share image
        </button>
        <div className="formrow">
          <button className="btn ghost" style={{ flex: 1 }} onClick={download} disabled={busy || !url}>
            <Icon name="download" size={18} /> Save image
          </button>
          <button className="btn ghost" style={{ flex: 1 }} onClick={() => void shareText()}>
            Send as text
          </button>
        </div>
      </div>
      {picking && (
        <Modal title="Which account?" onClose={() => setPicking(false)}>
          <div className="card" style={{ boxShadow: "none", padding: 0 }}>
            {payableAccounts(k.state).length === 0 ? (
              <p className="sub" style={{ padding: 12 }}>
                You don’t have an account to set up yet. Add one in Wallet first.
              </p>
            ) : (
              payableAccounts(k.state).map((a) => (
                <button
                  key={a.id}
                  className="row rowbtn"
                  onClick={() => {
                    setPicking(false);
                    setEditing(a);
                  }}
                >
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
          </div>
        </Modal>
      )}
      {editing && <PayEditor ctx={ctx} account={editing} onClose={() => setEditing(null)} onSaved={(id) => setMethodId(id)} />}
    </Modal>
  );
}
