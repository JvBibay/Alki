"use client";

import { useState } from "react";
import { Modal } from "./Sheet";
import { detectPlatform, useInstallPrompt } from "@/lib/install";

/** Step-by-step: put Kwenta on the Home Screen like a normal app (Android and iPhone). */
export default function InstallGuide({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"android" | "ios">(() => (detectPlatform() === "ios" ? "ios" : "android"));
  const { canPrompt, install } = useInstallPrompt();

  return (
    <Modal title="Install Kwenta" onClose={onClose}>
      <div className="form">
        <p className="sub">Add Kwenta to your Home Screen to open it like an app: full screen, one tap, and it keeps working offline. There’s nothing to download from a store.</p>

        <div className="seg" role="tablist" aria-label="Your phone">
          <button role="tab" aria-selected={tab === "android"} onClick={() => setTab("android")}>
            Android
          </button>
          <button role="tab" aria-selected={tab === "ios"} onClick={() => setTab("ios")}>
            iPhone
          </button>
        </div>

        {tab === "android" ? (
          <>
            {canPrompt && (
              <button className="btn" onClick={() => void install()}>
                Install now
              </button>
            )}
            <div className="card" style={{ padding: 12 }}>
              <b>Chrome</b>
              <ol className="sub" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>
                  Open Kwenta in <b>Chrome</b>.
                </li>
                <li>
                  Tap the <b>⋮</b> menu (top right).
                </li>
                <li>
                  Tap <b>Install app</b> (or <b>Add to Home screen</b>).
                </li>
                <li>
                  Tap <b>Install</b>. Kwenta appears with your other apps.
                </li>
              </ol>
            </div>
            <div className="card" style={{ padding: 12 }}>
              <b>Samsung Internet</b>
              <ol className="sub" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>
                  Tap the <b>≡</b> menu (bottom right).
                </li>
                <li>
                  Tap <b>Add page to</b>, then <b>Home screen</b>.
                </li>
              </ol>
            </div>
          </>
        ) : (
          <div className="card" style={{ padding: 12 }}>
            <b>Safari (use Safari on iPhone)</b>
            <ol className="sub" style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              <li>
                Open Kwenta in <b>Safari</b>.
              </li>
              <li>
                Tap the <b>Share</b> button (the square with an arrow pointing up).
              </li>
              <li>
                Scroll down and tap <b>Add to Home Screen</b>.
              </li>
              <li>
                Tap <b>Add</b> (top right).
              </li>
              <li>Open Kwenta from your Home Screen, and sign in again if asked.</li>
            </ol>
          </div>
        )}

        <p className="hint">
          Tip: on iPhone, push reminders only work once Kwenta is installed this way. Your data stays on the phone you installed it on, so use your cloud backup or a file backup if you
          move to a new phone.
        </p>
      </div>
    </Modal>
  );
}
