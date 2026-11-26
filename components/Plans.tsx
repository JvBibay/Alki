"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Sheet";
import { getSupabase } from "@/lib/supabase";
import { describeAccess, FREE_FEATURES, PAID_FEATURES, PAYMENT, paymentsOpen, PLANS, type Access, type PlanId } from "@/lib/plans";

const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;

/** Monthly, annual and lifetime plans, what stays free, and the person's current plan. */
export default function Plans({ access, onClose, reason }: { access: Access; onClose: () => void; /** Why the plans were opened (for example, the account limit). */ reason?: string }) {
  const [chosen, setChosen] = useState<PlanId | null>(null);
  const [email, setEmail] = useState("");

  // The account email is what you match the payment to, so show it to the person to quote.
  useEffect(() => {
    void getSupabase()
      ?.auth.getSession()
      .then(({ data }) => setEmail(data.session?.user.email ?? ""));
  }, []);

  const plan = PLANS.find((p) => p.id === chosen);

  if (plan) {
    const isLink = /^https?:\/\//.test(PAYMENT.contact);
    return (
      <Modal title={`${plan.name} plan`} onClose={onClose}>
        <div className="form">
          {paymentsOpen() ? (
            <>
              <p className="sub">
                Pay <b>{peso(plan.price)}</b> by {PAYMENT.qr ? "QR Ph" : "GCash"}, then send your proof of payment. Your plan is turned on once it’s confirmed (usually within a day).
              </p>
              {PAYMENT.qr && (
                <div className="card" style={{ padding: 12, textAlign: "center" }}>
                  <div className="sub">Scan with GCash, Maya or any bank app (QR Ph)</div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PAYMENT.qr} alt="QR Ph payment code" style={{ width: "100%", maxWidth: 260, height: "auto", margin: "8px auto 0", display: "block", background: "#fff", borderRadius: 8 }} />
                  {PAYMENT.name && <div className="sub" style={{ marginTop: 6 }}>{PAYMENT.name}</div>}
                </div>
              )}
              {PAYMENT.number && (
                <div className="card" style={{ padding: 12 }}>
                  <div className="sub">GCash</div>
                  <b>{PAYMENT.number}</b>
                  {!PAYMENT.qr && PAYMENT.name && <div className="sub">{PAYMENT.name}</div>}
                </div>
              )}
              <ol className="sub" style={{ margin: 0, paddingLeft: 18 }}>
                <li>Pay {peso(plan.price)} using the {PAYMENT.qr ? "QR code" : "number"} above.</li>
                <li>
                  Send the screenshot of your payment{" "}
                  {isLink ? (
                    <a href={PAYMENT.contact} target="_blank" rel="noopener noreferrer">
                      here
                    </a>
                  ) : (
                    <>
                      to <b>{PAYMENT.contact}</b>
                    </>
                  )}
                  , with your Kwenta account email{email ? <b>: {email}</b> : ""}.
                </li>
                <li>We turn on your {plan.name.toLowerCase()} plan. Reopen this screen to see it.</li>
              </ol>
              <p className="hint">Only pay to the account shown here. We never ask for your password, PIN, card number or OTP. Refunds: see the Terms of Use.</p>
            </>
          ) : (
            <p className="sub">Payments aren’t open yet. Please check back soon.</p>
          )}
          <button className="btn ghost" onClick={() => setChosen(null)}>
            Back to plans
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Plans" onClose={onClose}>
      <div className="form">
        <p className="sub">
          <b>{describeAccess(access)}</b>
        </p>
        {access.trial && !access.admin && <p className="sub">Everything is open during your trial. Choose a plan before it ends to keep the paid features. Nothing is charged automatically.</p>}
        {reason && !access.admin && <p className="warnt">{reason}</p>}

        {access.admin ? (
          <p className="sub">Admin accounts aren’t part of the subscription plans and keep every feature.</p>
        ) : (
          <>
            <div className="card" style={{ padding: 12 }}>
              <b>Free, always</b>
              <ul className="sub" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {FREE_FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <b>With a plan</b>
              <ul className="sub" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {PAID_FEATURES.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>

            {PLANS.map((p) => (
              <div key={p.id} className="card" style={{ padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <b>{p.name}</b>
                  <div className="sub">
                    {peso(p.price)} {p.per} · {p.note}
                  </div>
                </div>
                <button className="btn sm" onClick={() => setChosen(p.id)} disabled={access.active && access.plan === "lifetime"}>
                  {access.plan === p.id && access.active ? "Renew" : "Choose"}
                </button>
              </div>
            ))}
            <p className="hint">
              Plans never renew automatically. See the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a> (including refunds) and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Notice</a>.
            </p>
            <p className="hint">If a plan ends, everything on your device keeps working and you can still restore or delete your cloud backup.</p>
          </>
        )}
      </div>
    </Modal>
  );
}
