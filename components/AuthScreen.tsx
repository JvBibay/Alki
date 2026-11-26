"use client";

import { FormEvent, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import Mascot, { type Face } from "./Mascot";
import Icon from "./Icon";
import Captcha, { captchaOn } from "./Captcha";
import { COMMON_PASSWORD_MESSAGE, isCommonPassword } from "@/lib/passwords";
import Testimonials from "./Testimonials";

type Mode = "signin" | "signup" | "link" | "forgot";
type Sent = "confirm" | "link" | "reset";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What Alki says and how it looks in each mode. */
const MODES: Record<Mode, { face: Face; line: string; title: string; sub: string; cta: string }> = {
  signin: { face: "happy", line: "Welcome back! Let’s see how your money’s doing.", title: "Sign in", sub: "Pick up right where you left off.", cta: "Sign in" },
  signup: { face: "excited", line: "New here? I’ll have you set up in a minute.", title: "Create your account", sub: "Free, and your data stays encrypted.", cta: "Create account" },
  link: { face: "wink", line: "No password needed. I’ll email you a magic link.", title: "Email me a link", sub: "Open it on this device to sign in.", cta: "Send me the link" },
  forgot: { face: "thinking", line: "It happens to everyone. I’ll send a reset link.", title: "Reset your password", sub: "We’ll email you a link to choose a new one.", cta: "Send reset link" },
};

/** Turns Supabase’s technical messages into something friendly. */
function friendly(message: string): { text: string; code?: "unconfirmed" | "exists" } {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return { text: "That email and password don’t match. Check them and try again." };
  if (m.includes("not confirmed")) return { text: "Your email isn’t confirmed yet. Open the link we sent you.", code: "unconfirmed" };
  if (m.includes("already registered") || m.includes("already been registered")) return { text: "This email already exists. Try signing in instead.", code: "exists" };
  // The database refuses sign-ups whose email is a different spelling of one already registered (see scripts/signup-guard.sql).
  if (m.includes("database error saving new user")) return { text: "This email already exists. Try signing in instead.", code: "exists" };
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return { text: "Too many emails sent. Please wait a few minutes and try again." };
  if (m.includes("failed to fetch") || m.includes("network")) return { text: "Can’t reach the server. Check your connection and try again." };
  if (m.includes("password") && m.includes("character")) return { text: "That password is too short. Use at least 8 characters." };
  return { text: message };
}

/** 0–4: length plus a mix of lower/upper, digits and symbols. */
function strength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(4, Math.max(pw.length >= 8 ? 1 : 0, score));
}
const STRENGTH_LABEL = ["Too short", "Weak", "Okay", "Good", "Strong"];

/**
 * Sign in, create account, email link and password reset in one screen, with Alki reacting to
 * what's happening. `compact` shrinks the mascot for use inside another page.
 */
export default function AuthScreen({ notice, compact = false }: { notice?: string; compact?: boolean }) {
  const sb = getSupabase();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwFocus, setPwFocus] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; code?: "unconfirmed" | "exists" } | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [resent, setResent] = useState(false);
  const [agree, setAgree] = useState(false);
  // Captcha token (when turned on): single-use, so a new one is requested after every attempt.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  const cfg = MODES[mode];
  // A very common password never rates better than "Weak", however long or mixed it looks.
  const score = mode === "signup" && isCommonPassword(pw) ? Math.min(1, strength(pw)) : strength(pw);
  const needsPw = mode === "signin" || mode === "signup";

  // Alki’s reaction to the moment.
  const face: Face = busy ? "thinking" : sent ? "love" : error ? "worried" : pwFocus && needsPw ? "wink" : cfg.face;
  const line = busy
    ? "One moment…"
    : sent
      ? sent === "reset"
        ? "Check your inbox for the reset link."
        : "Check your inbox. I’ll be right here."
      : error
        ? "Hmm, that didn’t work."
        : pwFocus && needsPw
          ? mode === "signup" && pw.length > 0 && score < 3
            ? "Try making it a bit longer or mixing it up."
            : "I won’t peek."
          : notice
            ? "Welcome back. Please sign in again."
            : cfg.line;

  function go(next: Mode) {
    setMode(next);
    setError(null);
    setSent(null);
    setResent(false);
    if (next === "link" || next === "forgot") setPw("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setError(null);
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) return setError({ text: "That doesn’t look like an email address." });
    if (needsPw && pw.length < 8) return setError({ text: "Use at least 8 characters for your password." });
    if (mode === "signup" && isCommonPassword(pw)) return setError({ text: COMMON_PASSWORD_MESSAGE });
    if (mode === "signup" && !agree) return setError({ text: "Please agree to the Terms of Use and Privacy Notice to create an account." });
    if (captchaOn() && !captcha) return setError({ text: "Please wait a moment for the security check to finish, then try again." });
    setBusy(true);
    const captchaToken = captcha ?? undefined;
    try {
      const redirect = window.location.origin;
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email: mail, password: pw, options: { captchaToken } });
        if (error) throw error;
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({ email: mail, password: pw, options: { emailRedirectTo: redirect, captchaToken } });
        if (error) throw error;
        // With email confirmation on, an existing address comes back as a user with no identities.
        if (data.user && data.user.identities?.length === 0) throw new Error("User already registered");
        if (!data.session) setSent("confirm");
      } else if (mode === "link") {
        const { error } = await sb.auth.signInWithOtp({ email: mail, options: { emailRedirectTo: redirect, captchaToken } });
        if (error) throw error;
        setSent("link");
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(mail, { redirectTo: redirect, captchaToken });
        if (error) throw error;
        setSent("reset");
      }
    } catch (err) {
      setError(friendly(err instanceof Error ? err.message : "Something went wrong."));
    } finally {
      setBusy(false);
      setCaptchaKey((n) => n + 1); // the token is used up: ask for a fresh one
    }
  }

  async function resend() {
    if (!sb) return;
    if (captchaOn() && !captcha) return setError({ text: "Please wait a moment for the security check to finish, then try again." });
    setBusy(true);
    const mail = email.trim();
    const { error } = await sb.auth.resend({ type: "signup", email: mail, options: { emailRedirectTo: window.location.origin, captchaToken: captcha ?? undefined } });
    setBusy(false);
    setCaptchaKey((n) => n + 1);
    if (error) setError(friendly(error.message));
    else {
      setError(null);
      setResent(true);
    }
  }

  return (
    <div className={`au${compact ? " au-compact" : ""}`}>
      <div className="au-stage">
        <div className="au-alki">
          <Mascot size={compact ? 84 : 118} face={face} animated />
        </div>
        <div className="au-bubble" key={line} role="status" aria-live="polite">
          {line}
        </div>
      </div>

      {notice && !sent && (
        <p className="au-notice" role="status">
          {notice}
        </p>
      )}

      <div className="card au-card">
        {sent ? (
          <div className="au-sent">
            <div className="au-sent-ico" aria-hidden="true">
              <Icon name="send" size={28} />
            </div>
            <h2>{sent === "reset" ? "Check your email" : sent === "link" ? "Your link is on its way" : "Confirm your email"}</h2>
            <p className="sub">
              We sent {sent === "reset" ? "a reset link" : sent === "link" ? "a sign-in link" : "a confirmation link"} to <b>{email.trim()}</b>. Open it on this device.
            </p>
            {error && <p className="warnt">{error.text}</p>}
            {resent && <p className="sub">Sent again. It can take a minute to arrive.</p>}
            {sent === "confirm" && (
              <>
                <Captcha onToken={setCaptcha} resetKey={captchaKey} />
                <button className="btn ghost wide" onClick={resend} disabled={busy}>
                  {busy ? "Sending…" : "Resend the email"}
                </button>
              </>
            )}
            <button className="link" onClick={() => go(sent === "confirm" ? "signin" : mode)}>
              {sent === "confirm" ? "I’ve confirmed, sign in" : "Use a different email"}
            </button>
          </div>
        ) : (
          <>
            {(mode === "signin" || mode === "signup") && (
              <div className="seg au-tabs" role="tablist" aria-label="Sign in or create account">
                <button type="button" role="tab" aria-selected={mode === "signin"} onClick={() => go("signin")}>
                  Sign in
                </button>
                <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => go("signup")}>
                  Create account
                </button>
              </div>
            )}

            <form className="au-form" onSubmit={submit} noValidate>
              <div>
                <h2 className="au-title">{cfg.title}</h2>
                <p className="sub">{cfg.sub}</p>
              </div>

              <label className="au-field">
                <span>Email</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus={!compact}
                />
              </label>

              {needsPw && (
                <label className="au-field">
                  <span className="au-pwhead">
                    Password
                    {mode === "signin" && (
                      <button type="button" className="link" onClick={() => go("forgot")}>
                        Forgot password?
                      </button>
                    )}
                  </span>
                  <span className="au-pw">
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      value={pw}
                      onChange={(e) => setPw(e.target.value)}
                      onFocus={() => setPwFocus(true)}
                      onBlur={() => setPwFocus(false)}
                      placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                    />
                    <button type="button" className="au-eye" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw}>
                      <Icon name={showPw ? "eyeOff" : "eye"} size={20} />
                    </button>
                  </span>
                  {mode === "signup" && pw.length > 0 && (
                    <span className="au-meter-wrap">
                      <span className={`au-meter s${score}`} aria-hidden="true">
                        {[1, 2, 3, 4].map((n) => (
                          <i key={n} className={n <= score ? "on" : ""} />
                        ))}
                      </span>
                      <small>{STRENGTH_LABEL[score]}</small>
                    </span>
                  )}
                </label>
              )}

              {error && (
                <div className="au-error" role="alert">
                  <p>{error.text}</p>
                  {error.code === "unconfirmed" && (
                    <button type="button" className="link" onClick={resend} disabled={busy}>
                      Resend the confirmation email
                    </button>
                  )}
                  {error.code === "exists" && (
                    <button type="button" className="link" onClick={() => go("signin")}>
                      Go to sign in
                    </button>
                  )}
                </div>
              )}

              {mode === "signup" && (
                <label className="check">
                  <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  <span>
                    I’m 18 or older and agree to the{" "}
                    <a href="/terms" target="_blank" rel="noopener noreferrer">
                      Terms of Use
                    </a>{" "}
                    and{" "}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer">
                      Privacy Notice
                    </a>
                    .
                  </span>
                </label>
              )}
              <Captcha onToken={setCaptcha} resetKey={captchaKey} />
              <button className="btn wide big" type="submit" disabled={busy || !email}>
                {busy ? "Please wait…" : cfg.cta}
              </button>

              {(mode === "signin" || mode === "signup") && (
                <>
                  <div className="au-or">
                    <span>or</span>
                  </div>
                  <button type="button" className="btn ghost wide" onClick={() => go("link")}>
                    <Icon name="send" size={18} /> Email me a sign-in link
                  </button>
                </>
              )}
              {(mode === "link" || mode === "forgot") && (
                <button type="button" className="link au-back" onClick={() => go("signin")}>
                  Back to sign in
                </button>
              )}
            </form>
          </>
        )}
      </div>

      {!compact && <Testimonials limit={6} more />}

      {!compact && (
        <ul className="au-perks" aria-label="Why sign in">
          <li>
            <Icon name="lock" size={15} /> End-to-end encrypted
          </li>
          <li>
            <Icon name="cloud" size={15} /> Back up and restore
          </li>
          <li>
            <Icon name="check" size={15} /> Works offline
          </li>
        </ul>
      )}
    </div>
  );
}
